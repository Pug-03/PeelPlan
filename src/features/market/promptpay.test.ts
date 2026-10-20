import { describe, expect, it } from "vitest";
import { crc16, normalizePromptPayId, promptPayPayload } from "./promptpay";

describe("promptpay", () => {
  it("computes CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("accepts mobile numbers and 13-digit IDs only", () => {
    expect(normalizePromptPayId("081-234-5678")).toBe("0812345678");
    expect(normalizePromptPayId("1 2345 67890 12 3")).toBe("1234567890123");
    expect(normalizePromptPayId("12345")).toBeNull();
    expect(normalizePromptPayId("8123456789")).toBeNull();
  });

  it("builds a mobile-number payload with an amount", () => {
    const p = promptPayPayload("0812345678", 100);
    expect(p).toContain("0113" + "0066812345678");
    expect(p).toContain("5406100.00");
    expect(p.startsWith("000201010212")).toBe(true);
    expect(p.slice(-8, -4)).toBe("6304");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it("builds a static payload for a national ID without an amount", () => {
    const p = promptPayPayload("1234567890123");
    expect(p.startsWith("000201010211")).toBe(true);
    expect(p).toContain("02131234567890123");
    expect(p).toContain("5303764" + "5802TH");
  });

  it("rejects invalid IDs", () => {
    expect(() => promptPayPayload("123")).toThrow();
  });
});
