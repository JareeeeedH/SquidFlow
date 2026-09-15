import { Injectable } from '@nestjs/common';
import {
  DriverOnlineStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';
import { DriverWithUser, toDriverResponse } from './drivers.mapper';
import { CreateDriverInput, UpdateDriverInput } from './drivers.validation';

const driverUserSelect = {
  username: true,
  status: true,
} as const;

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
            vehicleType: input.vehicleType,
            licensePlate: input.licensePlate,
            vehicleBrand: input.vehicleBrand,
            vehicleModel: input.vehicleModel,
            vehicleColor: input.vehicleColor,
            vehicleYear: input.vehicleYear,
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
            vehicleType: input.vehicleType,
            licensePlate: input.licensePlate,
            vehicleBrand: input.vehicleBrand,
            vehicleModel: input.vehicleModel,
            vehicleColor: input.vehicleColor,
            vehicleYear: input.vehicleYear,
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
