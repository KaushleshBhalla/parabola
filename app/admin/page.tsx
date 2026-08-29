import { desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db/client";
import { accessRequests, organizations } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  approveAccessRequest,
  declineAccessRequest,
  markAccessRequestContacted,
} from "./actions";

export default async function AdminRequestsPage() {
  const rows = await db
    .select({
      id: accessRequests.id,
      name: accessRequests.name,
      email: accessRequests.email,
      company: accessRequests.company,
      jobTitle: accessRequests.jobTitle,
      phone: accessRequests.phone,
      teamSize: accessRequests.teamSize,
      website: accessRequests.website,
      howHeard: accessRequests.howHeard,
      message: accessRequests.message,
      status: accessRequests.status,
      createdAt: accessRequests.createdAt,
      orgName: organizations.name,
      orgIsDemo: organizations.isDemo,
    })
    .from(accessRequests)
    .leftJoin(organizations, eq(accessRequests.organizationId, organizations.id))
    .orderBy(desc(accessRequests.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {rows.length} request{rows.length === 1 ? "" : "s"} — approving grants
        Pro access to that workspace immediately.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-sm text-muted-foreground">{r.email}</span>
                  <Badge
                    variant={
                      r.status === "approved"
                        ? "default"
                        : r.status === "declined"
                          ? "outline"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {r.status}
                  </Badge>
                  {r.orgIsDemo === false && <Badge>Pro</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(r.createdAt, "MMM d, yyyy h:mm a")} ·{" "}
                  {r.orgName ?? "no workspace"}
                </p>
                {(r.company || r.jobTitle || r.phone || r.teamSize || r.website || r.howHeard) && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                    {r.company && <Field label="Company" value={r.company} />}
                    {r.jobTitle && <Field label="Role" value={r.jobTitle} />}
                    {r.phone && <Field label="Phone" value={r.phone} />}
                    {r.teamSize && <Field label="Team size" value={r.teamSize} />}
                    {r.website && <Field label="Website" value={r.website} />}
                    {r.howHeard && <Field label="Heard via" value={r.howHeard} />}
                  </dl>
                )}
                {r.message && <p className="text-sm">{r.message}</p>}
              </div>
              <div className="flex w-36 shrink-0 flex-col gap-1.5">
                <form action={approveAccessRequest.bind(null, r.id)}>
                  <Button type="submit" size="sm" className="w-full">
                    Grant Pro
                  </Button>
                </form>
                <form action={markAccessRequestContacted.bind(null, r.id)}>
                  <Button type="submit" size="sm" variant="outline" className="w-full">
                    Mark contacted
                  </Button>
                </form>
                <form action={declineAccessRequest.bind(null, r.id)}>
                  <Button type="submit" size="sm" variant="ghost" className="w-full">
                    Decline
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
