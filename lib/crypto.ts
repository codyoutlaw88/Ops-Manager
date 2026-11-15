import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function key() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) throw new Error("ENCRYPTION_KEY must be set (32+ random characters)");
  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function decrypt(blob: string) {
  const buf = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}
