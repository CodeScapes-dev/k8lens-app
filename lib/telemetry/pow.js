import { createHash } from "node:crypto";

export function findNonce(canonical, difficulty) {
  const leadingZeroBytes = Math.floor(difficulty / 8);
  const remainingBits = difficulty % 8;
  let nonce = 0;
  while (true) {
    const hash = createHash("sha256").update(canonical + String(nonce)).digest();
    if (hasLeadingZeros(hash, leadingZeroBytes, remainingBits)) {
      return { nonce, hash: hash.toString("hex") };
    }
    nonce++;
  }
}

export function verifyNonce(canonical, nonce, difficulty) {
  const leadingZeroBytes = Math.floor(difficulty / 8);
  const remainingBits = difficulty % 8;
  const hash = createHash("sha256").update(canonical + String(nonce)).digest();
  return hasLeadingZeros(hash, leadingZeroBytes, remainingBits);
}

function hasLeadingZeros(buf, fullZeroBytes, extraBits) {
  for (let i = 0; i < fullZeroBytes; i++) {
    if (buf[i] !== 0) return false;
  }
  if (extraBits > 0) {
    const mask = 0xff << (8 - extraBits) & 0xff;
    if ((buf[fullZeroBytes] & mask) !== 0) return false;
  }
  return true;
}
