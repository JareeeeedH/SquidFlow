import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const healthService = {
    check: jest.fn(),
  };

  beforeEach(async () => {
    healthService.check.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns the success envelope', async () => {
    healthService.check.mockResolvedValue({ status: 'ok' });

    await expect(controller.getHealth()).resolves.toEqual({
      success: true,
      data: { status: 'ok' },
    });
  });
});
