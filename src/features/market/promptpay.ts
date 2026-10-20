/**
 * PromptPay "Thai QR" payload (EMVCo merchant-presented QR, tag 29 = PromptPay credit transfer).
 * Any Thai banking app can scan it; with an amount it is a one-time QR for exactly that sum.
 */

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE over the payload including the "6304" CRC header. */
export function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Digits only; null when it is neither a mobile number (10 digits) nor a 13-digit ID. */
export function normalizePromptPayId(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (/^0\d{9}$/.test(d) || /^\d{13}$/.test(d)) return d;
  return null;
}

export function promptPayPayload(id: string, amountThb?: number) {
  const d = normalizePromptPayId(id);
  if (!d) throw new Error("Invalid PromptPay ID");
  // Mobile numbers are sent as 0066 + number without the leading 0, padded to 13 digits.
  const target = d.length === 10 ? tlv("01", `0066${d.slice(1)}`) : tlv("02", d);
  const merchant = tlv("29", tlv("00", "A000000677010111") + target);
  const amount = amountThb && amountThb > 0 ? tlv("54", amountThb.toFixed(2)) : "";
  const body =
    tlv("00", "01") +
    // 12 = dynamic (one amount), 11 = static (reusable).
    tlv("01", amount ? "12" : "11") +
    merchant +
    tlv("53", "764") +
    amount +
    tlv("58", "TH") +
    "6304";
  return body + crc16(body);
}
