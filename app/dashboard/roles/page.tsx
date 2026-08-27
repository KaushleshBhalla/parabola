import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  organizations,
  roles,
  rolePermissions,
  organizationMembers,
  memberRoles,
  users,
} from "@/lib/db/schema";
import { requireUser, hasPermission } from "@/lib/auth/rbac";
import { getPrimaryOrganization } from "@/lib/organizations";
import { RoleCard } from "./role-card";
import { CreateRoleDialog } from "./create-role-dialog";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberRow } from "./member-row";

export default async function RolesPage() {
  const user = await requireUser();
  const org = await getPrimaryOrganization(user.id);
  if (!org) redirect("/onboarding");

  const canManage = await hasPermission(user.id, org.id, "role.manage");
  if (!canManage) redirect("/dashboard");

  const [orgRow, roleRows, permissionRows, memberRows, memberRoleRows] =
    await Promise.all([
      db
        .select({ createdBy: organizations.createdBy })
        .from(organizations)
        .where(eq(organizations.id, org.id))
        .then((r) => r[0]),
      db.select().from(roles).where(eq(roles.organizationId, org.id)),
      db
        .select()
        .from(rolePermissions)
        .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
        .where(eq(roles.organizationId, org.id)),
      db
        .select({
          id: organizationMembers.id,
          userId: organizationMembers.userId,
          name: users.name,
          email: users.email,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(eq(organizationMembers.organizationId, org.id)),
      db
        .select()
        .from(memberRoles)
        .innerJoin(roles, eq(memberRoles.roleId, roles.id))
        .where(eq(roles.organizationId, org.id)),
    ]);

  const permissionsByRole = new Map<string, string[]>();
  for (const row of permissionRows) {
    const list = permissionsByRole.get(row.role_permissions.roleId) ?? [];
    list.push(row.role_permissions.permissionKey);
    permissionsByRole.set(row.role_permissions.roleId, list);
  }

  const rolesByMember = new Map<string, string[]>();
  for (const row of memberRoleRows) {
    const list = rolesByMember.get(row.member_roles.organizationMemberId) ?? [];
    list.push(row.member_roles.roleId);
    rolesByMember.set(row.member_roles.organizationMemberId, list);
  }

  const sortedRoles = [...roleRows].sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Roles</h1>
          <p className="text-sm text-muted-foreground">
            Create custom roles and pick exactly what each one can do.
          </p>
        </div>
        <CreateRoleDialog organizationId={org.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sortedRoles.map((role) => (
          <RoleCard
            key={role.id}
            role={{
              id: role.id,
              name: role.name,
              isOwnerRole: role.isOwnerRole,
              isDefault: role.isDefault,
              permissions: permissionsByRole.get(role.id) ?? [],
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Members</h2>
          <InviteMemberDialog organizationId={org.id} />
        </div>
        <div className="flex flex-col gap-2">
          {memberRows.map((member) => (
            <MemberRow
              key={member.id}
              member={{
                id: member.id,
                name: member.name,
                email: member.email,
                roleIds: rolesByMember.get(member.id) ?? [],
              }}
              allRoles={sortedRoles}
              isCreator={orgRow?.createdBy === member.userId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
