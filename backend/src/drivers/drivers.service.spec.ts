import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';
import { DriversService } from './drivers.service';

describe('DriversService', () => {
  let service: DriversService;
  const prisma = {
    driver: {
      findUnique: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const sessionService = {
    revokeActiveSessions: jest.fn(),
  };

  beforeEach(async () => {
    prisma.driver.findUnique.mockReset();
    prisma.user.update.mockReset();
    prisma.$transaction.mockReset();
    sessionService.revokeActiveSessions.mockReset();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: {} },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    service = module.get(DriversService);
  });

  function driverRecord(status: UserStatus) {
    return {
      id: 'driver-1',
      userId: 'user-1',
      user: {
        username: 'driver-one',
        status,
      },
    };
  }

  it('revokes active sessions when ACTIVE becomes SUSPENDED', async () => {
    prisma.driver.findUnique.mockResolvedValue(driverRecord(UserStatus.ACTIVE));

    await expect(
      service.updateStatus('driver-1', UserStatus.SUSPENDED),
    ).resolves.toEqual({
      id: 'driver-1',
      status: UserStatus.SUSPENDED,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: UserStatus.SUSPENDED },
    });
    expect(sessionService.revokeActiveSessions).toHaveBeenCalledWith(
      'user-1',
      prisma,
    );
  });

  it('does not create or revoke sessions when SUSPENDED becomes ACTIVE', async () => {
    prisma.driver.findUnique.mockResolvedValue(
      driverRecord(UserStatus.SUSPENDED),
    );

    await expect(
      service.updateStatus('driver-1', UserStatus.ACTIVE),
    ).resolves.toEqual({
      id: 'driver-1',
      status: UserStatus.ACTIVE,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: UserStatus.ACTIVE },
    });
    expect(sessionService.revokeActiveSessions).not.toHaveBeenCalled();
  });

  it('does not change sessions when the account status is unchanged', async () => {
    prisma.driver.findUnique.mockResolvedValue(driverRecord(UserStatus.ACTIVE));

    await expect(
      service.updateStatus('driver-1', UserStatus.ACTIVE),
    ).resolves.toEqual({
      id: 'driver-1',
      status: UserStatus.ACTIVE,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sessionService.revokeActiveSessions).not.toHaveBeenCalled();
  });
});
