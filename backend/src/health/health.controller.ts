import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<{
    success: true;
    data: { status: string };
  }> {
    const data = await this.healthService.check();
    return {
      success: true,
      data,
    };
  }
}
