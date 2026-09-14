import { PasswordService } from './password.service';
import * as bcrypt from 'bcrypt';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a password without storing plaintext', async () => {
    const plaintext = 'test-password';
    const hash = await service.hash(plaintext);

    expect(hash).not.toBe(plaintext);
    await expect(service.verify(plaintext, hash)).resolves.toBe(true);
    await expect(service.verify('wrong-password', hash)).resolves.toBe(false);
    await expect(bcrypt.compare(plaintext, hash)).resolves.toBe(true);
  });
});
