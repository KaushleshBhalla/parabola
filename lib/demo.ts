import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";

export const DEMO_CREATION_LIMIT = 5;

export const DEMO_LIMIT_MESSAGE =
  "You've hit the demo limit. Request project access to keep going.";

export const DEMO_BLOCKED_MESSAGE = "Not available in demo mode.";

type ProjectDemoState = {
  isDemo: boolean;
  demoCreationsUsed: number;
};

export async function getProjectDemoState(
  projectId: string
): Promise<ProjectDemoState | null> {
  const [row] = await db
    .select({
      isDemo: projects.isDemo,
      demoCreationsUsed: projects.demoCreationsUsed,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

export function assertDemoCreationAllowed(
  state: ProjectDemoState | null
): string | null {
  if (state?.isDemo && state.demoCreationsUsed >= DEMO_CREATION_LIMIT) {
    return DEMO_LIMIT_MESSAGE;
  }
  return null;
}

export async function incrementDemoUsage(projectId: string) {
  await db
    .update(projects)
    .set({ demoCreationsUsed: sql`${projects.demoCreationsUsed} + 1` })
    .where(eq(projects.id, projectId));
}
