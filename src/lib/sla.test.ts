import { describe, expect, it } from "vitest";
import { computeDueDates, isBreached, PRIORITY_SLA_MULTIPLIER, PRIORITY_RANK } from "./sla";

const category = { slaResponseMins: 60, slaResolutionMins: 480 };
const from = new Date("2026-01-01T00:00:00.000Z");

describe("computeDueDates", () => {
  it("applies the MEDIUM multiplier (1x) as the base case", () => {
    const { responseDueAt, resolutionDueAt } = computeDueDates(from, category, "MEDIUM");
    expect(responseDueAt.toISOString()).toBe("2026-01-01T01:00:00.000Z");
    expect(resolutionDueAt.toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });

  it("shrinks the window for URGENT (0.25x)", () => {
    const { responseDueAt } = computeDueDates(from, category, "URGENT");
    // 60 min * 0.25 = 15 min
    expect(responseDueAt.toISOString()).toBe("2026-01-01T00:15:00.000Z");
  });

  it("extends the window for LOW (2x)", () => {
    const { responseDueAt } = computeDueDates(from, category, "LOW");
    expect(responseDueAt.toISOString()).toBe("2026-01-01T02:00:00.000Z");
  });
});

describe("isBreached", () => {
  const due = new Date("2026-01-01T01:00:00.000Z");

  it("is not breached when unsatisfied but before the deadline", () => {
    expect(isBreached(due, null, new Date("2026-01-01T00:30:00.000Z"))).toBe(false);
  });

  it("is breached when unsatisfied past the deadline", () => {
    expect(isBreached(due, null, new Date("2026-01-01T02:00:00.000Z"))).toBe(true);
  });

  it("is breached when satisfied after the deadline", () => {
    expect(isBreached(due, new Date("2026-01-01T01:30:00.000Z"), new Date())).toBe(true);
  });

  it("is not breached when satisfied before the deadline", () => {
    expect(isBreached(due, new Date("2026-01-01T00:45:00.000Z"), new Date())).toBe(false);
  });

  it("never breaches without a due date", () => {
    expect(isBreached(null, null, new Date())).toBe(false);
  });
});

describe("priority tables", () => {
  it("orders urgency correctly", () => {
    expect(PRIORITY_RANK.URGENT).toBeGreaterThan(PRIORITY_RANK.HIGH);
    expect(PRIORITY_RANK.HIGH).toBeGreaterThan(PRIORITY_RANK.MEDIUM);
    expect(PRIORITY_RANK.MEDIUM).toBeGreaterThan(PRIORITY_RANK.LOW);
  });

  it("uses tighter SLA multipliers for higher priority", () => {
    expect(PRIORITY_SLA_MULTIPLIER.URGENT).toBeLessThan(PRIORITY_SLA_MULTIPLIER.MEDIUM);
    expect(PRIORITY_SLA_MULTIPLIER.LOW).toBeGreaterThan(PRIORITY_SLA_MULTIPLIER.MEDIUM);
  });
});
