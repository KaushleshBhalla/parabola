import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { organizations, projects } from "@/lib/db/schema";

export const DEMO_CREATION_LIMIT = 5;

export const DEMO_LIMIT_MESSAGE =
  "You've hit the demo limit. Request Pro access to keep going.";

export const DEMO_BLOCKED_MESSAGE = "Not available in demo mode.";

type ProjectDemoState = {
  organizationId: string | null;
  isDemo: boolean | null;
  demoCreationsUsed: number | null;
};

export async function getProjectDemoState(
  projectId: string
): Promise<ProjectDemoState | null> {
  const [row] = await db
    .select({
      organizationId: projects.organizationId,
      isDemo: organizations.isDemo,
      demoCreationsUsed: organizations.demoCreationsUsed,
    })
    .from(projects)
    .leftJoin(organizations, eq(projects.organizationId, organizations.id))
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

export function assertDemoCreationAllowed(
  state: ProjectDemoState | null
): string | null {
  if (state?.isDemo && (state.demoCreationsUsed ?? 0) >= DEMO_CREATION_LIMIT) {
    return DEMO_LIMIT_MESSAGE;
  }
  return null;
}

export async function incrementDemoUsage(organizationId: string) {
  await db
    .update(organizations)
    .set({ demoCreationsUsed: sql`${organizations.demoCreationsUsed} + 1` })
    .where(eq(organizations.id, organizationId));
}
