import { describe, expect, it } from "vitest";
import { canTransition } from "./ticket-status";

describe("canTransition()", () => {
  it("allows forward progress through the lifecycle", () => {
    expect(canTransition("NEW", "TRIAGED")).toBe(true);
    expect(canTransition("TRIAGED", "ASSIGNED")).toBe(true);
    expect(canTransition("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "RESOLVED")).toBe(true);
    expect(canTransition("RESOLVED", "CLOSED")).toBe(true);
  });

  it("allows reopening resolved/closed tickets", () => {
    expect(canTransition("RESOLVED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("CLOSED", "IN_PROGRESS")).toBe(true);
  });

  it("treats a no-op transition as valid", () => {
    expect(canTransition("IN_PROGRESS", "IN_PROGRESS")).toBe(true);
  });

  it("rejects illegal backward jumps", () => {
    expect(canTransition("IN_PROGRESS", "NEW")).toBe(false);
    expect(canTransition("CLOSED", "RESOLVED")).toBe(false);
    expect(canTransition("RESOLVED", "NEW")).toBe(false);
  });
});
