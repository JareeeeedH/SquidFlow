import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { RolesGuard } from './roles.guard';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    PasswordService,
    AuthGuard,
    RolesGuard,
  ],
  exports: [AuthGuard, RolesGuard, SessionService, PasswordService],
})
export class AuthModule {}
