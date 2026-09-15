import { Test, TestingModule } from '@nestjs/testing';
import { NotificationStatus, OrderStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { WebPushService } from './web-push.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const prisma = {
    pushSubscription: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const webPush = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    prisma.pushSubscription.deleteMany.mockReset();
    prisma.pushSubscription.create.mockReset();
    prisma.notification.findMany.mockReset();
    prisma.notification.updateMany.mockReset();
    prisma.order.findUnique.mockReset();
    prisma.$transaction.mockReset();
    webPush.send.mockReset();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: WebPushService, useValue: webPush },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  const driver = {
    id: 'user-1',
    username: 'driver-one',
    role: 'DRIVER' as const,
    status: UserStatus.ACTIVE,
  };

  it('replaces any existing subscription for the user and endpoint', async () => {
    prisma.pushSubscription.create.mockResolvedValue({ id: 'sub-1' });

    await expect(
      service.upsertSubscription(driver, {
        endpoint: 'https://push.example.test/a',
        p256dh: 'p256dh',
        auth: 'auth',
      }),
    ).resolves.toEqual({ id: 'sub-1' });

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: 'user-1' }, { endpoint: 'https://push.example.test/a' }],
      },
    });
    expect(prisma.pushSubscription.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        endpoint: 'https://push.example.test/a',
        p256dh: 'p256dh',
        auth: 'auth',
      },
      select: { id: true },
    });
  });

  it('does not send PENDING notifications when the order is no longer OPEN', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n-1',
        user: {
          pushSubscription: {
            id: 'sub-1',
            endpoint: 'https://push.example.test/a',
            p256dh: 'p256dh',
            auth: 'auth',
          },
        },
      },
    ]);
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.ACCEPTED,
    });

    await service.deliverPendingForOrder('order-1');

    expect(webPush.send).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('marks SENT after a successful push', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n-1',
        user: {
          pushSubscription: {
            id: 'sub-1',
            endpoint: 'https://push.example.test/a',
            p256dh: 'p256dh',
            auth: 'auth',
          },
        },
      },
    ]);
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.OPEN,
      pickupLocation: '左營高鐵站',
      destination: '小港機場',
      price: '1200.00',
    });
    let capturedSentAt: Date | undefined;
    prisma.notification.updateMany.mockImplementation(
      (args: {
        where: { id: string; status: NotificationStatus };
        data: { status: NotificationStatus; sentAt?: Date };
      }) => {
        capturedSentAt = args.data.sentAt;
        return Promise.resolve({ count: 1 });
      },
    );
    webPush.send.mockResolvedValue({ ok: true });

    await service.deliverPendingForOrder('order-1');

    expect(webPush.send).toHaveBeenCalled();
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'n-1',
        status: NotificationStatus.PENDING,
      },
      data: {
        status: NotificationStatus.SENT,
        sentAt: capturedSentAt,
      },
    });
    expect(capturedSentAt).toBeInstanceOf(Date);
  });

  it('removes an invalid subscription and marks FAILED', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n-1',
        user: {
          pushSubscription: {
            id: 'sub-1',
            endpoint: 'https://push.example.test/a',
            p256dh: 'p256dh',
            auth: 'auth',
          },
        },
      },
    ]);
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.OPEN,
      pickupLocation: '左營高鐵站',
      destination: '小港機場',
      price: '1200.00',
    });
    webPush.send.mockResolvedValue({ ok: false, invalid: true });

    await service.deliverPendingForOrder('order-1');

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'n-1',
        status: NotificationStatus.PENDING,
      },
      data: {
        status: NotificationStatus.FAILED,
      },
    });
  });

  it('marks FAILED without deleting the subscription on a generic send failure', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n-1',
        user: {
          pushSubscription: {
            id: 'sub-1',
            endpoint: 'https://push.example.test/a',
            p256dh: 'p256dh',
            auth: 'auth',
          },
        },
      },
    ]);
    prisma.order.findUnique.mockResolvedValue({
      status: OrderStatus.OPEN,
      pickupLocation: '左營高鐵站',
      destination: '小港機場',
      price: '1200.00',
    });
    webPush.send.mockResolvedValue({ ok: false, invalid: false });

    await service.deliverPendingForOrder('order-1');

    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'n-1',
        status: NotificationStatus.PENDING,
      },
      data: {
        status: NotificationStatus.FAILED,
      },
    });
  });

  it('swallows delivery errors so publish is not affected', async () => {
    prisma.notification.findMany.mockRejectedValue(new Error('db down'));

    await expect(
      service.deliverPendingForOrder('order-1'),
    ).resolves.toBeUndefined();
  });
});
