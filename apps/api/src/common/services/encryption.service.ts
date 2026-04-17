import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const GCM_ALGORITHM = 'aes-256-gcm';
const CBC_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 16 bytes for both GCM and CBC
const GCM_TAG_LENGTH = 16; // 128-bit auth tag
const GCM_PREFIX = 'gcm:';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('ENCRYPTION_KEY');
    if (!key || key.length < 64) {
      throw new Error(
        'ENCRYPTION_KEY env var is missing or too short (requires 64 hex chars)',
      );
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  encrypt(text: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(GCM_ALGORITHM, this.encryptionKey, iv, {
      authTagLength: GCM_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${GCM_PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
  }

  decrypt(encryptedText: string): string {
    if (encryptedText.startsWith(GCM_PREFIX)) {
      return this.decryptGcm(encryptedText.slice(GCM_PREFIX.length));
    }
    return this.decryptCbc(encryptedText);
  }

  private decryptGcm(payload: string): string {
    const [ivHex, encryptedHex, tagHex] = payload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv(GCM_ALGORITHM, this.encryptionKey, iv, {
      authTagLength: GCM_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    );
  }

  private decryptCbc(payload: string): string {
    const [ivHex, encryptedHex] = payload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(CBC_ALGORITHM, this.encryptionKey, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    );
  }
}
