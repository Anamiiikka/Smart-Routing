import { describe, expect, it } from "vitest";
import { MockRoutingProvider } from "./mock";
import type { RoutingInput } from "./types";

const categories = [
  { id: "c-bug", name: "Bug" },
  { id: "c-billing", name: "Billing" },
  { id: "c-access", name: "Account Access" },
  { id: "c-howto", name: "How-to / Question" },
  { id: "c-feature", name: "Feature Request" },
];

function input(title: string, description: string): RoutingInput {
  return { title, description, categories, teams: [] };
}

const provider = new MockRoutingProvider();

describe("MockRoutingProvider", () => {
  it("classifies a crash report as a Bug", async () => {
    const r = await provider.route(input("Login returns 500 error", "The app crashes on submit"));
    expect(r.suggestedCategoryId).toBe("c-bug");
    expect(r.suggestedPriority).toBe("HIGH"); // "error"/"500" => HIGH
  });

  it("classifies a billing dispute and flags it URGENT", async () => {
    const r = await provider.route(
      input("Double charged invoice", "I was double charged on my subscription"),
    );
    expect(r.suggestedCategoryId).toBe("c-billing");
    expect(r.suggestedPriority).toBe("URGENT"); // "double charged" => URGENT
  });

  it("classifies a how-to question as LOW priority", async () => {
    const r = await provider.route(input("How do I export data?", "Looking for a CSV export guide"));
    expect(r.suggestedCategoryId).toBe("c-howto");
    expect(r.suggestedPriority).toBe("LOW");
  });

  it("is deterministic", async () => {
    const a = await provider.route(input("Bug error", "crash"));
    const b = await provider.route(input("Bug error", "crash"));
    expect(a).toEqual(b);
  });

  it("returns low confidence when nothing matches", async () => {
    const r = await provider.route(input("xyzzy", "qwerty"));
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.suggestedCategoryId).toBeNull();
  });
});
