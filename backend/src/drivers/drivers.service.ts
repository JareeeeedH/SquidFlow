import { Injectable } from '@nestjs/common';
import {
  DriverOnlineStatus,
  OrderStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { recordTripLocation } from '../fare/trip-tracking';
import { PrismaService } from '../prisma/prisma.service';
import {
  toDriverLocationResponse,
  toOnlineDriverLocationResponse,
  DriverWithUser,
  toDriverResponse,
} from './drivers.mapper';
import {
  CreateDriverInput,
  UpdateDriverInput,
  UpdateDriverLocationInput,
} from './drivers.validation';

const driverUserSelect = {
  username: true,
  status: true,
} as const;

type LockedInProgressTripOrder = {
  id: string;
  trip_distance_meters: number | null;
  trip_last_latitude: Prisma.Decimal | string | number | null;
  trip_last_longitude: Prisma.Decimal | string | number | null;
};

function toNullableNumber(
  value: Prisma.Decimal | string | number | null | undefined,
): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number(value);
  }
  return value.toNumber();
}

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
  ) {}

  async list() {
    const drivers = await this.prisma.driver.findMany({
      include: {
        user: {
          select: driverUserSelect,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    return drivers.map((driver) => toDriverResponse(driver));
  }

  async getById(id: string) {
    const driver = await this.findDriverOrThrow(id);
    return toDriverResponse(driver);
  }

  async create(input: CreateDriverInput) {
    const passwordHash = await this.passwordService.hash(input.password);

    try {
      const driver = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: input.username,
            passwordHash,
            role: UserRole.DRIVER,
            status: UserStatus.ACTIVE,
          },
        });

        return tx.driver.create({
          data: {
            userId: user.id,
            licensePlate: input.licensePlate,
            vehicleBrand: input.vehicleBrand,
            vehicleModel: input.vehicleModel,
            vehicleColor: input.vehicleColor,
            onlineStatus: DriverOnlineStatus.OFFLINE,
          },
          include: {
            user: {
              select: driverUserSelect,
            },
          },
        });
      });

      return toDriverResponse(driver);
    } catch (error) {
      this.throwMappedUniqueError(error);
    }
  }

  async update(id: string, input: UpdateDriverInput) {
    const existing = await this.findDriverOrThrow(id);
    const passwordHash =
      input.password === undefined
        ? undefined
        : await this.passwordService.hash(input.password);

    try {
      const driver = await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            username: input.username,
            ...(passwordHash !== undefined ? { passwordHash } : {}),
          },
        });

        return tx.driver.update({
          where: { id },
          data: {
            licensePlate: input.licensePlate,
            vehicleBrand: input.vehicleBrand,
            vehicleModel: input.vehicleModel,
            vehicleColor: input.vehicleColor,
          },
          include: {
            user: {
              select: driverUserSelect,
            },
          },
        });
      });

      return toDriverResponse(driver);
    } catch (error) {
      this.throwMappedUniqueError(error);
    }
  }

  async updateStatus(id: string, status: UserStatus) {
    const driver = await this.findDriverOrThrow(id);

    if (driver.user.status !== status) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: driver.userId },
          data: { status },
        });

        if (status === UserStatus.SUSPENDED) {
          await this.sessionService.revokeActiveSessions(driver.userId, tx);
        }
      });
    }

    return {
      id: driver.id,
      status,
    };
  }

  async getOnlineStatus(user: AuthenticatedUser) {
    if (user.status === UserStatus.SUSPENDED) {
      throw AppErrors.accountSuspended();
    }

    const driver = await this.prisma.driver.findUnique({
      where: { userId: user.id },
      select: { onlineStatus: true },
    });
    if (!driver) {
      throw AppErrors.notFound('找不到司機');
    }

    return {
      status: driver.onlineStatus,
    };
  }

  async updateOnlineStatus(
    user: AuthenticatedUser,
    status: DriverOnlineStatus,
  ) {
    if (user.status === UserStatus.SUSPENDED) {
      throw AppErrors.accountSuspended();
    }

    const driver = await this.prisma.driver.findUnique({
      where: { userId: user.id },
    });
    if (!driver) {
      throw AppErrors.notFound('找不到司機');
    }

    if (driver.onlineStatus !== status) {
      await this.prisma.driver.update({
        where: { id: driver.id },
        data: { onlineStatus: status },
      });
    }

    return {
      status,
    };
  }

  async getOwnLocation(user: AuthenticatedUser) {
    if (user.status === UserStatus.SUSPENDED) {
      throw AppErrors.accountSuspended();
    }

    const driver = await this.prisma.driver.findUnique({
      where: { userId: user.id },
      select: {
        latitude: true,
        longitude: true,
        locationUpdatedAt: true,
      },
    });
    if (!driver) {
      throw AppErrors.notFound('找不到司機');
    }

    return toDriverLocationResponse(driver);
  }

  async updateOwnLocation(
    user: AuthenticatedUser,
    input: UpdateDriverLocationInput,
  ) {
    if (user.status === UserStatus.SUSPENDED) {
      throw AppErrors.accountSuspended();
    }

    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
        },
      });
      if (!driver) {
        throw AppErrors.notFound('找不到司機');
      }

      const updated = await tx.driver.update({
        where: { id: driver.id },
        data: {
          latitude: new Prisma.Decimal(input.latitude),
          longitude: new Prisma.Decimal(input.longitude),
          locationUpdatedAt: new Date(),
        },
        select: {
          latitude: true,
          longitude: true,
          locationUpdatedAt: true,
        },
      });

      const lockedOrders = await tx.$queryRaw<LockedInProgressTripOrder[]>`
        SELECT id, trip_distance_meters, trip_last_latitude, trip_last_longitude
        FROM orders
        WHERE driver_id = ${driver.id}::uuid
          AND status = 'IN_PROGRESS'::"OrderStatus"
          AND arrived_at IS NULL
        FOR UPDATE
      `;

      const order = lockedOrders[0];
      if (order) {
        const next = recordTripLocation(
          {
            distanceMeters: order.trip_distance_meters ?? 0,
            lastLatitude: toNullableNumber(order.trip_last_latitude),
            lastLongitude: toNullableNumber(order.trip_last_longitude),
          },
          {
            latitude: input.latitude,
            longitude: input.longitude,
          },
        );

        // Order.trip_distance_meters is INTEGER; round only at persistence boundary.
        await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.IN_PROGRESS,
          },
          data: {
            tripDistanceMeters: Math.round(next.distanceMeters),
            tripLastLatitude:
              next.lastLatitude == null
                ? null
                : new Prisma.Decimal(next.lastLatitude),
            tripLastLongitude:
              next.lastLongitude == null
                ? null
                : new Prisma.Decimal(next.lastLongitude),
          },
        });
      }

      return toDriverLocationResponse(updated);
    });
  }

  async listOnlineLocations() {
    const drivers = await this.prisma.driver.findMany({
      where: {
        onlineStatus: DriverOnlineStatus.ONLINE,
      },
      select: {
        id: true,
        licensePlate: true,
        latitude: true,
        longitude: true,
        locationUpdatedAt: true,
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return drivers.map((driver) => toOnlineDriverLocationResponse(driver));
  }

  private async findDriverOrThrow(id: string): Promise<DriverWithUser> {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: {
          select: driverUserSelect,
        },
      },
    });

    if (!driver) {
      throw AppErrors.notFound('找不到司機');
    }

    return driver;
  }

  private throwMappedUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = this.uniqueTarget(error.meta?.target);
      if (target.includes('username')) {
        throw AppErrors.usernameAlreadyExists();
      }
      if (target.includes('license_plate') || target.includes('licenseplate')) {
        throw AppErrors.licensePlateAlreadyExists();
      }
    }
    throw error;
  }

  private uniqueTarget(target: unknown): string {
    if (Array.isArray(target)) {
      return target.map((value) => String(value).toLowerCase()).join(',');
    }
    if (typeof target === 'string') {
      return target.toLowerCase();
    }
    return '';
  }
}
