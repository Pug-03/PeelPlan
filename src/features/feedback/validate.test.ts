import { describe, expect, it } from "vitest";
import { MESSAGE_MAX, recentFromSession, validateFeedback } from "./validate";

describe("validateFeedback", () => {
  const ok = { kind: "bug", message: "The PDF prints 2 mm too small.", email: "" };

  it("accepts a valid message and trims it", () => {
    expect(validateFeedback({ ...ok, message: "  The PDF prints 2 mm too small.  " })).toEqual({
      ok: true,
      value: { kind: "bug", message: "The PDF prints 2 mm too small.", email: null },
    });
  });
  it("requires a known kind", () => {
    expect(validateFeedback({ ...ok, kind: "" })).toEqual({ ok: false, errors: { kind: "required" } });
    expect(validateFeedback({ ...ok, kind: "spam" })).toEqual({ ok: false, errors: { kind: "required" } });
  });
  it("checks message length (10–2000 characters, Thai counted by code point)", () => {
    expect(validateFeedback({ ...ok, message: "   " })).toMatchObject({ errors: { message: "required" } });
    expect(validateFeedback({ ...ok, message: "too short" })).toMatchObject({ errors: { message: "short" } });
    expect(validateFeedback({ ...ok, message: "ปริ้นแล้วเล็กไป" }).ok).toBe(true);
    expect(validateFeedback({ ...ok, message: "x".repeat(MESSAGE_MAX) }).ok).toBe(true);
    expect(validateFeedback({ ...ok, message: "x".repeat(MESSAGE_MAX + 1) })).toMatchObject({ errors: { message: "long" } });
  });
  it("email is optional but must look like one", () => {
    expect(validateFeedback({ ...ok, email: " me@example.co.th " })).toMatchObject({ value: { email: "me@example.co.th" } });
    expect(validateFeedback({ ...ok, email: "me@example" })).toMatchObject({ errors: { email: "invalid" } });
    expect(validateFeedback({ ...ok, email: "not an email" })).toMatchObject({ errors: { email: "invalid" } });
  });
});

describe("recentFromSession", () => {
  it("counts this session's messages from the last hour only", () => {
    const now = Date.parse("2026-10-20T10:00:00Z");
    const list = [
      { sessionId: "a", createdAt: "2026-10-20T09:30:00Z" },
      { sessionId: "a", createdAt: "2026-10-20T08:59:00Z" },
      { sessionId: "b", createdAt: "2026-10-20T09:59:00Z" },
    ];
    expect(recentFromSession(list, "a", now)).toBe(1);
    expect(recentFromSession(list, "c", now)).toBe(0);
  });
});
