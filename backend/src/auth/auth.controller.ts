import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { clientIp } from '../common/security/client-ip';
import { RateLimited } from '../common/security/rate-limit.decorator';
import { RateLimitGuard } from '../common/security/rate-limit.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimited('login')
  async login(
    @Body() body: LoginBody,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const result = await this.authService.login(
      username,
      password,
      clientIp(request),
    );
    this.sessionService.setCookie(
      response,
      result.session.id,
      result.session.expiresAt,
    );
    return {
      success: true,
      data: result.user,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      data: user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessionId = this.sessionService.readSessionId(request.cookies);
    await this.authService.logout(sessionId);
    this.sessionService.clearCookie(response);
    return {
      success: true,
      data: null,
    };
  }
}
