// Encryption Service for Audit Logs
// Uses AES-256-GCM for authenticated encryption

import crypto from 'crypto';
import { logger } from '../middleware/logger';

/**
 * EncryptionService provides client-side encrypted audit logs.
 *
 * Key Features:
 * - User-specific encryption keys derived from API keys + user ID
 * - AES-256-GCM authenticated encryption
 * - Zero-knowledge architecture (Bastion can't decrypt)
 * - Async operations (non-blocking)
 * - IV/tag stored with ciphertext for decryption
 *
 * Format: "enc_v1:{iv}:{authTag}:{ciphertext}" (all base64)
 *
 * Security Improvements:
 * - Per-user salts (derived from user ID)
 * - Async PBKDF2 (non-blocking)
 * - 100,000 iterations for strong key derivation
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly SALT_PREFIX = 'bastion_audit_v1_';
  private static readonly ITERATIONS = 100000;

  /**
   * Derive a 256-bit encryption key from user's API key
   * Uses PBKDF2 with per-user salt (async, non-blocking)
   *
   * @param apiKey - User's API key
   * @param userId - User's unique ID (for salt derivation)
   */
  private static async deriveKey(apiKey: string, userId: string): Promise<Buffer> {
    // Create user-specific salt from user ID
    const userSalt = crypto
      .createHash('sha256')
      .update(`${this.SALT_PREFIX}${userId}`)
      .digest();

    // Use async PBKDF2 to avoid blocking event loop
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        apiKey,
        userSalt,
        this.ITERATIONS,
        this.KEY_LENGTH,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  /**
   * Encrypt data using user's API key (async)
   * Returns format: "enc_v1:{iv}:{authTag}:{ciphertext}"
   *
   * @param data - Data to encrypt (will be JSON stringified)
   * @param apiKey - User's API key
   * @param userId - User's unique ID
   */
  static async encrypt(data: any, apiKey: string, userId: string): Promise<string> {
    try {
      // Serialize data to JSON
      const plaintext = JSON.stringify(data);

      // Derive encryption key from API key + user ID
      const key = await this.deriveKey(apiKey, userId);

      // Generate random IV
      const iv = crypto.randomBytes(this.IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      // Encrypt
      let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
      ciphertext += cipher.final('base64');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Format: enc_v1:{iv}:{authTag}:{ciphertext}
      return `enc_v1:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`;
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using user's API key (async)
   * Expects format: "enc_v1:{iv}:{authTag}:{ciphertext}"
   *
   * @param encryptedData - Encrypted string
   * @param apiKey - User's API key
   * @param userId - User's unique ID
   */
  static async decrypt(encryptedData: string, apiKey: string, userId: string): Promise<any> {
    try {
      // Parse encrypted format
      const parts = encryptedData.split(':');
      if (parts.length !== 4 || parts[0] !== 'enc_v1') {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[1], 'base64');
      const authTag = Buffer.from(parts[2], 'base64');
      const ciphertext = parts[3];

      // Derive encryption key from API key + user ID
      const key = await this.deriveKey(apiKey, userId);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
      plaintext += decipher.final('utf8');

      // Parse JSON
      return JSON.parse(plaintext);
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data - invalid key or corrupted data');
    }
  }

  /**
   * Check if data is encrypted (starts with enc_v1:)
   */
  static isEncrypted(data: any): boolean {
    return typeof data === 'string' && data.startsWith('enc_v1:');
  }

  /**
   * Encrypt only if not already encrypted
   */
  static async encryptIfNeeded(data: any, apiKey: string, userId: string): Promise<string> {
    if (this.isEncrypted(data)) {
      return data as string;
    }
    return this.encrypt(data, apiKey, userId);
  }

  /**
   * Get preview of encrypted data (for display purposes)
   * Returns first 16 chars of ciphertext
   */
  static getPreview(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 4 || parts[0] !== 'enc_v1') {
        return 'invalid_format';
      }
      const ciphertext = parts[3];
      return `enc_v1:${ciphertext.substring(0, 16)}...`;
    } catch {
      return 'invalid_format';
    }
  }
}
