import { createHmac, timingSafeEqual } from "node:crypto";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSignedPayload(payload: string, secret: string): string {
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

export function readSignedPayload(value: string, secret: string): string | null {
  const index = value.lastIndexOf(".");
  if (index < 1) {
    return null;
  }

  const payload = value.slice(0, index);
  const signature = value.slice(index + 1);
  const expected = sign(payload, secret);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return payload;
}
