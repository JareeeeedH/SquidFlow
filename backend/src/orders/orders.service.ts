import { Injectable } from '@nestjs/common';
import {
  DispatchMode,
  OrderEventType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  ORDER_NO_LOCK_NAMESPACE,
  nextOrderNo,
  orderNoLockKey,
  orderNoPrefix,
  taipeiDateStamp,
} from './order-number';
import { toCreateResponse, toDetail, toListItem } from './orders.mapper';
import { OrderInput, OrderListQuery } from './orders.validation';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async findOrderOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw AppErrors.notFound('找不到訂單');
    }
    return order;
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
