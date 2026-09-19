import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import {
  DriverOnlineStatus,
  NotificationStatus,
  OrderStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { DistanceService } from '../distance/distance.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_WAVE_DISPATCH_OPTIONS,
  WAVE_DISPATCH_OPTIONS,
  type WaveDispatchOptions,
} from './wave-dispatch.constants';
import { rankDriversByDistance } from './wave-dispatch.ranking';

export type WaveOutcome = 'continue' | 'stop';

@Injectable()
export class WaveDispatchService implements OnModuleDestroy {
  private readonly logger = new Logger(WaveDispatchService.name);
  private readonly options: WaveDispatchOptions;
  private readonly activeOrders = new Set<string>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly waitResolvers = new Map<
    string,
    (proceed: boolean) => void
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocodingService: GeocodingService,
    private readonly distanceService: DistanceService,
    private readonly notificationsService: NotificationsService,
    @Optional()
    @Inject(WAVE_DISPATCH_OPTIONS)
    options?: WaveDispatchOptions,
  ) {
    this.options = options ?? DEFAULT_WAVE_DISPATCH_OPTIONS;
  }

  onModuleDestroy() {
    for (const orderId of [...this.timers.keys()]) {
      this.cancelWait(orderId);
    }
    this.activeOrders.clear();
  }

  /**
   * Starts wave dispatch after Publish commits.
   * Awaits the first wave so callers observe immediate notifications;
   * later waves continue in-process with the configured interval.
   */
  async startAfterPublish(orderId: string): Promise<void> {
    if (this.activeOrders.has(orderId)) {
      return;
    }
    this.activeOrders.add(orderId);
    try {
      const outcome = await this.runOneWave(orderId);
      if (outcome === 'continue') {
        void this.continueWaves(orderId);
      } else {
        this.activeOrders.delete(orderId);
      }
    } catch (error) {
      this.activeOrders.delete(orderId);
      this.logger.error(
        `Wave dispatch failed for order ${orderId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Visible for unit tests — one wave selection + notify. */
  async runOneWave(orderId: string): Promise<WaveOutcome> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        pickupLocation: true,
      },
    });

    if (!order || order.status !== OrderStatus.OPEN) {
      return 'stop';
    }

    const pickup = await this.geocodingService.getPickupCoordinates(
      order.id,
      order.pickupLocation,
    );
    if (!pickup) {
      return 'stop';
    }

    const candidates = await this.prisma.driver.findMany({
      where: {
        onlineStatus: DriverOnlineStatus.ONLINE,
        latitude: { not: null },
        longitude: { not: null },
        user: {
          role: UserRole.DRIVER,
          status: UserStatus.ACTIVE,
          pushSubscription: { isNot: null },
          notifications: {
            none: { orderId },
          },
        },
        orders: {
          none: {
            status: {
              in: [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS],
            },
          },
        },
      },
      select: {
        userId: true,
        latitude: true,
        longitude: true,
      },
    });

    const ranked = rankDriversByDistance(
      candidates.flatMap((driver) => {
        const coords = this.distanceService.coordsFromDecimals(
          driver.latitude,
          driver.longitude,
        );
        const distanceMeters = this.distanceService.straightLineMeters(
          coords,
          pickup,
        );
        if (distanceMeters == null) {
          return [];
        }
        return [{ userId: driver.userId, distanceMeters }];
      }),
    );

    const wave = ranked.slice(0, this.options.batchSize);
    if (wave.length === 0) {
      return 'stop';
    }

    // Re-check OPEN immediately before creating Notification rows.
    const stillOpen = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!stillOpen || stillOpen.status !== OrderStatus.OPEN) {
      return 'stop';
    }

    await this.prisma.notification.createMany({
      data: wave.map((driver) => ({
        userId: driver.userId,
        orderId,
        status: NotificationStatus.PENDING,
        sentAt: null,
      })),
    });

    await this.notificationsService.deliverPendingForOrder(orderId);

    if (wave.length < this.options.batchSize) {
      return 'stop';
    }

    // Another OPEN check before scheduling the next interval.
    const openForNext = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!openForNext || openForNext.status !== OrderStatus.OPEN) {
      return 'stop';
    }

    return 'continue';
  }

  private async continueWaves(orderId: string): Promise<void> {
    try {
      while (this.activeOrders.has(orderId)) {
        const proceeded = await this.waitInterval(orderId);
        if (!proceeded) {
          break;
        }
        const outcome = await this.runOneWave(orderId);
        if (outcome === 'stop') {
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Wave dispatch continuation failed for order ${orderId}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.activeOrders.delete(orderId);
      this.cancelWait(orderId);
    }
  }

  private waitInterval(orderId: string): Promise<boolean> {
    this.cancelWait(orderId);
    return new Promise<boolean>((resolve) => {
      this.waitResolvers.set(orderId, resolve);
      const timer = setTimeout(() => {
        this.timers.delete(orderId);
        this.waitResolvers.delete(orderId);
        resolve(true);
      }, this.options.intervalMs);
      this.timers.set(orderId, timer);
    });
  }

  private cancelWait(orderId: string): void {
    const timer = this.timers.get(orderId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(orderId);
    }
    const resolver = this.waitResolvers.get(orderId);
    if (resolver) {
      this.waitResolvers.delete(orderId);
      resolver(false);
    }
  }
}
