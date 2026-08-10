# Sokrates — Complete Product & Technical Specification

**Document version:** 1.0  
**Date:** August 2026  
**Prepared for:** Antigravity Development Team  
**Project type:** Full-stack web application with real-time communication and AI integration

---

## Origin & Problem Statement

This project was born from a personal frustration.

The creator is deeply interested in philosophy — questions about free will, consciousness, ethics, the nature of reality. He has epiphanies he wants to explore out loud, arguments he wants to pressure-test, and ideas he wants to sit with another person and really dig into. But most of his friends aren't into philosophy. The conversations don't go anywhere. There's no one to push back, no one to take the other side, no one who finds these things as genuinely interesting as he does.

He looked for a solution and found nothing that fit. Existing platforms are either too casual (Reddit threads, Discord servers with hundreds of people), too structured (formal debate platforms), or too general (social networks where intellectual content drowns in noise). There is no space designed specifically for the experience of sitting down with one other person — or a small group — and having a real conversation about a real idea.

So he decided to build it.

The name Sokrates is a deliberate choice. Socrates didn't lecture. He sat with people and asked questions. He believed that the best way to understand something was to talk it through with someone who thought differently. The platform is named after that method, not the man — the idea that truth emerges from dialogue, not monologue.

**What the platform is, at its core:** a way to find the conversation partner you can't find in real life.

Every product decision flows from this. The 1-on-1 matching exists because the most meaningful intellectual conversations happen between two people, not in a crowd. The interest-based semantic matching exists because talking to someone who shares no intellectual common ground is frustrating, not stimulating. The AI fallback exists because the worst outcome is a user showing up ready to think and finding nobody there. The argument map exists because these conversations deserve to leave something behind — not just a memory, but a record of how two minds actually engaged with an idea.

