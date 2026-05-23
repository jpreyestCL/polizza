import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  encryptSecret,
  decryptSecret,
  isCryptoConfigured,
} from "@/lib/insurer-crypto";

const previousKey = process.env.QUOTE_CREDENTIALS_KEY;

beforeAll(() => {
  process.env.QUOTE_CREDENTIALS_KEY = randomBytes(32).toString("base64");
});

afterAll(() => {
  if (previousKey === undefined) delete process.env.QUOTE_CREDENTIALS_KEY;
  else process.env.QUOTE_CREDENTIALS_KEY = previousKey;
});

describe("insurer-crypto", () => {
  it("reporta configurada cuando hay clave válida", () => {
    expect(isCryptoConfigured()).toBe(true);
  });

  it("cifra y descifra el mismo texto", () => {
    const plain = "Sup3r-Secret!👌";
    const enc = encryptSecret(plain);
    expect(enc.ciphertext).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("cada cifrado usa un IV distinto", () => {
    const a = encryptSecret("hola");
    const b = encryptSecret("hola");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("falla al manipular el ciphertext", () => {
    const enc = encryptSecret("hola");
    const broken = {
      ...enc,
      ciphertext: Buffer.from(enc.ciphertext, "base64")
        .map((b, i) => (i === 0 ? b ^ 1 : b))
        .toString("base64"),
    };
    expect(() => decryptSecret(broken)).toThrow();
  });
});
