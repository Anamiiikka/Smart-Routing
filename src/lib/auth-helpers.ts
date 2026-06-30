import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Action } from "@/lib/rbac";

/** Returns the current session user, or null. */
export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** For server components/pages: redirect to login if unauthenticated. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For server components/pages: redirect if the user lacks a capability. */
export async function requireAction(action: Action) {
  const user = await requireUser();
  // Redirect to /tickets (accessible to every role) to avoid a redirect loop
  // when the forbidden page is itself gated by `action`.
  if (!can(user.role, action)) redirect("/tickets");
  return user;
}