The team building this should keep that original frustration in mind when making decisions. If a feature makes the platform feel more like a social network and less like a conversation, it is probably the wrong call. If a feature makes it easier for two people to have a genuinely good intellectual exchange, it is probably the right one.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [Project Folder Structure](#4-project-folder-structure)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Socket Event Reference](#7-socket-event-reference)
8. [AI Feature Specifications](#8-ai-feature-specifications)
9. [Additional Feature Specifications](#9-additional-feature-specifications)
10. [Build Plan](#10-build-plan)
11. [Deployment Guide](#11-deployment-guide)
12. [Environment Variables](#12-environment-variables)

> **Note to the development team:** Read the Origin & Problem Statement above before reading anything else. The technical sections that follow are meaningless without understanding what experience this product is trying to create.

---

## 1. Executive Summary

Sokrates is an intellectual matchmaking platform for meaningful conversations. Users are matched 1-on-1 with strangers on curated philosophical and intellectual topics, or create their own group discussion rooms. Every part of the platform — matching, conversation support, and post-conversation analysis — is enhanced by AI.

### Core Value Proposition

- No small talk. Every conversation starts with a real, substantive topic.
- Matched by intellectual compatibility, not random pairing or topic tags alone.
- AI enriches the experience before, during, and after every conversation.
- Conversations leave something permanent behind: digests, argument maps, and shareable public transcripts.

### Two Core Modes

| Mode | Trigger | Format | AI Role |
|---|---|---|---|
| **1-on-1** | User picks a system-curated topic | Private room, 2 participants | Semantic matching; fallback partner if no human match in 30s |
| **Group** | User creates a custom topic room | Open room up to creator's cap | Generates opening questions on room creation |

### Feature Summary

- Semantic matchmaking via vector embeddings (pgvector + Gemini)
- Real-time chat via Socket.io with streaming AI responses (Groq)
- Post-conversation AI digest and argument map
- Public debate showcase for shareable transcripts
- Topic watchlist with live notifications
- Trending topics based on recent activity
- Rate limiting, full-text search, email notifications, PWA, admin dashboard

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                      Client (Browser / PWA)                     │
│           Next.js 15 · TypeScript · Tailwind CSS v4            │
│           Zustand · Socket.io-client · React Flow              │
└──────────────────┬──────────────────────────┬──────────────────┘
                   │ HTTPS (REST)             │ WSS (WebSocket)
                   ▼                          ▼
   ┌───────────────────────┐    ┌───────────────────────────────┐
   │  Next.js API Routes   │    │   Express + Socket.io Server  │
   │  (Vercel Serverless)  │    │   (Render — persistent)       │
   └───────────┬───────────┘    └──────────────┬────────────────┘
               │                               │
               └──────────────┬────────────────┘
                              │
                              ▼
          ┌───────────────────────────────────────┐
          │              Supabase                  │
          │  PostgreSQL 15 + pgvector extension    │
          │  Supabase Auth · Supabase Storage      │
          └───────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
   ┌───────────────────────┐    ┌───────────────────────────────┐
   │     Upstash Redis     │    │        External AI APIs        │
   │  Matchmaking queue    │    │  Gemini text-embedding-004     │
   │  Rate limiting        │    │  Gemini 2.0 Flash              │
   │  Trending cache       │    │  Groq llama-3.3-70b-versatile  │
   └───────────────────────┘    └───────────────────────────────┘
                                              │
                                             Resend (Email)
```

### Key Architectural Decisions

**Why a separate Express server alongside Next.js?**  
Socket.io requires persistent WebSocket connections. Vercel runs serverless functions that terminate after each request, making them incompatible with long-lived connections. The Express server runs on Render as a persistent process and handles all real-time communication. Next.js API routes handle all stateless REST operations.

**Why Supabase over self-hosted PostgreSQL?**  
Supabase has pgvector enabled on every project by default, removing manual extension setup. Supabase Auth handles OAuth providers, session management, and JWT issuance without additional dependencies. Supabase Storage handles user avatar uploads. All three replace three separate services at no cost on the free tier.

**Why Groq for AI streaming and Gemini for everything else?**  
Groq runs on custom LPU (Language Processing Unit) hardware that produces tokens 10–20× faster than GPU-based inference. For the AI fallback conversation partner, this speed is perceptible and critical to the "live conversation" feel. Gemini is chosen for embedding generation (Groq has no embedding API) and for batch tasks like digest and argument map generation where speed is not user-facing.

---

## 3. Tech Stack

### Frontend

| Package | Version | Purpose |
|---|---|---|
| Next.js | 15 (App Router) | Framework, routing, SSR, API routes |
| TypeScript | 5.x | Type safety throughout |
| Tailwind CSS | v4 | Utility-first styling |
| Socket.io-client | 4.x | WebSocket client |
| Zustand | 5.x | Client state (auth, socket, room state) |
| React Flow | 12.x | Interactive argument map visualization |
| react-hot-toast | 2.x | Toast notifications |
| @supabase/supabase-js | 2.x | Auth client, storage client |
| next-pwa | 5.x | Progressive Web App config |

### Backend

| Package | Version | Purpose |
|---|---|---|
| Node.js | 20 LTS | Runtime |
| Express | 5.x | HTTP server |
| Socket.io | 4.x | WebSocket server |
| Prisma | 5.x | ORM, migrations, type-safe queries |
| @google/generative-ai | 0.x | Gemini SDK (embeddings + generation) |
| groq-sdk | 0.x | Groq SDK (streaming chat) |
| resend | 3.x | Transactional email |
| rate-limiter-flexible | 5.x | Redis-backed rate limiting |
| jsonwebtoken | 9.x | JWT verification for cross-server auth |
| ioredis | 5.x | Redis client (Upstash) |

### Infrastructure

| Service | Role | Free Tier |
|---|---|---|
| Vercel | Next.js frontend deployment | Yes — unlimited personal projects |
| Render | Express + Socket.io server | Yes — sleeps after 15 min idle |
| Supabase | PostgreSQL + pgvector + Auth + Storage | Yes — 500 MB database, 1 GB storage |
| Upstash | Redis (matchmaking queue, rate limiting, cache) | Yes — 10,000 commands/day |
| Resend | Transactional email | Yes — 3,000 emails/month |

### AI APIs

| API | Model | Use Case | Limit (free) |
|---|---|---|---|
| Gemini | text-embedding-004 | User + topic embeddings (768 dims) | 1,500 req/day |
| Gemini | 2.0 Flash | Digest, argument map, starters | 1,500 req/day |
| Groq | llama-3.3-70b-versatile | Streaming AI conversation partner | ~14,400 req/day |

---

## 4. Project Folder Structure

```
sokrates/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx          # Includes interest category picker
│   ├── (main)/
│   │   ├── layout.tsx            # Main layout with nav
│   │   ├── feed/
│   │   │   └── page.tsx          # Home feed: rooms + topics tabs
│   │   ├── topics/
│   │   │   ├── page.tsx          # Browse system topics
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Topic detail + queue entry
│   │   ├── rooms/
│   │   │   ├── page.tsx          # Browse group rooms
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Create group room
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Group room chat
│   │   ├── conversations/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx      # 1-on-1 chat room
│   │   │   │   └── map/
│   │   │   │       └── page.tsx  # Argument map viewer
│   │   ├── debates/
│   │   │   ├── page.tsx          # Public debate showcase
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Single public debate transcript
│   │   ├── search/
│   │   │   └── page.tsx          # Full-text search results
│   │   └── profile/
│   │       ├── page.tsx          # Own profile
│   │       └── [id]/
│   │           └── page.tsx      # Public profile
│   ├── admin/
│   │   ├── layout.tsx            # Admin layout (RBAC guard)
│   │   ├── page.tsx              # Stats dashboard
│   │   ├── topics/
│   │   │   └── page.tsx          # Manage system topics
│   │   └── users/
│   │       └── page.tsx          # User management
│   └── api/                      # Next.js API routes (REST)
│       ├── auth/
│       ├── users/
│       ├── interests/
│       ├── topics/
│       ├── rooms/
│       ├── matchmaking/
│       ├── conversations/
│       ├── debates/
│       ├── search/
│       └── admin/
│
├── server/                       # Express + Socket.io (separate process)
│   ├── index.ts                  # Entry point, Express + Socket.io init
│   ├── routes/                   # Any Express-only REST routes
│   ├── socket/
│   │   ├── index.ts              # Socket.io setup, namespace config
│   │   ├── chat.ts               # send_message, new_message, AI streaming
│   │   ├── matchmaking.ts        # queue_enter, queue_leave, match logic
│   │   └── rooms.ts              # join_room, leave_room, typing events
│   ├── services/
│   │   ├── matchmaking.ts        # findBestMatch, createRoom, fallbackTimer
│   │   ├── embedUser.ts          # updateUserEmbedding (Gemini)
│   │   └── rateLimit.ts          # Redis rate limiter middleware
│   └── ai/
│       ├── groq.ts               # Groq client + streaming helper
│       ├── gemini.ts             # Gemini client (embed + generate)
│       ├── digest.ts             # Post-chat digest generation
│       ├── argumentMap.ts        # Argument map extraction
│       └── starters.ts           # Conversation starter generation
│
├── prisma/
│   ├── schema.prisma             # Full database schema
│   ├── seed.ts                   # Seed interest categories + system topics
│   └── migrations/               # Auto-generated migration files
│
├── lib/                          # Shared utilities (both Next.js + server)
│   ├── supabase.ts               # Supabase client init
│   ├── prisma.ts                 # Prisma client singleton
│   ├── redis.ts                  # Upstash Redis client
│   └── types.ts                  # Shared TypeScript types
│
├── components/                   # Reusable React components
│   ├── ui/                       # Base: Button, Input, Card, Badge, Modal
│   ├── chat/                     # MessageBubble, ChatInput, TypingIndicator
│   ├── rooms/                    # RoomCard, ParticipantList, StarterChips
│   ├── topics/                   # TopicCard, CategoryFilter, TrendingBadge
│   ├── argument-map/             # ArgumentMapViewer, NodeCard
│   └── profile/                  # DigestCard, ConversationHistory
│
├── hooks/                        # Custom React hooks
│   ├── useSocket.ts              # Socket.io connection + event management
│   ├── useMatchmaking.ts         # Queue enter/leave + match_found handling
│   └── useRoom.ts                # Room state, messages, participants
│
├── public/
│   ├── manifest.json             # PWA manifest
│   └── sw.js                     # Service worker (generated by next-pwa)
│
└── types/                        # Global TypeScript type declarations
    └── index.ts
```

---

## 5. Database Schema

> All tables use UUID primary keys generated by `gen_random_uuid()`. All timestamps use `TIMESTAMPTZ` with `DEFAULT NOW()`. The `pgvector` extension must be enabled: `CREATE EXTENSION IF NOT EXISTS vector;`

### 5.1 `users`

Core user record. The `interest_vec` column stores a 768-dimensional Gemini embedding of the user's interest profile, used for semantic matchmaking. The `role` field controls admin access.

```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  username     TEXT UNIQUE NOT NULL,
  avatar_url   TEXT,
  bio          TEXT,
  role         TEXT NOT NULL DEFAULT 'user',      -- 'user' | 'admin'
  interest_vec VECTOR(768),                        -- Gemini text-embedding-004
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 `interest_categories`

Seeded list of intellectual domains. Examples: Philosophy, Ethics, Metaphysics, Epistemology, Politics, Science, Aesthetics, Logic, Religion, Economics.

```sql
CREATE TABLE interest_categories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT NOT NULL    -- emoji, e.g. '🧠'
);
```

### 5.3 `user_interests`

Junction table between users and categories. The `weight` field starts at `1.0` and is incremented each time the user joins a room in that category, refining their interest profile over time.

```sql
CREATE TABLE user_interests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES interest_categories(id),
  weight      FLOAT NOT NULL DEFAULT 1.0,
  UNIQUE(user_id, category_id)
);
```

### 5.4 `system_topics`

Admin-seeded discussion topics used for 1-on-1 matchmaking. The `embedding` column stores the Gemini embedding of the topic title and description, used to find semantically related topics. Populated via a one-time seed script.

```sql
CREATE TABLE system_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,         -- e.g. 'Does free will exist?'
  description TEXT NOT NULL,         -- 2–3 sentence framing
  category_id UUID NOT NULL REFERENCES interest_categories(id),
  embedding   VECTOR(768),           -- Gemini text-embedding-004
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- pgvector HNSW index for fast cosine similarity queries
CREATE INDEX system_topics_embedding_idx
  ON system_topics USING hnsw (embedding vector_cosine_ops);
```

### 5.5 `rooms`

Unified table for both 1-on-1 and group rooms. The set of populated columns differs by `type`. The `is_public` flag enables the public debate showcase feature.

```sql
CREATE TABLE rooms (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type               TEXT NOT NULL,              -- '1on1' | 'group'
  system_topic_id    UUID REFERENCES system_topics(id),   -- 1on1 only
  custom_topic       TEXT,                       -- group only
  custom_description TEXT,                       -- group only
  category_id        UUID REFERENCES interest_categories(id),
  created_by         UUID REFERENCES users(id),  -- group creator
  cap                INT,                        -- group only (max participants)
  status             TEXT NOT NULL DEFAULT 'waiting',  -- 'waiting' | 'active' | 'ended'
  has_ai             BOOLEAN NOT NULL DEFAULT FALSE,
  is_public          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  ended_at           TIMESTAMPTZ
);
```

### 5.6 `participants`

Tracks all participants (human and AI) across all rooms, with join and leave timestamps.

```sql
CREATE TABLE participants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id),   -- NULL if is_ai
  is_ai     BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at   TIMESTAMPTZ
);
```

### 5.7 `messages`

All messages across all rooms. AI messages have `sender_id = NULL` and `is_ai = TRUE`.

```sql
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES users(id),   -- NULL if is_ai
  is_ai      BOOLEAN NOT NULL DEFAULT FALSE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX messages_room_id_idx ON messages (room_id, created_at);
```

### 5.8 `join_requests`

Group room join requests, managed by the room creator.

```sql
CREATE TABLE join_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  status     TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);
```

### 5.9 `conversation_digests`

AI-generated structured summary for each ended room. One record per room.

```sql
CREATE TABLE conversation_digests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID UNIQUE NOT NULL REFERENCES rooms(id),
  summary             TEXT NOT NULL,         -- 3-sentence summary
  user1_position      TEXT NOT NULL,         -- main stance of participant 1
  user2_position      TEXT NOT NULL,         -- main stance of participant 2 or AI
  unresolved_question TEXT NOT NULL,         -- best open question from the chat
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.10 `argument_maps`

AI-extracted logical structure of a 1-on-1 conversation, stored as JSONB. The `data` field contains the full argument graph including nodes, edges, participant metadata, and the central question.

```sql
CREATE TABLE argument_maps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID UNIQUE NOT NULL REFERENCES rooms(id),
  data       JSONB NOT NULL,   -- see Section 8.5 for full schema
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.11 `saved_conversations`

When a user opts to save a 1-on-1 conversation to their profile history after the chat ends.

```sql
CREATE TABLE saved_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);
```

### 5.12 `conversation_starters`

Three AI-generated opening questions per group room, created immediately after room creation.

```sql
CREATE TABLE conversation_starters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID UNIQUE NOT NULL REFERENCES rooms(id),
  questions  TEXT[] NOT NULL,   -- always length 3
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.13 `watched_topics`

Users can watch system topics. When another user enters the queue for a watched topic, the watcher receives a real-time socket notification.

```sql
CREATE TABLE watched_topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id   UUID NOT NULL REFERENCES system_topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic_id)
);
```

### 5.14 `email_logs`

Records of all outbound transactional emails for audit and deduplication.

```sql
CREATE TABLE email_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,   -- 'join_approved' | 'watchlist_match' | 'weekly_digest'
  status     TEXT NOT NULL DEFAULT 'sent',   -- 'sent' | 'failed'
  sent_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.15 Full-text Search Indexes

No new tables required. GIN indexes on existing tables enable fast PostgreSQL full-text search.

```sql
-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- System topics FTS index
ALTER TABLE system_topics ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || description)
  ) STORED;
CREATE INDEX system_topics_fts_idx ON system_topics USING GIN (search_vector);

-- Group rooms FTS index
ALTER TABLE rooms ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(custom_topic, '') || ' ' || COALESCE(custom_description, ''))
  ) STORED;
CREATE INDEX rooms_fts_idx ON rooms USING GIN (search_vector);

-- Trigram index for partial/fuzzy matching
CREATE INDEX system_topics_trgm_idx ON system_topics USING GIN (title gin_trgm_ops);
```

### 5.16 Redis Key Schema

Ephemeral state managed in Upstash Redis. Not persisted to PostgreSQL.

| Key pattern | Type | Value | TTL |
|---|---|---|---|
| `queue:{topicId}` | List | JSON `{ userId, socketId, joinedAt }` | None (manual pop) |
| `socket:{socketId}` | String | JSON `{ userId, roomId }` | 24h |
| `fallback:{socketId}` | String | Timer reference string | 35s |
| `trending:cache` | String | JSON array of trending topic IDs | 15 min |
| `ratelimit:{userId}:{route}` | Sorted Set | Timestamp scores (sliding window) | 60s window |

---

## 6. API Reference

All endpoints require authentication unless marked `[public]`. Auth is handled via Supabase JWT sent as a Bearer token in the `Authorization` header.

### Auth

| Method | Path | Description | Body |
|---|---|---|---|
| POST | `/api/auth/register` | Create account + generate interest embedding | `{ email, username, password, categoryIds: string[] }` |
| GET | `/api/auth/session` | Get current session | — |
| POST | `/api/auth/logout` | Invalidate session | — |

### Users

| Method | Path | Description | Body / Query |
|---|---|---|---|
| GET | `/api/users/me` | Own profile with interests | — |
| PATCH | `/api/users/me` | Update bio or avatar | `{ bio?, avatarUrl? }` |
| GET | `/api/users/:id` `[public]` | Public profile | — |
| PATCH | `/api/interests` | Update interest categories, re-embed | `{ categoryIds: string[] }` |

### Interest Categories

| Method | Path | Description |
|---|---|---|
| GET | `/api/interests/categories` `[public]` | List all categories with slugs and icons |

### System Topics

| Method | Path | Description | Query |
|---|---|---|---|
| GET | `/api/topics` `[public]` | Browse system topics | `?category=&q=&page=&limit=` |
| GET | `/api/topics/:id` `[public]` | Single topic with category | — |
| GET | `/api/topics/trending` `[public]` | Top 10 most active topics (48h window, Redis-cached 15 min) | — |
| POST | `/api/topics/:id/watch` | Watch a topic for live notifications | — |
| DELETE | `/api/topics/:id/watch` | Unwatch a topic | — |
| GET | `/api/topics/watched` | All topics the current user is watching | — |

### Group Rooms

| Method | Path | Description | Body / Query |
|---|---|---|---|
| GET | `/api/rooms` `[public]` | Browse active group rooms | `?category=&status=&page=&limit=` |
| POST | `/api/rooms` | Create group room + trigger async starter generation | `{ customTopic, customDescription, categoryId, cap }` |
| GET | `/api/rooms/:id` `[public]` | Room detail with participant count | — |
| DELETE | `/api/rooms/:id` | End room (creator only) | — |
| GET | `/api/rooms/:id/messages` | Paginated message history | `?cursor=&limit=` |
| POST | `/api/rooms/:id/join-request` | Request to join group room | — |
| GET | `/api/rooms/:id/join-requests` | List pending requests (creator only) | — |
| PATCH | `/api/rooms/:id/join-requests/:reqId` | Approve or reject request | `{ status: 'approved' \| 'rejected' }` |

### Matchmaking

| Method | Path | Description | Body |
|---|---|---|---|
| POST | `/api/matchmaking/enter` | Enter 1-on-1 queue for a topic | `{ topicId: string }` |
| DELETE | `/api/matchmaking/leave` | Leave queue + cancel fallback timer | — |
| GET | `/api/matchmaking/status` | Current queue status for current user | — |

### Conversations

| Method | Path | Description |
|---|---|---|
| GET | `/api/conversations` | All saved conversations for current user |
| GET | `/api/conversations/:roomId` | Full transcript + digest + argument map |
| POST | `/api/conversations/:roomId/save` | Save conversation to profile |
| GET | `/api/conversations/:roomId/digest` | AI digest for a specific room |
| GET | `/api/conversations/:roomId/map` | Argument map data (JSONB) |
| PATCH | `/api/conversations/:roomId/publish` | Toggle public visibility of a conversation |

### Public Debates

| Method | Path | Description | Query |
|---|---|---|---|
| GET | `/api/debates` `[public]` | Browse public debate transcripts | `?category=&page=&limit=` |
| GET | `/api/debates/:roomId` `[public]` | Single public debate with digest | — |

### Search

| Method | Path | Description | Query |
|---|---|---|---|
| GET | `/api/search` `[public]` | Full-text search across topics, rooms, and public debates | `?q=&type=all\|topics\|rooms\|debates&page=` |

### Admin (role: admin required)

| Method | Path | Description | Body |
|---|---|---|---|
| GET | `/api/admin/stats` | Platform stats: users, conversations, active rooms | — |
| GET | `/api/admin/topics` | All system topics | — |
| POST | `/api/admin/topics` | Create system topic + generate embedding | `{ title, description, categoryId }` |
| PATCH | `/api/admin/topics/:id` | Edit topic + re-embed if content changed | `{ title?, description?, categoryId? }` |
| DELETE | `/api/admin/topics/:id` | Delete system topic | — |
| GET | `/api/admin/users` | User list with roles and stats | `?page=&limit=` |
| PATCH | `/api/admin/users/:id` | Update user role or suspend | `{ role?, suspended? }` |
| GET | `/api/admin/rooms` | All rooms with status | `?status=&page=` |
| DELETE | `/api/admin/rooms/:id` | Force-end any room | — |

---

## 7. Socket Event Reference

The Socket.io server runs on the Express process. Clients connect with their Supabase JWT for authentication. All events are on the default namespace.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join_room` | `{ roomId: string }` | Join an existing room, request full state |
| `leave_room` | `{ roomId: string }` | Leave a room voluntarily |
| `send_message` | `{ roomId: string, content: string }` | Send a chat message |
| `typing_start` | `{ roomId: string }` | Broadcast typing indicator to others |
| `typing_stop` | `{ roomId: string }` | Hide typing indicator |
| `queue_enter` | `{ topicId: string }` | Enter 1-on-1 matchmaking queue |
| `queue_leave` | `{ topicId: string }` | Leave matchmaking queue |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `room_joined` | `{ room, participants, messages, starters? }` | Full room state on join |
| `user_joined` | `{ user: User }` | Another participant joined the room |
| `user_left` | `{ userId: string }` | A participant left |
| `new_message` | `{ message: Message }` | A human sent a message |
| `ai_chunk` | `{ messageId: string, chunk: string }` | One streamed token from Groq |
| `ai_done` | `{ messageId: string }` | AI stream complete — persist message |
| `typing` | `{ userId: string }` | A user started typing |
| `stopped_typing` | `{ userId: string }` | A user stopped typing |
| `match_found` | `{ roomId: string, topicTitle: string }` | Human match — redirect client to room |
| `ai_joining` | `{ roomId: string }` | 30 s elapsed, AI fallback is starting |
| `room_ended` | `{ roomId: string }` | Room was closed by creator or timeout |
| `new_join_request` | `{ request: JoinRequest }` | Notify group room creator |
| `join_request_update` | `{ status: string, roomId: string }` | Request was approved or rejected |
| `watched_topic_active` | `{ topicId: string, topicTitle: string }` | Someone entered queue for a watched topic |

---

## 8. AI Feature Specifications

### 8.1 Semantic Matchmaking

**APIs used:** Gemini `text-embedding-004` (768 dimensions), pgvector  
**Trigger:** User enters 1-on-1 matchmaking queue  
**Resume signal:** Vector embeddings, pgvector, semantic search, cosine similarity

#### Concept

User interest profiles and system topics are represented as 768-dimensional vectors. Matching uses cosine similarity rather than exact tag matching, so a user interested in "free will" gets matched with a user interested in "determinism" even if their chosen tags differ. pgvector performs this similarity search natively inside PostgreSQL.

#### Step 1 — Embed all system topics (one-time seed script)

```typescript
// prisma/seed.ts
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model  = genAI.getGenerativeModel({ model: "text-embedding-004" });

const topics = await prisma.systemTopic.findMany();
for (const topic of topics) {
  const result = await model.embedContent(`${topic.title}: ${topic.description}`);
  await prisma.$executeRaw`
    UPDATE system_topics
    SET    embedding = ${JSON.stringify(result.embedding.values)}::vector
    WHERE  id        = ${topic.id}::uuid
  `;
}
```

#### Step 2 — Embed user on signup and on interest update

```typescript
// server/services/embedUser.ts
export async function updateUserEmbedding(userId: string): Promise<void> {
  const interests = await prisma.userInterest.findMany({
    where:   { userId },
    include: { category: true },
    orderBy: { weight: "desc" },
  });

  const interestStr = interests
    .map(i => `${i.category.name} (weight: ${i.weight.toFixed(1)})`)
    .join(", ");

  const result = await model.embedContent(`Intellectual interests: ${interestStr}`);

  await prisma.$executeRaw`
    UPDATE users
    SET    interest_vec = ${JSON.stringify(result.embedding.values)}::vector,
           updated_at   = NOW()
    WHERE  id           = ${userId}::uuid
  `;
}
```

#### Step 3 — Semantic match query using pgvector cosine operator

```typescript
// server/services/matchmaking.ts
export async function findBestMatch(
  topicId: string,
  currentUserId: string
): Promise<{ id: string; username: string; socketId: string } | null> {

  // Fetch all users waiting in Redis queue for this topic
  const queueRaw     = await redis.lrange(`queue:${topicId}`, 0, -1);
  const queueMembers = queueRaw.map(m => JSON.parse(m));
  const candidateIds = queueMembers
    .filter(m => m.userId !== currentUserId)
    .map(m => m.userId);

  if (candidateIds.length === 0) return null;

  // Fetch current user's interest vector
  const [me] = await prisma.$queryRaw<{ interest_vec: string }[]>`
    SELECT interest_vec FROM users WHERE id = ${currentUserId}::uuid
  `;

  // Find the semantically closest candidate using cosine distance (<=>)
  const [match] = await prisma.$queryRaw<{ id: string; username: string }[]>`
    SELECT id, username
    FROM   users
    WHERE  id = ANY(${candidateIds}::uuid[])
    ORDER  BY interest_vec <=> ${me.interest_vec}::vector
    LIMIT  1
  `;

  if (!match) return null;

  const socketId = queueMembers.find(m => m.userId === match.id)?.socketId;
  return { ...match, socketId };
}
```

#### Step 4 — Queue management and match creation

```typescript
// server/socket/matchmaking.ts
socket.on("queue_enter", async ({ topicId }) => {
  const match = await findBestMatch(topicId, userId);

  if (match) {
    // Human match found
    const room = await prisma.room.create({
      data: { type: "1on1", systemTopicId: topicId, status: "active" }
    });
    await prisma.participant.createMany({
      data: [{ roomId: room.id, userId }, { roomId: room.id, userId: match.id }]
    });
    // Increment interest weight for both users
    await incrementInterestWeight(userId, topicId);
    await incrementInterestWeight(match.id, topicId);

    socket.emit("match_found", { roomId: room.id });
    io.to(match.socketId).emit("match_found", { roomId: room.id });

    // Remove both from queue
    await redis.lrem(`queue:${topicId}`, 1, JSON.stringify({ userId: match.id, socketId: match.socketId }));
    return;
  }

  // No match — push to queue
  await redis.rpush(`queue:${topicId}`, JSON.stringify({ userId, socketId: socket.id, joinedAt: Date.now() }));

  // Start 30 s fallback timer
  const timerId = setTimeout(() => triggerAiFallback(socket, userId, topicId), 30_000);
  await redis.set(`fallback:${socket.id}`, String(timerId), "EX", 35);

  // Notify watchers
  await notifyTopicWatchers(topicId, userId);
});
```

---

### 8.2 AI Fallback Partner

**API used:** Groq `llama-3.3-70b-versatile` with streaming  
**Trigger:** 30 seconds elapse in the matchmaking queue with no human match  
**Resume signal:** LLM streaming, SSE-to-WebSocket bridging, context-aware prompting

#### Concept

When no human match is found within 30 seconds, the system creates a room with an AI participant and begins streaming responses to the user's messages via Socket.io. The key engineering challenge is bridging Groq's server-sent event (SSE) stream into Socket.io emissions in real time.

#### Implementation

```typescript
// server/ai/groq.ts
export async function streamGroqResponse(
  socket: Socket,
  room: Room,
  topic: SystemTopic,
  userInterests: string[],
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<void> {
  const messageId = crypto.randomUUID();

  const stream = await groq.chat.completions.create({
    model:  "llama-3.3-70b-versatile",
    stream: true,
    messages: [
      {
        role:    "system",
        content: `You are a curious, thoughtful conversation partner engaged in a genuine dialogue.
Topic: "${topic.title}". ${topic.description}
The person's intellectual interests include: ${userInterests.join(", ")}.
Guidelines:
- Be conversational, not academic. 2–4 sentences per response.
- Ask a follow-up question when natural.
- Share your own perspective — don't just ask questions.
- Disagree respectfully when you have a different view.
- Be a curious equal, not a teacher or assistant.`
      },
      ...conversationHistory,
    ],
  });

  let fullMessage = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (!text) continue;
    fullMessage += text;
    socket.emit("ai_chunk", { messageId, chunk: text });
  }

  socket.emit("ai_done", { messageId });

  await prisma.message.create({
    data: { roomId: room.id, isAi: true, content: fullMessage },
  });
}
```

---

### 8.3 Post-chat Digest

**API used:** Gemini `2.0 Flash`  
**Trigger:** Room status changes to `ended` (both 1-on-1 human and AI fallback rooms)  
**Resume signal:** Structured LLM output, JSON prompt engineering, async event-driven processing

#### Concept

On room end, all messages are fetched, a numbered transcript is built, and Gemini is prompted to return a strict JSON object. The response is stripped of any markdown fences before parsing to handle model output variability.

#### Implementation

```typescript
// server/ai/digest.ts
export async function generateDigest(roomId: string): Promise<void> {
  const room = await prisma.room.findUnique({
    where:   { id: roomId },
    include: {
      systemTopic:  true,
      participants: { include: { user: true } },
    },
  });

  const messages = await prisma.message.findMany({
    where:   { roomId },
    orderBy: { createdAt: "asc" },
    include: { sender: true },
  });

  const transcript = messages
    .map((m, i) => `[${i + 1}] ${m.isAi ? "AI" : m.sender!.username}: ${m.content}`)
    .join("\n");

  const topicTitle = room!.systemTopic?.title ?? room!.customTopic ?? "Unknown topic";
  const p1 = room!.participants[0]?.user?.username ?? "Participant 1";
  const p2 = room!.hasAi ? "AI" : (room!.participants[1]?.user?.username ?? "Participant 2");

  const prompt = `Analyze this intellectual conversation about "${topicTitle}".

Return ONLY valid JSON — no markdown, no explanation, no backticks:
{
  "summary": "3-sentence neutral summary of what was discussed and how it developed",
  "user1_position": "the main stance or view consistently expressed by ${p1}",
  "user2_position": "the main stance or view consistently expressed by ${p2}",
  "unresolved_question": "the single most interesting question the conversation left open"
}

Conversation transcript:
${transcript}`;

  const result = await gemini.generateContent(prompt);
  const raw    = result.response.text()
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  const digest = JSON.parse(raw);

  await prisma.conversationDigest.create({
    data: { roomId, ...digest },
  });
}
```

---

### 8.4 Conversation Starters

**API used:** Gemini `2.0 Flash`  
**Trigger:** Group room creation (fired async — does not block room creation response)  
**Resume signal:** Context-aware generation, fire-and-forget async patterns

#### Concept

Three opening questions are generated immediately after a group room is created. They appear in the room sidebar as clickable chips that pre-fill the message input, lowering the barrier to starting the conversation.

#### Implementation

```typescript
// server/ai/starters.ts
export async function generateStarters(
  room: Room,
  category: InterestCategory
): Promise<void> {
  const prompt = `Generate 3 thought-provoking opening questions for a group intellectual discussion.

Topic: "${room.customTopic}"
Description: "${room.customDescription ?? "none provided"}"
Category: ${category.name}

Requirements:
- Each question must be open-ended (not answerable with yes/no)
- Each should open a different angle of the topic
- Suitable for a group of adults with genuine intellectual curiosity
- Do not number the questions

Return ONLY a JSON array of exactly 3 strings. No markdown, no preamble.
Example format: ["Question one?", "Question two?", "Question three?"]`;

  const result    = await gemini.generateContent(prompt);
  const raw       = result.response.text()
    .replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
  const questions = JSON.parse(raw) as string[];

  await prisma.conversationStarter.create({
    data: { roomId: room.id, questions },
  });
}

// In POST /api/rooms — fire and forget:
// generateStarters(room, category).catch(err => console.error("Starters failed:", err));
```

---

### 8.5 Argument Mapper

**API used:** Gemini `2.0 Flash`  
**Trigger:** 1-on-1 room ends AND conversation has at least 10 messages  
**Frontend:** React Flow interactive graph  
**Resume signal:** Complex structured JSON extraction, graph data modeling, interactive data visualization

#### Concept

The argument mapper is the most distinctive feature of the platform. After a 1-on-1 conversation ends, Gemini analyzes the transcript and extracts the logical structure of the debate — claims, evidence, rebuttals, concessions, and agreements — as a directed graph. This is then rendered as an interactive, pannable, zoomable argument map using React Flow.

This is unique to Sokrates. No comparable platform surfaces the logical structure of a conversation. It is the feature most likely to generate organic sharing and media attention.

#### Argument Map JSON Schema (stored in `argument_maps.data`)

```typescript
type ArgumentMapData = {
  central_question: string;
  participants: Array<{
    id:       string;          // 'p1' | 'p2' | 'ai'
    username: string;
    color:    string;          // hex color for visual differentiation
  }>;
  nodes: Array<{
    id:          string;       // 'n1', 'n2', etc.
    type:        "claim" | "evidence" | "rebuttal" | "concession" | "agreement";
    participant: string;       // participant id
    content:     string;       // the actual text of the argument node
    parent?:     string;       // parent node id (null for root claims)
    relation?:   "supports" | "challenges" | "partially_agrees" | "acknowledges";
  }>;
};
```

#### Implementation

```typescript
// server/ai/argumentMap.ts
export async function generateArgumentMap(roomId: string): Promise<void> {
  const room = await prisma.room.findUnique({
    where:   { id: roomId },
    include: { systemTopic: true, participants: { include: { user: true } } },
  });

  if (!room || room.type !== "1on1") return;

  const messages = await prisma.message.findMany({
    where:   { roomId },
    orderBy: { createdAt: "asc" },
    include: { sender: true },
  });

  if (messages.length < 10) return; // not enough substance to map

  const transcript = messages
    .map(m => `${m.isAi ? "AI" : m.sender!.username}: ${m.content}`)
    .join("\n");

  const p1 = room.participants[0]?.user?.username ?? "Participant 1";
  const p2 = room.hasAi ? "AI" : (room.participants[1]?.user?.username ?? "Participant 2");

  const prompt = `Analyze this intellectual debate and extract its logical argument structure.

Return ONLY valid JSON with this exact shape — no markdown, no explanation:
{
  "central_question": "the core question or thesis the conversation revolves around",
  "participants": [
    { "id": "p1", "username": "${p1}", "color": "#818cf8" },
    { "id": "p2", "username": "${p2}", "color": "#2dd4bf" }
  ],
  "nodes": [
    {
      "id": "n1",
      "type": "claim",
      "participant": "p1",
      "content": "brief summary of the claim (1 sentence)",
      "parent": null,
      "relation": null
    },
    {
      "id": "n2",
      "type": "evidence",
      "participant": "p1",
      "content": "the supporting evidence or reasoning",
      "parent": "n1",
      "relation": "supports"
    }
  ]
}

Node types: "claim" (main argument), "evidence" (support for a claim), "rebuttal" (challenge to another node), "concession" (partial agreement), "agreement" (full agreement with another's point).
Relation types: "supports", "challenges", "partially_agrees", "acknowledges".
Extract 8–16 nodes. Prioritize the most substantive exchanges.

Conversation:
${transcript}`;

  const result = await gemini.generateContent(prompt);
  const raw    = result.response.text()
    .replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
  const data   = JSON.parse(raw);

  await prisma.argumentMap.create({ data: { roomId, data } });
}
```

#### Frontend Rendering (React Flow)

```typescript
// components/argument-map/ArgumentMapViewer.tsx
import ReactFlow, { Node, Edge, Background, Controls } from "reactflow";

const NODE_TYPE_ICONS = {
  claim:      "💡",
  evidence:   "📚",
  rebuttal:   "⚡",
  concession: "🤝",
  agreement:  "✅",
};

const RELATION_COLORS = {
  supports:        "#4ade80",
  challenges:      "#f87171",
  partially_agrees:"#fbbf24",
  acknowledges:    "#94a3b8",
};

export function ArgumentMapViewer({ data }: { data: ArgumentMapData }) {
  const nodes: Node[] = data.nodes.map((n, i) => ({
    id:       n.id,
    position: { x: (i % 4) * 280, y: Math.floor(i / 4) * 180 },
    data: {
      label: (
        <div style={{ padding: 10, maxWidth: 220 }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>{NODE_TYPE_ICONS[n.type]}</div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: "uppercase" }}>
            {n.type} · {n.participant}
          </div>
          <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{n.content}</div>
        </div>
      ),
    },
    style: {
      background: data.participants.find(p => p.id === n.participant)?.color + "22",
      border:     `2px solid ${data.participants.find(p => p.id === n.participant)?.color}`,
      borderRadius: 8,
    },
  }));

  const edges: Edge[] = data.nodes
    .filter(n => n.parent && n.relation)
    .map(n => ({
      id:             `e-${n.parent}-${n.id}`,
      source:         n.parent!,
      target:         n.id,
      style:          { stroke: RELATION_COLORS[n.relation!] },
      label:          n.relation,
      labelStyle:     { fontSize: 10, fill: RELATION_COLORS[n.relation!] },
      animated:       n.relation === "challenges",
    }));

  return (
    <div style={{ height: 600, borderRadius: 12, overflow: "hidden", border: "1px solid #1e2435" }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background color="#1e2435" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

---

## 9. Additional Feature Specifications

### 9.1 Public Debate Showcase

**Trigger:** Either participant in a 1-on-1 room clicks "Make public" after the chat ends  
**UI:** `/debates` browse page and `/debates/:id` single transcript page

When a room is made public (`rooms.is_public = true`), it appears in the public debate feed alongside its AI-generated digest. The full transcript is readable by anyone. A shareable URL (`/debates/:roomId`) is generated and copyable from the transcript page. Participant usernames are shown unless either user has requested anonymity, in which case they appear as "Participant A / Participant B".

The public debate feed is the primary growth mechanism of the platform — interesting conversations spread on social media and draw new users in.

### 9.2 Topic Watchlist + Live Notifications

**Tables:** `watched_topics`  
**Socket event:** `watched_topic_active`

Users can watch any system topic from its detail page. When any user enters the matchmaking queue for a watched topic, all watchers who are currently online receive a `watched_topic_active` socket event containing the topic ID and title. This renders as a toast notification: "Someone just entered the queue for [topic] — join now?" with a direct link to the topic page.

For offline watchers, queue this as an email notification (see Section 9.5) to be sent at most once per hour per topic to avoid spam.

```typescript
// server/services/matchmaking.ts
async function notifyTopicWatchers(topicId: string, triggerUserId: string): Promise<void> {
  const watchers = await prisma.watchedTopic.findMany({
    where: { topicId, userId: { not: triggerUserId } },
    select: { userId: true },
  });

  for (const { userId } of watchers) {
    const socketId = await redis.get(`user_socket:${userId}`);
    if (socketId) {
      io.to(socketId).emit("watched_topic_active", { topicId });
    }
  }
}
```

### 9.3 Trending Topics

**Trigger:** Computed on request, cached in Redis for 15 minutes  
**UI:** Displayed on home feed as a "Trending" section with conversation count badges

Trending is defined as the 10 system topics with the most completed 1-on-1 conversations in the past 48 hours.

```sql
-- Trending topics query
SELECT
  st.id,
  st.title,
  st.category_id,
  COUNT(r.id) AS conversation_count
FROM system_topics st
JOIN rooms r ON r.system_topic_id = st.id
WHERE r.type      = '1on1'
  AND r.status    = 'ended'
  AND r.ended_at  > NOW() - INTERVAL '48 hours'
GROUP BY st.id, st.title, st.category_id
ORDER BY conversation_count DESC
LIMIT 10;
```

```typescript
// api/topics/trending/route.ts
const CACHE_KEY = "trending:cache";
const CACHE_TTL = 60 * 15; // 15 minutes

export async function GET() {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return Response.json(JSON.parse(cached));

  const trending = await prisma.$queryRaw`...`; // query above
  await redis.set(CACHE_KEY, JSON.stringify(trending), "EX", CACHE_TTL);
  return Response.json(trending);
}
```

### 9.4 Rate Limiting

**Library:** `rate-limiter-flexible` backed by Upstash Redis  
**Strategy:** Sliding window per user ID (authenticated) or IP (unauthenticated)

Rate limits are applied as Express middleware on all API routes and Socket.io connection events.

| Route group | Limit | Window |
|---|---|---|
| Auth endpoints | 10 requests | 15 minutes |
| Matchmaking queue enter | 20 requests | 1 hour |
| Message send | 60 messages | 1 minute |
| AI-triggering endpoints (digest, map) | 5 requests | 1 hour |
| All other API routes | 100 requests | 1 minute |

```typescript
// server/services/rateLimit.ts
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "../lib/redis";

export const apiLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix:   "ratelimit_api",
  points:      100,        // requests
  duration:    60,         // per 60 seconds
});

export function rateLimitMiddleware(limiter: RateLimiterRedis) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.user?.id ?? req.ip;
    try {
      await limiter.consume(key);
      next();
    } catch {
      res.status(429).json({ error: "Too many requests. Please slow down." });
    }
  };
}
```

### 9.5 Full-text Search

**Technology:** PostgreSQL `tsvector` with GIN indexes + `pg_trgm` for fuzzy matching  
**UI:** Global search bar in nav, dedicated `/search` results page

Search covers three content types:

- **System topics** — ranked by relevance to query
- **Group rooms** — active rooms matching the query  
- **Public debates** — public transcripts matching topic title or digest summary

```typescript
// api/search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q    = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "all";

  const results: SearchResults = { topics: [], rooms: [], debates: [] };

  if (type === "all" || type === "topics") {
    results.topics = await prisma.$queryRaw`
      SELECT id, title, description,
             ts_rank(search_vector, plainto_tsquery('english', ${q})) AS rank
      FROM   system_topics
      WHERE  search_vector @@ plainto_tsquery('english', ${q})
          OR title % ${q}
      ORDER  BY rank DESC
      LIMIT  10
    `;
  }

  if (type === "all" || type === "rooms") {
    results.rooms = await prisma.$queryRaw`
      SELECT id, custom_topic, custom_description, status
      FROM   rooms
      WHERE  type      = 'group'
        AND  status    != 'ended'
        AND  (search_vector @@ plainto_tsquery('english', ${q})
              OR custom_topic % ${q})
      LIMIT  10
    `;
  }

  if (type === "all" || type === "debates") {
    results.debates = await prisma.$queryRaw`
      SELECT r.id, st.title, cd.summary
      FROM   rooms r
      JOIN   system_topics st       ON st.id = r.system_topic_id
      JOIN   conversation_digests cd ON cd.room_id = r.id
      WHERE  r.is_public = TRUE
        AND  st.title % ${q}
      LIMIT  10
    `;
  }

  return Response.json(results);
}
```

### 9.6 Email Notifications

**Service:** Resend (free tier — 3,000 emails/month)  
**Templates:** Three email types, all sent as HTML emails with plain-text fallbacks

| Email type | Trigger | Content |
|---|---|---|
| `join_approved` | Creator approves a join request | Room topic, direct link to join |
| `watchlist_match` | Someone enters queue for watched topic (user offline) | Topic title, CTA to enter queue |
| `weekly_digest` | Every Sunday at 9am UTC (cron job) | Summary of the week's saved conversations |

```typescript
// server/services/email.ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendJoinApproved(user: User, room: Room): Promise<void> {
  await resend.emails.send({
    from:    "Sokrates <noreply@sokrates.app>",
    to:      user.email,
    subject: `You're in — "${room.customTopic}"`,
    html: `
      <h2>Your request was approved</h2>
      <p>You can now join the discussion on <strong>${room.customTopic}</strong>.</p>
      <a href="${process.env.NEXT_PUBLIC_URL}/rooms/${room.id}">Join the room →</a>
    `,
  });

  await prisma.emailLog.create({
    data: { userId: user.id, type: "join_approved", status: "sent" },
  });
}
```

### 9.7 Progressive Web App (PWA)

**Library:** `next-pwa`  
**Configuration:** `next.config.ts`

Adding PWA support makes Sokrates installable on mobile and desktop, adds an offline fallback page, and enables push notifications in a future iteration. Implementation is a configuration change — no new UI components required beyond the offline fallback page.

```typescript
// next.config.ts
import withPWA from "next-pwa";

export default withPWA({
  dest:            "public",
  register:        true,
  skipWaiting:     true,
  disable:         process.env.NODE_ENV === "development",
})({
  // rest of Next.js config
});
```

```json
// public/manifest.json
{
  "name": "Sokrates",
  "short_name": "Sokrates",
  "description": "Intellectual conversations with strangers",
  "start_url": "/feed",
  "display": "standalone",
  "background_color": "#0d0f18",
  "theme_color": "#818cf8",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 9.8 Admin Dashboard

**Access control:** `users.role = 'admin'`  
**Route guard:** Middleware on all `/admin/*` routes checking role  
**UI:** Protected section at `/admin`

The admin dashboard provides four views:

**Stats overview (`/admin`):** Total users, total conversations, active rooms right now, conversations in the last 24h/7d, most active topics of the week, average conversation length.

**Topic management (`/admin/topics`):** Full CRUD for system topics. Creating or editing a topic re-runs the Gemini embedding pipeline automatically. Topics cannot be deleted if they have associated rooms — they can only be archived.

**User management (`/admin/users`):** Table of all users with join date, conversation count, and role. Admin can promote a user to admin role or suspend an account (suspended users cannot log in and receive a clear error message).

**Room management (`/admin/rooms`):** Table of all rooms with status. Admin can force-end any active room, which triggers the normal room-end pipeline (digest generation, save prompt). Useful for moderation.

```typescript
// middleware.ts (Next.js middleware for admin route protection)
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const token = request.cookies.get("sb-auth-token");
    if (!token) return NextResponse.redirect(new URL("/login", request.url));

    // Role check happens in the layout component via Supabase session
    // Middleware only checks that a session exists
  }
}
```

---

## 10. Build Plan

Total estimated duration: **14 weeks**. Phases are designed so each builds on the previous — do not reorder them.

---

### Phase 0 — Foundation (Week 1)

**Goal:** Working repository with database, auth, and infrastructure in place. No UI yet.

| # | Task |
|---|---|
| 1 | Create GitHub repository (public — this is a portfolio project) |
| 2 | `npx create-next-app@latest sokrates --typescript --tailwind --app` |
| 3 | Create Supabase project, copy connection string |
| 4 | Open Supabase SQL editor, run: `CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm;` |
| 5 | Create Upstash Redis database, copy REST URL and token |
| 6 | `npm install prisma @prisma/client`, run `npx prisma init`, write `schema.prisma` |
| 7 | Run `npx prisma migrate dev --name init` to create all tables |
| 8 | Set up Supabase Auth: enable Google and GitHub providers in Supabase dashboard |
| 9 | Create `/server` directory with `package.json`, install Express, Socket.io, Prisma, ioredis |
| 10 | Create `.env.local` with all environment variables (see Section 12) |
| 11 | Write Prisma seed script for `interest_categories` (10 categories) and `system_topics` (20 topics) |
| 12 | Run `npx prisma db seed` — verify data in Supabase dashboard |

---

### Phase 1 — Auth + Interest Profile (Week 2)

**Goal:** Users can register, log in with Google/GitHub, and set their interest profile. Gemini embeds their interests on save.

| # | Task |
|---|---|
| 1 | Register page: email/password form → Supabase `signUp()` → redirect to interest picker |
| 2 | Interest picker: 3-column grid of category cards with icon + name, multi-select |
| 3 | On interests submit: POST `/api/interests` → save `user_interests` records → call `updateUserEmbedding()` → redirect to feed |
| 4 | Login page: email/password + Google OAuth button (Supabase Auth handles OAuth callback) |
| 5 | Supabase Auth callback route: `app/auth/callback/route.ts` |
| 6 | Auth middleware: protect all `/app/(main)` routes, redirect unauthenticated users to `/login` |
| 7 | Profile page: avatar, username, bio, interest category badges, "Past Conversations" section (empty state for now) |
| 8 | PATCH `/api/users/me`: update bio/avatar, re-embed on interest change |
| 9 | Connect Supabase Storage for avatar uploads (drag-and-drop or file picker) |
| 10 | Implement `updateUserEmbedding()` using Gemini `text-embedding-004` |

---

### Phase 2 — Group Rooms + Feed (Weeks 3–4)

**Goal:** Users can create and join group rooms with live chat. Home feed is populated. Trending and search are scaffolded.

**Week 3**

| # | Task |
|---|---|
| 1 | Home feed page: two tabs — "Browse Rooms" and "Explore Topics" |
| 2 | Room card component: topic, category badge, `X / cap` member count, creator avatar, status pill |
| 3 | Create room page: title field, description textarea, category picker, cap slider (2–20) |
| 4 | POST `/api/rooms`: create room, then fire-and-forget `generateStarters()` |
| 5 | GET `/api/rooms`: list active group rooms with pagination |
| 6 | Group room page layout: chat area (left 70%), sidebar (right 30%) |
| 7 | Sidebar contents: topic title, category, participant list, AI starters chips |
| 8 | Starters chips: clicking pre-fills the message input field |

**Week 4**

| # | Task |
|---|---|
| 9 | Set up Express server with Socket.io in `/server/index.ts` |
| 10 | `useSocket()` hook: manages connect/disconnect, token auth, reconnection |
| 11 | Socket events: `join_room`, `leave_room`, `send_message`, `new_message`, `user_joined`, `user_left` |
| 12 | Typing indicators: `typing_start` / `typing_stop` with debounced client emit |
| 13 | Join request flow: "Request to Join" button → pending state → creator gets `new_join_request` event → approve/reject UI |
| 14 | `join_request_update` event → notify requester → unlock room access |
| 15 | Trending topics query + Redis caching (15 min) → display on home feed |
| 16 | Full-text search: GIN index migration, GET `/api/search`, search results page |

---

### Phase 3 — 1-on-1 Matchmaking + Watchlist (Weeks 5–6)

**Goal:** Full 1-on-1 flow from topic selection through matched chat. Topic watchlist with real-time notifications.

**Week 5**

| # | Task |
|---|---|
| 1 | System topics browse page: category filter chips, topic cards, "Watch" toggle button |
| 2 | Topic detail page: title, full description, category, "Start a Conversation" CTA |
| 3 | POST `/api/matchmaking/enter`: push user to Redis queue |
| 4 | Basic FIFO matching first (semantic matching added in Phase 4) |
| 5 | On match: create room, create participant records, emit `match_found` to both users |
| 6 | 30-second `setTimeout` fallback timer (no AI yet — just a waiting state) |
| 7 | `match_found` handler on client: redirect to 1-on-1 room page |

**Week 6**

| # | Task |
|---|---|
| 8 | 1-on-1 room page: clean layout — chat area, topic header, partner name/avatar |
| 9 | Room end: both users see "Save this conversation?" modal independently |
| 10 | POST `/api/conversations/:roomId/save` → save to `saved_conversations` |
| 11 | DELETE `/api/matchmaking/leave`: remove from Redis queue, clear fallback timer |
| 12 | Watchlist: POST/DELETE `/api/topics/:id/watch` → `watched_topics` table |
| 13 | `notifyTopicWatchers()`: on queue entry, emit `watched_topic_active` to online watchers |
| 14 | `watched_topic_active` client handler: render toast with link to join queue |
| 15 | Offline watcher email notification (queued, max 1/hr per topic per user) |

---

### Phase 4 — Core AI Features (Weeks 7–9)

**Goal:** All four core AI features operational. Matching is now semantic. AI fallback streams Groq responses.

**Week 7 — Semantic Matchmaking**

| # | Task |
|---|---|
| 1 | Install `@google/generative-ai`, create `server/ai/gemini.ts` |
| 2 | Run embedding seed script: embed all 20 system topics, update `embedding` column |
| 3 | Run `npx prisma migrate dev` to add HNSW index on `system_topics.embedding` |
| 4 | Add HNSW index on `users.interest_vec` |
| 5 | Replace FIFO matchmaking with `findBestMatch()` using pgvector cosine query |
| 6 | Update `POST /api/interests` and `POST /api/auth/register` to call `updateUserEmbedding()` |
| 7 | Update `user_interests.weight` increment on room join |
| 8 | Test semantic matching with 3+ test accounts across related interest profiles |

**Week 8 — AI Fallback + Starters Display**

| # | Task |
|---|---|
| 9 | Install `groq-sdk`, create `server/ai/groq.ts` |
| 10 | `triggerAiFallback()`: after 30s, create room with `has_ai=true`, add AI participant |
| 11 | Emit `ai_joining` to client → client shows "No match found, AI joining..." state |
| 12 | `send_message` handler: if `room.hasAi`, call `streamGroqResponse()` |
| 13 | Emit `ai_chunk` per token, `ai_done` on stream complete |
| 14 | Client streaming UI: accumulate chunks in a temporary message bubble, commit on `ai_done` |
| 15 | Starters display in group room sidebar (data already generated — just render `conversation_starters`) |
| 16 | Starters click-to-fill: update message input value on chip click |

**Week 9 — Digest**

| # | Task |
|---|---|
| 17 | `generateDigest()`: build transcript, call Gemini, parse JSON, save to `conversation_digests` |
| 18 | Trigger digest generation on `room_ended` socket event (server-side) |
| 19 | GET `/api/conversations/:roomId/digest` |
| 20 | Profile page "Past Conversations": render digest cards with summary, position 1, position 2 |
| 21 | Expand digest card to show full transcript |
| 22 | Handle digest for AI fallback rooms (label AI participant correctly in positions) |

---

### Phase 5 — Advanced AI + Social Features (Weeks 10–11)

**Goal:** Argument mapper operational. Public debate showcase live.

**Week 10 — Argument Mapper**

| # | Task |
|---|---|
| 1 | `generateArgumentMap()`: call Gemini, extract structured JSON, save to `argument_maps` |
| 2 | Trigger on room end alongside digest (only for 1-on-1 rooms with ≥10 messages) |
| 3 | GET `/api/conversations/:roomId/map` |
| 4 | Install `reactflow` |
| 5 | `ArgumentMapViewer` component: convert JSONB to React Flow nodes and edges |
| 6 | Node styling: color by participant, icon by node type |
| 7 | Edge styling: color by relation type, animated edges for "challenges" relations |
| 8 | `/conversations/:id/map` page with fullscreen React Flow canvas |
| 9 | Link from conversation/profile page to argument map |

**Week 11 — Public Debate Showcase**

| # | Task |
|---|---|
| 10 | Add `is_public` toggle to "Save conversation?" modal |
| 11 | PATCH `/api/conversations/:roomId/publish`: toggle `rooms.is_public` |
| 12 | GET `/api/debates`: browse public debates, ordered by most recent |
| 13 | GET `/api/debates/:roomId`: single debate transcript + digest + argument map link |
| 14 | `/debates` browse page: cards with topic, participants (or anonymous), date, summary excerpt |
| 15 | `/debates/:id` page: full transcript rendered chronologically, digest panel, share button |
| 16 | Share button: copies `/debates/:id` URL to clipboard, shows "Copied!" toast |
| 17 | Anonymous option: checkbox on publish modal to replace usernames with "Participant A/B" |

---

### Phase 6 — Platform Features (Weeks 12–13)

**Goal:** Rate limiting, email notifications, and admin dashboard complete. PWA configured.

**Week 12**

| # | Task |
|---|---|
| 1 | Install `rate-limiter-flexible`, configure Redis-backed limiters for each route group |
| 2 | Apply rate limiter middleware to Express routes and Next.js API routes |
| 3 | Return correct `Retry-After` header on 429 responses |
| 4 | Weekly digest email: cron job (`node-cron` on Express server) runs Sunday 9am UTC |
| 5 | Weekly digest: fetch each user's saved conversations from past 7 days, render email template |
| 6 | Resend integration: `sendJoinApproved()`, `sendWatchlistMatch()`, `sendWeeklyDigest()` |
| 7 | `email_logs` records on every send, check logs before sending to prevent duplicates |

**Week 13**

| # | Task |
|---|---|
| 8 | Admin role: update Prisma schema, add `role` check middleware for `/api/admin/*` routes |
| 9 | Admin stats query: total users, conversations today/week, top 5 topics, avg message count |
| 10 | `/admin` stats page: metric cards, simple bar chart for daily conversations |
| 11 | `/admin/topics` CRUD: table with edit/delete, "New Topic" form that re-embeds on save |
| 12 | `/admin/users` table: username, email, join date, conversation count, role, suspend toggle |
| 13 | `/admin/rooms` table: room id, topic, status, participant count, force-end button |
| 14 | PWA: `next-pwa` config, `manifest.json`, 192px + 512px app icons |
| 15 | Offline fallback page: simple "You appear to be offline. Reconnecting..." page |

---

### Phase 7 — Polish + Deploy (Week 14)

**Goal:** Production-ready application deployed at a public URL.

| # | Task |
|---|---|
| 1 | Loading skeletons for feed, topic list, room page, profile (Tailwind `animate-pulse`) |
| 2 | Error boundaries on all pages — render helpful error states, not blank screens |
| 3 | Empty states for all list views (no rooms yet, no conversations, first-time user) |
| 4 | Toast notifications for all key events (match found, request approved, AI joining, etc.) |
| 5 | Mobile responsive: test at 375px width, fix all overflow and layout issues |
| 6 | Accessibility: ensure all interactive elements have keyboard focus states and ARIA labels |
| 7 | Push all code to GitHub, ensure repo is public |
| 8 | Vercel: connect GitHub repo → set all environment variables → deploy → get `.vercel.app` URL |
| 9 | Render: create new Web Service → connect GitHub repo (`/server` directory) → set env vars → deploy |
| 10 | Supabase: confirm all production env vars point to production Supabase project |
| 11 | Update `NEXT_PUBLIC_EXPRESS_URL` to point to Render URL |
| 12 | Configure CORS in Express: `origin: process.env.FRONTEND_URL` |
| 13 | Smoke test all six user flows: register, group chat, join request, 1-on-1 match, AI fallback, public debate |
| 14 | Optional: purchase domain ($10/yr Namecheap) → configure in Vercel → update Supabase Auth allowed URLs |

---

## 11. Deployment Guide

### 11.1 Supabase (Database + Auth + Storage)

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
3. Go to **Authentication → Providers** → enable Google and GitHub OAuth. Add client IDs and secrets from each provider's developer console.
4. Go to **Project Settings → Database** → copy the connection string (URI format). Use the **connection pooler** (port 6543) for Prisma.
5. Go to **Storage** → create a bucket named `avatars` with public access.
6. Run `npx prisma migrate deploy` to apply all migrations to the production database.
7. Run `npx prisma db seed` to populate categories and system topics.

### 11.2 Upstash Redis

1. Create a new Redis database at [upstash.com](https://upstash.com)
2. Copy the REST URL and REST token from the dashboard.
3. Use the `@upstash/redis` client in the application (REST-compatible, works in serverless environments).

### 11.3 Vercel (Next.js Frontend)

1. Push all code to GitHub.
2. Import the repository at [vercel.com](https://vercel.com).
3. Set the **Root Directory** to the project root.
4. Add all frontend environment variables (see Section 12).
5. Deploy. Vercel auto-deploys on every push to `main`.

### 11.4 Render (Express + Socket.io Server)

1. Create a new **Web Service** at [render.com](https://render.com).
2. Connect the GitHub repository.
3. Set **Root Directory** to `server`.
4. **Build command:** `npm install && npx prisma generate`
5. **Start command:** `node dist/index.js` (or `ts-node src/index.ts` for development)
6. Add all server environment variables (see Section 12).
7. Note: Free tier services on Render sleep after 15 minutes of inactivity. The first request after idle takes ~30 seconds. Upgrade to a paid plan when serving real users.

---

## 12. Environment Variables

### Next.js (`sokrates/.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (for Prisma in Next.js API routes)
DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# AI APIs
GEMINI_API_KEY=your-gemini-api-key

# Express server
NEXT_PUBLIC_EXPRESS_URL=http://localhost:4000   # or Render URL in production

# App
NEXT_PUBLIC_URL=http://localhost:3000           # or Vercel URL in production

# Resend
RESEND_API_KEY=your-resend-api-key
```

### Express Server (`server/.env`)

```env
# Database
DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# AI APIs
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key

# Supabase (for JWT verification)
SUPABASE_JWT_SECRET=your-jwt-secret

# Resend
RESEND_API_KEY=your-resend-api-key

# CORS
FRONTEND_URL=http://localhost:3000   # or Vercel URL in production

# Server
PORT=4000
NODE_ENV=development
```

---

*End of specification. Total tables: 14. Total API endpoints: 43. Total socket events: 20. Total AI integrations: 5. Estimated build time: 14 weeks.*
