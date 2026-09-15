import { Injectable } from '@nestjs/common';
import {
  DispatchMode,
  DriverOnlineStatus,
  NotificationStatus,
  OrderEventType,
  OrderStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ORDER_NO_LOCK_NAMESPACE,
  nextOrderNo,
  orderNoLockKey,
  orderNoPrefix,
  taipeiDateStamp,
} from './order-number';
import {
  toCreateResponse,
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
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(query: OrderListQuery) {
    const where: Prisma.OrderWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.scheduledAt) {
      where.scheduledAt = {
        gte: query.scheduledAt.start,
        lt: query.scheduledAt.endExclusive,
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

  async getById(id: string) {
    const order = await this.findOrderOrThrow(id);
    return toDetail(order);
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
              scheduledAt: input.scheduledAt,
              vehicleType: input.vehicleType,
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
    const orders = await this.prisma.order.findMany({
      where: {
        driverId: driver.id,
        AND: [
          { status: { not: OrderStatus.DRAFT } },
          ...(query.status ? [{ status: query.status }] : []),
        ],
      },
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        orderNo: true,
        scheduledAt: true,
        pickupLocation: true,
        destination: true,
        vehicleType: true,
        price: true,
        status: true,
      },
    });

    return orders.map(toDriverMyOrder);
  }

  async listOpenForDriver(user: AuthenticatedUser) {
    const driver = await this.findCurrentDriverOrThrow(user.id);
    if (!this.canAcceptOpenOrders(user, driver)) {
      return [];
    }

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.OPEN,
      },
      orderBy: {
        scheduledAt: 'asc',
      },
      select: {
        id: true,
        orderNo: true,
        scheduledAt: true,
        pickupLocation: true,
        destination: true,
        vehicleType: true,
        price: true,
        note: true,
      },
    });

    return orders.map(toDriverOpenOrder);
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
        scheduledAt: true,
        vehicleType: true,
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

    return toDriverOrderDetail(order);
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
        },
      });

      if (updated.count !== 1) {
        await this.throwOwnOrderTransitionError(tx, id, driver.id);
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          eventType: OrderEventType.ORDER_COMPLETED,
          actorUserId: user.id,
        },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          status: true,
          completedAt: true,
        },
      });

      return {
        id: order.id,
        status: order.status,
        completed_at: order.completedAt
          ? order.completedAt.toISOString()
          : completedAt.toISOString(),
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

      const recipients = await tx.driver.findMany({
        where: {
          onlineStatus: DriverOnlineStatus.ONLINE,
          user: {
            role: UserRole.DRIVER,
            status: UserStatus.ACTIVE,
            pushSubscription: {
              isNot: null,
            },
          },
        },
        select: {
          userId: true,
        },
      });

      if (recipients.length > 0) {
        await tx.notification.createMany({
          data: recipients.map((driver) => ({
            userId: driver.userId,
            orderId: id,
            status: NotificationStatus.PENDING,
            sentAt: null,
          })),
        });
      }

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

    await this.notificationsService.deliverPendingForOrder(result.id);
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
    if (existing.status !== OrderStatus.DRAFT) {
      throw AppErrors.invalidOrderStatus();
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        customerName: input.customerName,
        pickupLocation: input.pickupLocation,
        destination: input.destination,
        scheduledAt: input.scheduledAt,
        vehicleType: input.vehicleType,
        price: input.price,
        note: input.note,
      },
      include: assignedDriverInclude,
    });

    return toDetail(order);
  }

  async remove(id: string) {
    const existing = await this.findOrderOrThrow(id);
    if (existing.status !== OrderStatus.DRAFT) {
      throw AppErrors.invalidOrderStatus();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderEvent.deleteMany({ where: { orderId: id } });
      await tx.notification.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
    });
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

  private async findCurrentDriverOrThrow(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
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
