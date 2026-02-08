import { describe, expect, it } from "vitest";
import { isApprovedEmail, isBlockedDomain, isValidEmail, normalizeEmail } from "@/lib/invite";

describe("invite helpers", () => {
  it("normalizes email casing and spaces", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("validates email format", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("bad-email")).toBe(false);
  });

  it("checks blocked domains", () => {
    expect(isBlockedDomain("user@blocked.com", ["blocked.com"])) .toBe(true);
    expect(isBlockedDomain("user@ok.com", ["blocked.com"])) .toBe(false);
  });

  it("matches approved emails case-insensitively", () => {
    expect(isApprovedEmail("User@Example.com", ["user@example.com"])) .toBe(true);
  });
});
