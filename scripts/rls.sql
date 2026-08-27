-- Defense-in-depth: enable RLS with zero policies on every table.
-- The app never queries Postgres with the Supabase anon key — all CRUD goes
-- through Drizzle over a direct connection (DATABASE_URL/DIRECT_URL), which
-- isn't subject to RLS. These statements just make sure that if the anon key
-- were ever misused for direct table access, Postgres denies it by default.

alter table users enable row level security;
alter table projects enable row level security;
alter table project_counters enable row level security;
alter table labels enable row level security;
alter table work_items enable row level security;
alter table work_item_labels enable row level security;
alter table work_item_comments enable row level security;
alter table roadmap_items enable row level security;
alter table chat_messages enable row level security;
alter table attachments enable row level security;
alter table activity_log enable row level security;
alter table project_members enable row level security;
alter table notifications enable row level security;
alter table organizations enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table organization_members enable row level security;
alter table member_roles enable row level security;
