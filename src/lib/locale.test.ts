import { describe, expect, it } from "vitest";
import {
  checkNationalId,
  formatCalendarDate,
  formatDate,
  formatMoney,
  formatPhone,
  formatTime,
  isValidSaId,
  normalizePhone,
} from "./locale";

describe("formatMoney", () => {
  it("formats Pula and Rand in their own conventions", () => {
    expect(formatMoney(450, "BWP")).toMatch(/^P\s?450\.00$/);
    expect(formatMoney(1250.5, "ZAR")).toMatch(/^R\s?1[\s ]?250,50$/);
  });
  it("shows a dash for missing amounts", () => {
    expect(formatMoney(null, "BWP")).toBe("—");
  });
});

describe("dates and times", () => {
  it("uses the practice time zone, not the browser's", () => {
    // 22:30 UTC is 00:30 the next day in Gaborone and Johannesburg (UTC+2).
    expect(formatDate("2026-11-25T22:30:00Z", "Africa/Gaborone")).toBe("26 Nov 2026");
    expect(formatTime("2026-11-25T22:30:00Z", "Africa/Johannesburg")).toBe("00:30");
  });
  it("shows birth dates without shifting the day", () => {
    expect(formatCalendarDate("1990-04-01")).toBe("1 Apr 1990");
  });
});

describe("normalizePhone", () => {
  it("handles Botswana numbers", () => {
    expect(normalizePhone("71 234 567", "BW")).toBe("+26771234567");
    expect(normalizePhone("3951234", "BW")).toBe("+2673951234");
    expect(normalizePhone("+267 71234567", "BW")).toBe("+26771234567");
    expect(normalizePhone("0026771234567", "BW")).toBe("+26771234567");
    expect(normalizePhone("26771234567", "BW")).toBe("+26771234567");
  });
  it("handles South African numbers", () => {
    expect(normalizePhone("082 123 4567", "ZA")).toBe("+27821234567");
    expect(normalizePhone("(021) 555-1234", "ZA")).toBe("+27215551234");
    expect(normalizePhone("+27 82 123 4567", "ZA")).toBe("+27821234567");
  });
  it("rejects things that can't be phone numbers", () => {
    expect(normalizePhone("12", "BW")).toBeNull();
    expect(normalizePhone("82123456", "ZA")).toBeNull();
    expect(normalizePhone("call me", "ZA")).toBeNull();
    expect(normalizePhone("", "BW")).toBeNull();
  });
  it("displays numbers readably", () => {
    expect(formatPhone("+26771234567")).toBe("+267 71 234 567");
    expect(formatPhone("+27821234567")).toBe("+27 82 123 4567");
  });
});

describe("national IDs", () => {
  it("validates South African ID checksums and dates", () => {
    expect(isValidSaId("8001015009087")).toBe(true);
    expect(isValidSaId("8001015009088")).toBe(false); // bad checksum
    expect(isValidSaId("8013015009087")).toBe(false); // month 13
    expect(isValidSaId("800101500908")).toBe(false); // 12 digits
  });
  it("blocks impossible values and warns on unusual Omang numbers", () => {
    expect(checkNationalId("sa_id", "8001015009088").error).toBeTruthy();
    expect(checkNationalId("sa_id", "8001015009087")).toEqual({});
    expect(checkNationalId("omang", "123456789")).toEqual({});
    expect(checkNationalId("omang", "12345").warning).toBeTruthy();
    expect(checkNationalId("omang", "12345").error).toBeUndefined();
    expect(checkNationalId("none", "")).toEqual({});
    expect(checkNationalId("none", "123").error).toBeTruthy();
    expect(checkNationalId("passport", "").error).toBeTruthy();
  });
});

describe("practice-local times", () => {
  it("turns a clinic wall-clock time into the right instant, whatever the browser's time zone", async () => {
    const { zonedTimeToDate } = await import("./locale");
    expect(zonedTimeToDate("2026-11-26", "09:30", "Africa/Gaborone").toISOString()).toBe("2026-11-26T07:30:00.000Z");
    expect(zonedTimeToDate("2026-11-26", "00:15", "Africa/Johannesburg").toISOString()).toBe("2026-11-25T22:15:00.000Z");
    expect(zonedTimeToDate("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });
});
