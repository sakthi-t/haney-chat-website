-- Performance indexes for Haney Chat
-- Production-readiness: ensures queries on foreign keys and search columns
-- are fast as the user base grows.

-- Lookups by Clerk user ID (auth, webhooks, user sync)
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);

-- Lookups by email / username (admin search)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Lookups by role (admin filtering)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Conversations by user (sidebar list)
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated
  ON conversations(user_id, updated_at DESC);

-- Messages by conversation (chat history)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created
  ON messages(conversation_id, created_at);

-- Quick count of messages per conversation (admin stats)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages(conversation_id);
