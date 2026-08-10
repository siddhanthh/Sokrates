-- Sokrates Database Initialization & Vector/GIN Indexing Script

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. HNSW Vector Indexes for 768-dimensional Gemini Embeddings
-- User interest vector HNSW cosine index
CREATE INDEX IF NOT EXISTS idx_users_embedding
  ON users USING hnsw (interest_vec vector_cosine_ops);

-- System topic embedding HNSW cosine index
CREATE INDEX IF NOT EXISTS system_topics_embedding_idx
  ON system_topics USING hnsw (embedding vector_cosine_ops);

-- 3. Full-Text Search (TSVECTOR) & GIN Indexes
-- System Topics FTS & Trigram Search
ALTER TABLE system_topics ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || description)
  ) STORED;

CREATE INDEX IF NOT EXISTS system_topics_fts_idx 
  ON system_topics USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS system_topics_trgm_idx 
  ON system_topics USING GIN (title gin_trgm_ops);

-- Group & Public Rooms FTS
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(custom_topic, '') || ' ' || COALESCE(custom_description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS rooms_fts_idx 
  ON rooms USING GIN (search_vector);

-- 4. Additional Performance Indexes
CREATE INDEX IF NOT EXISTS messages_room_id_idx 
  ON messages (room_id, created_at);
