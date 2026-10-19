import { describe, expect, it } from "vitest";
import { ageOn } from "./onboarding";

describe("ageOn", () => {
  const today = new Date(2026, 9, 19); // 19 Oct 2026
  it("counts birthdays already passed this year", () => expect(ageOn("2006-10-19", today)).toBe(20));
  it("does not count a birthday later this year", () => expect(ageOn("2006-10-20", today)).toBe(19));
  it("handles earlier months", () => expect(ageOn("2013-01-01", today)).toBe(13));
});
