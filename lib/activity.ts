import "server-only";
import { db } from "@/lib/db/client";
import { activityLog } from "@/lib/db/schema";

export async function logActivity(params: {
  actorId: string | null;
  projectId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  searchText: string;
}) {
  await db.insert(activityLog).values({
    actorId: params.actorId,
    projectId: params.projectId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    before: params.before === undefined ? null : params.before,
    after: params.after === undefined ? null : params.after,
    searchText: params.searchText,
  });
}
