import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class PasswordService {
  hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
  }

  verify(plaintext: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, passwordHash);
  }
}
