import type { Priority } from "@prisma/client";

export interface RoutingOption {
  id: string;
  name: string;
}

export interface RoutingInput {
  title: string;
  description: string;
  /** Allowed categories to choose from (id + name). */
  categories: RoutingOption[];
  /** Allowed teams to choose from (id + name). */
  teams: RoutingOption[];
}

export interface RoutingResult {
  suggestedCategoryId: string | null;
  suggestedPriority: Priority;
  suggestedTeamId: string | null;
  /** 0..1 — drives the auto-assign vs human-queue decision. */
  confidence: number;
  rationale: string;
  provider: string;
  model: string;
  tokensUsed?: number;
}

export interface RoutingProvider {
  readonly name: string;
  route(input: RoutingInput): Promise<RoutingResult>;
}
