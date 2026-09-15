import { PrismaClient } from '@prisma/client';

export async function cleanupTestUsers(
  prisma: PrismaClient,
  userIds: string[],
  extraOrderIds: string[] = [],
): Promise<void> {
  if (userIds.length === 0 && extraOrderIds.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const drivers = userIds.length
      ? await tx.driver.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        })
      : [];
    const driverIds = drivers.map((driver) => driver.id);

    const orderFilters = [
      ...(userIds.length ? [{ createdBy: { in: userIds } }] : []),
      ...(driverIds.length ? [{ driverId: { in: driverIds } }] : []),
      ...(extraOrderIds.length ? [{ id: { in: extraOrderIds } }] : []),
    ];
    const orders = orderFilters.length
      ? await tx.order.findMany({
          where: { OR: orderFilters },
          select: { id: true },
        })
      : [];
    const orderIds = [
      ...new Set([...orders.map((order) => order.id), ...extraOrderIds]),
    ];

    const notificationFilters = [
      ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
    ];
    if (notificationFilters.length) {
      await tx.notification.deleteMany({
        where: { OR: notificationFilters },
      });
    }

    if (orderIds.length) {
      await tx.orderEvent.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.order.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    if (userIds.length) {
      await tx.pushSubscription.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.session.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.driver.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });
}
