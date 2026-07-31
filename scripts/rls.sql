-- Defense-in-depth: enable RLS with zero policies on every table.
-- The browser only ever holds the Supabase anon key, and only uses it for
-- Realtime broadcast subscriptions and Storage signed-URL uploads — it never
-- calls .from(table) directly. All CRUD goes through Drizzle using the
-- service-role key from server-only code, which bypasses RLS entirely.
-- These statements just make sure that if the anon key were ever misused for
-- direct table access, Postgres denies it by default.

alter table users enable row level security;
alter table sessions enable row level security;
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
