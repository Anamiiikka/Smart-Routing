import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { can, type Action } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/** Thrown by guards/handlers to produce a specific HTTP status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getApiUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireApiUser() {
  const user = await getApiUser();
  if (!user) throw new ApiError(401, "Authentication required");
  return user;
}

export async function requireApiAction(action: Action) {
  const user = await requireApiUser();
  if (!can(user.role, action)) throw new ApiError(403, "Forbidden");
  return user;
}

/** Converts thrown errors into JSON responses with the right status code. */
export function handleApiError(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: e.flatten().fieldErrors },
      { status: 400 },
    );
  }
  logger.error({ err: e }, "Unhandled API error");
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
