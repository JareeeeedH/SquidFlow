import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationStatus,
  OrderStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { PushSubscriptionInput } from './notifications.validation';
import { formatPushPayload } from './push-payload';
import { WebPushService } from './web-push.service';
import { WebPushSendResult } from './web-push.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webPush: WebPushService,
  ) {}

  async upsertSubscription(
    user: AuthenticatedUser,
    input: PushSubscriptionInput,
  ) {
    this.assertDriverAccountActive(user);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.pushSubscription.deleteMany({
            where: {
              OR: [{ userId: user.id }, { endpoint: input.endpoint }],
            },
          });
          const created = await tx.pushSubscription.create({
            data: {
              userId: user.id,
              endpoint: input.endpoint,
              p256dh: input.p256dh,
              auth: input.auth,
            },
            select: { id: true },
          });
          return { id: created.id };
        });
      } catch (error) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!isUniqueConflict || attempt === 1) {
          throw error;
        }
      }
    }

    throw new Error('Unable to save push subscription');
  }

  async deleteSubscription(user: AuthenticatedUser, endpoint: string) {
    this.assertDriverAccountActive(user);
    await this.prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint,
      },
    });
  }

  async deliverPendingForOrder(orderId: string): Promise<void> {
    try {
      await this.deliverPendingForOrderUnsafe(orderId);
    } catch {
      this.logger.error(`Web Push delivery failed for order ${orderId}`);
    }
  }

  private async deliverPendingForOrderUnsafe(orderId: string): Promise<void> {
    const pending = await this.prisma.notification.findMany({
      where: {
        orderId,
        status: NotificationStatus.PENDING,
      },
      select: {
        id: true,
        user: {
          select: {
            pushSubscription: true,
          },
        },
      },
    });

    if (pending.length === 0) {
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        pickupLocation: true,
        destination: true,
        price: true,
      },
    });

    if (!order || order.status !== OrderStatus.OPEN) {
      return;
    }

    const payload = JSON.stringify(
      formatPushPayload({
        id: orderId,
        pickupLocation: order.pickupLocation,
        destination: order.destination,
        price: order.price,
      }),
    );

    for (const notification of pending) {
      const current = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!current || current.status !== OrderStatus.OPEN) {
        return;
      }

      const subscription = notification.user.pushSubscription;
      if (!subscription) {
        await this.markFailed(notification.id);
        continue;
      }

      const result = await this.sendPush(subscription, payload);
      if (result.ok) {
        await this.prisma.notification.updateMany({
          where: {
            id: notification.id,
            status: NotificationStatus.PENDING,
          },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
          },
        });
        continue;
      }

      if (result.invalid) {
        await this.prisma.pushSubscription.deleteMany({
          where: { id: subscription.id },
        });
      }

      await this.markFailed(notification.id);
    }
  }

  private async sendPush(
    subscription: {
      endpoint: string;
      p256dh: string;
      auth: string;
    },
    payload: string,
  ): Promise<WebPushSendResult> {
    try {
      return await this.webPush.send(subscription, payload);
    } catch {
      return { ok: false, invalid: false };
    }
  }

  private async markFailed(notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        status: NotificationStatus.PENDING,
      },
      data: {
        status: NotificationStatus.FAILED,
      },
    });
  }

  private assertDriverAccountActive(user: AuthenticatedUser) {
    if (user.status === UserStatus.SUSPENDED) {
      throw AppErrors.accountSuspended();
    }
  }
}
