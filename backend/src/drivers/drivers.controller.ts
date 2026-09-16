import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AppErrors } from '../common/errors/app.error';
import { DriversService } from './drivers.service';
import {
  parseCreateDriverBody,
  parseUpdateDriverBody,
  parseUpdateDriverStatusBody,
} from './drivers.validation';

const parseDriverId = new ParseUUIDPipe({
  exceptionFactory: () => AppErrors.notFound('找不到司機'),
});

@Controller('drivers')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  async list() {
    const data = await this.driversService.list();
    return {
      success: true,
      data,
    };
  }

  @Get('online-locations')
  async listOnlineLocations() {
    const data = await this.driversService.listOnlineLocations();
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() body: unknown) {
    const data = await this.driversService.create(parseCreateDriverBody(body));
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  async getById(@Param('id', parseDriverId) id: string) {
    const data = await this.driversService.getById(id);
    return {
      success: true,
      data,
    };
  }

  @Put(':id')
  async update(@Param('id', parseDriverId) id: string, @Body() body: unknown) {
    const data = await this.driversService.update(
      id,
      parseUpdateDriverBody(body),
    );
    return {
      success: true,
      data,
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', parseDriverId) id: string,
    @Body() body: unknown,
  ) {
    const data = await this.driversService.updateStatus(
      id,
      parseUpdateDriverStatusBody(body),
    );
    return {
      success: true,
      data,
    };
  }
}
