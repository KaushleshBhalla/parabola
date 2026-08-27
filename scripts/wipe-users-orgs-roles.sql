-- One-time cleanup: removes all test users/organizations/roles created while
-- building the org/roles system, without touching existing projects/work
-- items (they become orphaned — no organization, no members — until a real
-- user joins them again). Run manually in the Supabase SQL Editor.
--
-- Several tables have NOT NULL foreign keys to users with no cascade
-- (work_items.created_by, work_item_comments.author_id, chat_messages.author_id,
-- roadmap_items.created_by, attachments.uploaded_by), so deleting every user
-- outright would violate those constraints. This reassigns that old
-- authorship to one placeholder "Legacy" user instead of deleting it.

INSERT INTO users (id, name, email, role, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Legacy', 'legacy@parabola.internal', 'member', false)
ON CONFLICT (id) DO NOTHING;

UPDATE work_items SET created_by = '00000000-0000-0000-0000-000000000001', assignee_id = NULL;
UPDATE work_item_comments SET author_id = '00000000-0000-0000-0000-000000000001';
UPDATE chat_messages SET author_id = '00000000-0000-0000-0000-000000000001';
UPDATE roadmap_items SET created_by = '00000000-0000-0000-0000-000000000001';
UPDATE attachments SET uploaded_by = '00000000-0000-0000-0000-000000000001';
UPDATE projects SET created_by = NULL, organization_id = NULL;
UPDATE activity_log SET actor_id = NULL;

DELETE FROM organizations;  -- cascades roles, role_permissions, organization_members, member_roles

DELETE FROM users WHERE id != '00000000-0000-0000-0000-000000000001';
