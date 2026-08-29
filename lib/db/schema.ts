import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  doublePrecision,
  bigint,
  date,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const workItemStatusEnum = pgEnum("work_item_status", [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);

export const workItemPriorityEnum = pgEnum("work_item_priority", [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
]);

export const roadmapStatusEnum = pgEnum("roadmap_status", [
  "planned",
  "in_progress",
  "done",
]);

export const attachmentEntityTypeEnum = pgEnum("attachment_entity_type", [
  "work_item",
  "roadmap_item",
  "chat_message",
  "comment",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "work_item_assigned",
  "due_date_changed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
]);

export const accessRequestStatusEnum = pgEnum("access_request_status", [
  "pending",
  "contacted",
  "approved",
  "declined",
]);

// ============ USERS & SESSIONS ============

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default("member"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    isBot: boolean("is_bot").notNull().default(false),
    // Platform-level admin (grants Pro / runs /admin) — deliberately separate
    // from the legacy owner/admin/member/viewer `role` above and from the
    // per-organization "Owner" role: those are Discord-style, scoped to a
    // single org; this is the actual site operator, across every org.
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_clerk_user_id_idx").on(table.clerkUserId),
    uniqueIndex("users_single_owner_idx")
      .on(table.role)
      .where(sql`${table.role} = 'owner'`),
  ]
);

// ============ ORGANIZATIONS & ROLES ============

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  amountCents: integer("amount_cents").notNull().default(4900),
  currency: text("currency").notNull().default("USD"),
  isDemo: boolean("is_demo").notNull().default(false),
  demoCreationsUsed: integer("demo_creations_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    position: doublePrecision("position").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    isOwnerRole: boolean("is_owner_role").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("roles_org_name_idx").on(table.organizationId, table.name),
    index("roles_org_idx").on(table.organizationId),
  ]
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionKey] })]
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("org_members_org_user_idx").on(
      table.organizationId,
      table.userId
    ),
    index("org_members_user_idx").on(table.userId),
  ]
);

export const memberRoles = pgTable(
  "member_roles",
  {
    organizationMemberId: uuid("organization_member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationMemberId, table.roleId] }),
  ]
);

// ============ PROJECTS ============

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color"),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  createdBy: uuid("created_by").references(() => users.id),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectCounters = pgTable("project_counters", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  nextNumber: integer("next_number").notNull().default(1),
});

// ============ LABELS ============

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("labels_project_name_idx").on(table.projectId, table.name)]
);

// ============ WORK ITEMS ============

export const workItems = pgTable(
  "work_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: workItemStatusEnum("status").notNull().default("backlog"),
    priority: workItemPriorityEnum("priority").notNull().default("none"),
    assigneeId: uuid("assignee_id").references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    position: doublePrecision("position").notNull().default(0),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("work_items_project_number_idx").on(table.projectId, table.number),
    index("work_items_project_status_position_idx").on(
      table.projectId,
      table.status,
      table.position
    ),
    index("work_items_assignee_idx").on(table.assigneeId),
  ]
);

export const workItemLabels = pgTable(
  "work_item_labels",
  {
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => workItems.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.workItemId, table.labelId] })]
);

export const workItemComments = pgTable(
  "work_item_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => workItems.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("comments_work_item_idx").on(table.workItemId, table.createdAt),
  ]
);

// ============ ROADMAP ============

export const roadmapItems = pgTable(
  "roadmap_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    milestone: text("milestone"),
    targetDate: date("target_date"),
    status: roadmapStatusEnum("status").notNull().default("planned"),
    position: doublePrecision("position").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("roadmap_items_project_idx").on(
      table.projectId,
      table.targetDate,
      table.position
    ),
  ]
);

// ============ CHAT ============

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_messages_project_created_idx").on(
      table.projectId,
      table.createdAt
    ),
  ]
);

// ============ ATTACHMENTS (polymorphic) ============

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: attachmentEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    storagePath: text("storage_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attachments_entity_idx").on(table.entityType, table.entityId),
  ]
);

// ============ ACTIVITY LOG ============

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    projectId: uuid("project_id").references(() => projects.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    searchText: text("search_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activity_log_actor_idx").on(table.actorId),
    index("activity_log_project_idx").on(table.projectId),
    index("activity_log_entity_type_idx").on(table.entityType),
    index("activity_log_action_idx").on(table.action),
    index("activity_log_created_at_idx").on(table.createdAt),
    index("activity_log_project_created_idx").on(
      table.projectId,
      table.createdAt
    ),
  ]
);

// ============ PROJECT MEMBERS ============

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })]
);

// ============ NOTIFICATIONS ============

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    body: text("body").notNull(),
    workItemId: uuid("work_item_id").references(() => workItems.id, {
      onDelete: "cascade",
    }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_unread_idx").on(
      table.userId,
      table.isRead,
      table.createdAt
    ),
  ]
);

// ============ ACCESS REQUESTS (demo -> pro) ============

export const accessRequests = pgTable(
  "access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    jobTitle: text("job_title"),
    phone: text("phone"),
    teamSize: text("team_size"),
    website: text("website"),
    howHeard: text("how_heard"),
    message: text("message"),
    status: accessRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("access_requests_status_idx").on(table.status)]
);
