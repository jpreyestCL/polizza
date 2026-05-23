import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado AES-256-GCM para credenciales de portales de aseguradoras.
 *
 * Requiere la variable de entorno `QUOTE_CREDENTIALS_KEY` con 32 bytes en
 * base64. Para generar una nueva clave:
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Agrégala a `.env` (no la versionees) y al despliegue en staging/producción.
 */

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.QUOTE_CREDENTIALS_KEY;
  if (!raw) {
    throw new Error(
      "QUOTE_CREDENTIALS_KEY no está configurada. Genera una con `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` y agrégala al entorno.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `QUOTE_CREDENTIALS_KEY debe ser 32 bytes en base64 (obtuvo ${key.length}).`,
    );
  }
  return key;
}

export type EncryptedSecret = {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
};

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecret): string {
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Indica si la clave de cifrado está disponible (sin lanzar). */
export function isCryptoConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
