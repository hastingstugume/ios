import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(size = 20) {
  return encodeBase32(randomBytes(size));
}

export function generateOtpAuthUri(params: { accountName: string; issuer: string; secret: string }) {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const issuer = encodeURIComponent(params.issuer);
  return `otpauth://totp/${label}?secret=${params.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotpCode(secret: string, code: string, window = 1) {
  const normalized = normalizeCode(code);
  if (!normalized) return false;

  const now = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset += 1) {
    if (safeEqual(generateTotpCode(secret, now + offset), normalized)) {
      return true;
    }
  }

  return false;
}

export function generateCurrentTotpCode(secret: string) {
  return generateTotpCode(secret, Math.floor(Date.now() / 1000 / 30));
}

export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const left = randomBytes(2).toString('hex').toUpperCase();
    const right = randomBytes(2).toString('hex').toUpperCase();
    return `${left}-${right}`;
  });
}

function generateTotpCode(secret: string, counter: number) {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);

  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

function normalizeCode(input: string) {
  const normalized = input.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return normalized.length >= 6 ? normalized : '';
}

function encodeBase32(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(input: string) {
  const sanitized = input.replace(/=+$/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of sanitized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
