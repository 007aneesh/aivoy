import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { serverEnv } from './env';

/**
 * Sealed-secret helper for storing tenant-supplied LLM API keys at rest.
 *
 * Format on disk: base64(version || iv || authTag || ciphertext)
 * Algorithm: AES-256-GCM. The authTag is what makes this authenticated —
 * tampering with the ciphertext makes decryption throw.
 *
 * Master key is read from AIVOY_MASTER_KEY (32 random bytes, base64). Rotating
 * the master key requires reading every row in `provider_credentials`,
 * decrypting with the old key, and re-encrypting with the new one — there is
 * no key-derivation per-row.
 */

const VERSION = 1;
const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;
const KEY_BYTES = 32;

let cachedMasterKey: Buffer | null = null;
function masterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;
  const raw = Buffer.from(serverEnv.AIVOY_MASTER_KEY, 'base64');
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `AIVOY_MASTER_KEY must decode to ${KEY_BYTES} bytes (got ${raw.length})`,
    );
  }
  cachedMasterKey = raw;
  return cachedMasterKey;
}

export async function sealSecret(plaintext: string): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const out = Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
  return out.toString('base64');
}

export async function openSecret(sealed: string): Promise<string> {
  const buf = Buffer.from(sealed, 'base64');
  if (buf.length === 0 || buf[0] !== VERSION) {
    throw new Error('Unrecognized sealed-secret version');
  }
  const iv = buf.subarray(1, 1 + IV_BYTES);
  const tag = buf.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(1 + IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', masterKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/**
 * Returns a stable hint we can show in the dashboard ("sk-…XYZ4") without
 * decrypting the whole secret. The hint is computed at seal-time and cached
 * alongside the sealed value, so it never requires re-reading the master key.
 */
export function fingerprintHint(plaintext: string): string {
  if (plaintext.length <= 4) return '••••';
  return `${plaintext.slice(0, 3)}…${plaintext.slice(-4)}`;
}

/** A short opaque public token for the embed widget: `pk_<32 url-safe chars>`. */
export async function generatePublicToken(): Promise<string> {
  return `pk_${randomBytes(24).toString('base64url')}`;
}

/** Tenant-managed shared secret for HMAC-signing webhook calls. */
export async function generateWebhookSecret(): Promise<string> {
  return `whsec_${randomBytes(32).toString('base64url')}`;
}
