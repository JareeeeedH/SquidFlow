import { Injectable } from '@nestjs/common';
import {
  DispatchMode,
  DriverOnlineStatus,
  OrderEventType,
  OrderStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { DistanceService } from '../distance/distance.service';
import { WaveDispatchService } from '../dispatch/wave-dispatch.service';
import { calculateTripFare } from '../fare/trip-fare';
import { GeocodingService } from '../geocoding/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ORDER_NO_LOCK_NAMESPACE,
  nextOrderNo,
  orderNoLockKey,
  orderNoPrefix,
  taipeiDateStamp,
} from './order-number';
import {
  DASHBOARD_BOARD_STATUSES,
  toCreateResponse,
  toDashboardBoardOrder,
  toDashboardSummary,
  toDetail,
  toDriverMyOrder,
  toDriverOpenOrder,
  toDriverOrderDetail,
  toListItem,
  type OrderWithAssignedDriver,
} from './orders.mapper';
import {
  DriverMyOrdersQuery,
  OrderInput,
  OrderListQuery,
} from './orders.validation';

const assignedDriverInclude = {
  driver: {
    include: {
      user: {
        select: {
          username: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly waveDispatchService: WaveDispatchService,
    private readonly geocodingService: GeocodingService,
    private readonly distanceService: DistanceService,
  ) {}

  async list(query: OrderListQuery) {
    const where: Prisma.OrderWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.createdAt) {
      where.createdAt = {
        gte: query.createdAt.start,
        lt: query.createdAt.endExclusive,
      };
    }
    if (query.search) {
      where.OR = [
        {
          orderNo: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          customerName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => toListItem(order));
  }

  async getDashboard() {
    const [groups, boardOrders] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: {
          status: {
            in: DASHBOARD_BOARD_STATUSES,
          },
        },
        include: assignedDriverInclude,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      summary: toDashboardSummary(
        groups.map((group) => ({
          status: group.status,
          count: group._count._all,
        })),
      ),
      board_orders: boardOrders.map((order) => toDashboardBoardOrder(order)),
    };
  }

  async getById(id: string) {
    const order = await this.findOrderOrThrow(id);
    const pickup = await this.resolvePickupCoords(
      order.id,
      order.pickupLocation,
    );
    return toDetail(order, pickup);
  }

  async create(user: AuthenticatedUser, input: OrderInput) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const order = await this.prisma.$transaction(async (tx) => {
          const orderNo = await this.allocateOrderNo(tx);
          const created = await tx.order.create({
            data: {
              orderNo,
              customerName: input.customerName,
              pickupLocation: input.pickupLocation,
              destination: input.destination,
              price: input.price,
              note: input.note,
              status: OrderStatus.DRAFT,
              dispatchMode: DispatchMode.OPEN,
              driverId: null,
              createdBy: user.id,
              acceptedAt: null,
              startedAt: null,
              completedAt: null,
              cancelledAt: null,
            },
          });

          await tx.orderEvent.create({
            data: {
              orderId: created.id,
              eventType: OrderEventType.ORDER_CREATED,
              actorUserId: user.id,
            },
          });

          return created;
        });

        // P2-02: async geocode after text pickup is persisted; do not await.
        this.geocodingService.scheduleGeocode(order.id, order.pickupLocation);
        return toCreateResponse(order);
      } catch (error) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!isUniqueConflict || attempt === 2) {
          if (isUniqueConflict) {
            throw AppErrors.validation('訂單編號產生衝突，請重試');
          }
          throw error;
        }
      }
    }

    throw AppErrors.validation('訂單編號產生衝突，請重試');
  }

  async listMine(user: AuthenticatedUser, query: DriverMyOrdersQuery) {
    const driver = await this.findCurrentDriverOrThrow(user.id);
    const driverCoords = this.distanceService.coordsFromDecimals(
      driver.latitude,
      driver.longitude,
    );
    const orders = await this.prisma.order.findMany({
      where: {
        driverId: driver.id,
        AND: [
          { status: { not: OrderStatus.DRAFT } },
          ...(query.status ? [{ status: query.status }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNo: true,
        createdAt: true,
        pickupLocation: true,
        destination: true,
        price: true,
        status: true,
      },
    });

    return Promise.all(
      orders.map(async (order) => {
        const eligible =
          order.status === OrderStatus.ACCEPTED ||
          order.status === OrderStatus.IN_PROGRESS;
        const distanceMeters = eligible
          ? await this.distanceService.metersForOrder(
              driverCoords,
              order.id,
              order.pickupLocation,
            )
          : null;
        return toDriverMyOrder(order, distanceMeters);
      }),
    );
  }

  async listOpenForDriver(user: AuthenticatedUser) {
    const driver = await this.findCurrentDriverOrThrow(user.id);
    if (!this.canAcceptOpenOrders(user, driver)) {
      return [];
    }

    const driverCoords = this.distanceService.coordsFromDecimals(
      driver.latitude,
      driver.longitude,
    );

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.OPEN,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        orderNo: true,
        createdAt: true,
        pickupLocation: true,
        destination: true,
        price: true,
        note: true,
      },
    });

    return Promise.all(
      orders.map(async (order) => {
        const distanceMeters = await this.distanceService.metersForOrder(
          driverCoords,
          order.id,
          order.pickupLocation,
        );
        return toDriverOpenOrder(order, distanceMeters);
      }),
    );
  }

  async getForDriver(user: AuthenticatedUser, id: string) {
    const driver = await this.findCurrentDriverOrThrow(user.id);
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNo: true,
        customerName: true,
        pickupLocation: true,
        destination: true,
        createdAt: true,
        price: true,
        note: true,
        status: true,
        driverId: true,
      },
    });

    if (!order) {
      throw AppErrors.notFound('找不到訂單');
    }

    const isOpen = order.status === OrderStatus.OPEN;
    const isOwn = order.driverId === driver.id;
    if (!isOpen && !isOwn) {
      throw AppErrors.notFound('找不到訂單');
    }

    const distanceEligible =
      order.status === OrderStatus.OPEN ||
      order.status === OrderStatus.ACCEPTED ||
      order.status === OrderStatus.IN_PROGRESS;
    const driverCoords = this.distanceService.coordsFromDecimals(
      driver.latitude,
      driver.longitude,
    );
    const distanceMeters = distanceEligible
      ? await this.distanceService.metersForOrder(
          driverCoords,
          order.id,
          order.pickupLocation,
        )
      : null;
    const pickup = await this.resolvePickupCoords(
      order.id,
      order.pickupLocation,
    );

    return toDriverOrderDetail(order, distanceMeters, pickup);
  }

  async listOnlineDriverDistances(orderId: string) {
    return this.distanceService.listOnlineDriverDistancesForOrder(orderId);
  }

  async accept(id: string, user: AuthenticatedUser) {
    if (user.status === UserStatus.SUSPENDED) {
      throw AppErrors.accountSuspended();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const driver = await tx.driver.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            onlineStatus: true,
            orders: {
              where: {
                status: {
                  in: [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS],
                },
              },
              select: { id: true },
              take: 1,
            },
          },
        });

        if (!driver) {
          throw AppErrors.notFound('找不到司機');
        }
        if (driver.onlineStatus !== DriverOnlineStatus.ONLINE) {
          throw AppErrors.driverOffline();
        }
        if (driver.orders.length > 0) {
          throw AppErrors.driverHasActiveOrder();
        }

        const acceptedAt = new Date();
        const claimed = await tx.order.updateMany({
          where: {
            id,
            status: OrderStatus.OPEN,
          },
          data: {
            status: OrderStatus.ACCEPTED,
            driverId: driver.id,
            acceptedAt,
          },
        });

        if (claimed.count !== 1) {
          const existing = await tx.order.findUnique({ where: { id } });
          if (!existing) {
            throw AppErrors.notFound('找不到訂單');
          }
          if (existing.status === OrderStatus.ACCEPTED) {
            throw AppErrors.orderAlreadyAccepted();
          }
          throw AppErrors.invalidOrderStatus();
        }

        await tx.orderEvent.create({
          data: {
            orderId: id,
            eventType: OrderEventType.ORDER_ACCEPTED,
            actorUserId: user.id,
          },
        });

        const order = await tx.order.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            status: true,
            driverId: true,
            acceptedAt: true,
          },
        });

        return {
          id: order.id,
          status: order.status,
          driver_id: order.driverId,
          accepted_at: order.acceptedAt
            ? order.acceptedAt.toISOString()
            : acceptedAt.toISOString(),
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw AppErrors.driverHasActiveOrder();
      }
      throw error;
    }
  }

  async start(id: string, user: AuthenticatedUser) {
    this.assertDriverAccountActive(user);

    return this.prisma.$transaction(async (tx) => {
      const driver = await this.findDriverInTxOrThrow(tx, user.id);
      const startedAt = new Date();
      const updated = await tx.order.updateMany({
        where: {
          id,
          status: OrderStatus.ACCEPTED,
          driverId: driver.id,
        },
        data: {
          status: OrderStatus.IN_PROGRESS,
          startedAt,
          tripDistanceMeters: 0,
          tripLastLatitude: null,
          tripLastLongitude: null,
        },
      });

      if (updated.count !== 1) {
        await this.throwOwnOrderTransitionError(tx, id, driver.id);
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          eventType: OrderEventType.ORDER_STARTED,
          actorUserId: user.id,
        },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          status: true,
          startedAt: true,
        },
      });

      return {
        id: order.id,
        status: order.status,
        started_at: order.startedAt
          ? order.startedAt.toISOString()
          : startedAt.toISOString(),
      };
    });
  }

  async complete(id: string, user: AuthenticatedUser) {
    this.assertDriverAccountActive(user);

    return this.prisma.$transaction(async (tx) => {
      const driver = await this.findDriverInTxOrThrow(tx, user.id);

      const lockedOrders = await tx.$queryRaw<
        Array<{
          id: string;
          driver_id: string | null;
          status: OrderStatus;
          trip_distance_meters: number | null;
        }>
      >`
        SELECT id, driver_id, status, trip_distance_meters
        FROM orders
        WHERE id = ${id}::uuid
        FOR UPDATE
      `;

      const locked = lockedOrders[0];
      if (!locked || locked.driver_id !== driver.id) {
        throw AppErrors.notFound('找不到訂單');
      }
      if (locked.status !== OrderStatus.IN_PROGRESS) {
        throw AppErrors.invalidOrderStatus();
      }

      const finalDistanceMeters = locked.trip_distance_meters ?? 0;
      const fare = calculateTripFare(finalDistanceMeters);
      const completedAt = new Date();

      const updated = await tx.order.updateMany({
        where: {
          id,
          status: OrderStatus.IN_PROGRESS,
          driverId: driver.id,
        },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt,
          price: new Prisma.Decimal(fare),
          tripDistanceMeters: finalDistanceMeters,
          tripLastLatitude: null,
          tripLastLongitude: null,
        },
      });

      if (updated.count !== 1) {
        throw AppErrors.invalidOrderStatus();
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          eventType: OrderEventType.ORDER_COMPLETED,
          actorUserId: user.id,
        },
      });

      return {
        id: locked.id,
        status: OrderStatus.COMPLETED,
        completed_at: completedAt.toISOString(),
        trip_distance_meters: finalDistanceMeters,
        price: fare,
      };
    });
  }

  async publish(id: string, user: AuthenticatedUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id,
          status: OrderStatus.DRAFT,
        },
        data: {
          status: OrderStatus.OPEN,
        },
      });

      if (updated.count !== 1) {
        const existing = await tx.order.findUnique({ where: { id } });
        if (!existing) {
          throw AppErrors.notFound('找不到訂單');
        }
        throw AppErrors.invalidOrderStatus();
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          eventType: OrderEventType.ORDER_PUBLISHED,
          actorUserId: user.id,
        },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          status: true,
        },
      });

      return {
        id: order.id,
        status: order.status,
      };
    });

    await this.waveDispatchService.startAfterPublish(result.id);
    return result;
  }

  async cancel(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const cancelledAt = new Date();
      const updated = await tx.order.updateMany({
        where: {
          id,
          status: {
            in: [OrderStatus.OPEN, OrderStatus.ACCEPTED],
          },
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt,
        },
      });

      if (updated.count !== 1) {
        const existing = await tx.order.findUnique({ where: { id } });
        if (!existing) {
          throw AppErrors.notFound('找不到訂單');
        }
        throw AppErrors.invalidOrderStatus();
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          eventType: OrderEventType.ORDER_CANCELLED,
          actorUserId: user.id,
        },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          status: true,
        },
      });

      return {
        id: order.id,
        status: order.status,
      };
    });
  }

  async update(id: string, input: OrderInput) {
    const existing = await this.findOrderOrThrow(id);
    const pickupChanged = existing.pickupLocation !== input.pickupLocation;

    // Atomic DRAFT gate — do not rely on the pre-read status check (TOCTOU vs publish).
    const updated = await this.prisma.order.updateMany({
      where: {
        id,
        status: OrderStatus.DRAFT,
      },
      data: {
        customerName: input.customerName,
        pickupLocation: input.pickupLocation,
        destination: input.destination,
        price: input.price,
        note: input.note,
      },
    });

    if (updated.count !== 1) {
      const current = await this.prisma.order.findUnique({ where: { id } });
      if (!current) {
        throw AppErrors.notFound('找不到訂單');
      }
      throw AppErrors.invalidOrderStatus();
    }

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: assignedDriverInclude,
    });

    // P2-02: invalidate stale runtime coords immediately, then async re-geocode.
    // Must not await Google — same non-blocking contract as Create Order.
    if (pickupChanged) {
      this.geocodingService.invalidateOrder(id);
      this.geocodingService.scheduleGeocode(id, order.pickupLocation);
      return toDetail(order);
    }

    const pickup = await this.resolvePickupCoords(
      order.id,
      order.pickupLocation,
    );
    return toDetail(order, pickup);
  }

  async remove(id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.orderEvent.deleteMany({ where: { orderId: id } });
      await tx.notification.deleteMany({ where: { orderId: id } });
      // Atomic DRAFT gate — roll back child deletes if the order is no longer DRAFT.
      const deleted = await tx.order.deleteMany({
        where: {
          id,
          status: OrderStatus.DRAFT,
        },
      });

      if (deleted.count !== 1) {
        const current = await tx.order.findUnique({ where: { id } });
        if (!current) {
          throw AppErrors.notFound('找不到訂單');
        }
        throw AppErrors.invalidOrderStatus();
      }
    });
    this.geocodingService.invalidateOrder(id);
  }

  private async findOrderOrThrow(id: string): Promise<OrderWithAssignedDriver> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: assignedDriverInclude,
    });
    if (!order) {
      throw AppErrors.notFound('找不到訂單');
    }
    return order;
  }

  private assertDriverAccountActive(user: AuthenticatedUser) {
    if (user.status === UserStatus.SUSPENDED) {
      throw AppErrors.accountSuspended();
    }
  }

  private async findDriverInTxOrThrow(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const driver = await tx.driver.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!driver) {
      throw AppErrors.notFound('找不到司機');
    }
    return driver;
  }

  private async throwOwnOrderTransitionError(
    tx: Prisma.TransactionClient,
    orderId: string,
    driverId: string,
  ): Promise<never> {
    const existing = await tx.order.findUnique({ where: { id: orderId } });
    if (!existing || existing.driverId !== driverId) {
      throw AppErrors.notFound('找不到訂單');
    }
    throw AppErrors.invalidOrderStatus();
  }

  private async resolvePickupCoords(
    orderId: string,
    pickupLocation: string,
  ): Promise<{
    pickup_latitude: number | null;
    pickup_longitude: number | null;
  }> {
    const coords = await this.geocodingService.getPickupCoordinates(
      orderId,
      pickupLocation,
    );
    return {
      pickup_latitude: coords?.latitude ?? null,
      pickup_longitude: coords?.longitude ?? null,
    };
  }

  private async findCurrentDriverOrThrow(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: {
        id: true,
        onlineStatus: true,
        latitude: true,
        longitude: true,
        orders: {
          where: {
            status: {
              in: [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS],
            },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!driver) {
      throw AppErrors.notFound('找不到司機');
    }

    return driver;
  }

  private canAcceptOpenOrders(
    user: AuthenticatedUser,
    driver: {
      onlineStatus: DriverOnlineStatus;
      orders: { id: string }[];
    },
  ): boolean {
    return (
      user.role === UserRole.DRIVER &&
      user.status === UserStatus.ACTIVE &&
      driver.onlineStatus === DriverOnlineStatus.ONLINE &&
      driver.orders.length === 0
    );
  }

  private async allocateOrderNo(tx: Prisma.TransactionClient): Promise<string> {
    const dateStamp = taipeiDateStamp();
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
      ORDER_NO_LOCK_NAMESPACE,
      orderNoLockKey(dateStamp),
    );

    const existing = await tx.order.findMany({
      where: {
        orderNo: {
          startsWith: orderNoPrefix(dateStamp),
        },
      },
      select: { orderNo: true },
    });

    return nextOrderNo(
      dateStamp,
      existing.map((order) => order.orderNo),
    );
  }
}
