-- Let each user store one key per provider (Gemini AND Groq at once),
-- instead of only ever one key total. Existing rows already have a unique
-- user_id, so widening the primary key to (user_id, provider) is safe —
-- no data loss, no duplicates possible.
ALTER TABLE user_ai_keys DROP CONSTRAINT user_ai_keys_pkey;
ALTER TABLE user_ai_keys ADD PRIMARY KEY (user_id, provider);
