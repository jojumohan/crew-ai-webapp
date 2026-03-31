# WhatsApp Clone Technical Blueprint

## 1. Product Goal

Build a high-performance web messaging platform that feels as immediate as WhatsApp Web while remaining flexible enough to support:

- private 1-to-1 messaging
- group chats
- media uploads
- presence, typing, read receipts, and last seen
- voice and video calls
- progressive rollout toward end-to-end encryption

The core engineering principle is simple: keep the server authoritative for delivery and state sync, but keep media and cryptographic workloads off the critical path whenever possible.

## 2. Recommended 2026 Tech Stack

### Frontend

- `Next.js 16` with App Router
- `React 19`
- `TypeScript`
- CSS Modules for controlled styling, with room to introduce a component library later
- `TanStack Query` for cache orchestration around chat lists, history pagination, and mutation retries

Why:

- Next.js gives a strong web platform baseline, good routing, and easy deployment.
- React 19 is a stable fit for highly interactive real-time UI.
- TypeScript keeps shared event contracts and message payloads reliable across frontend and backend.

### Backend

- `Node.js 22`
- `NestJS` or `Fastify` for the primary API
- `Socket.IO` for the first production real-time gateway
- `BullMQ` for async background jobs

Why:

- TypeScript end-to-end keeps development speed high during the first three phases.
- Socket.IO ships faster than raw `ws` because it includes rooms, acknowledgements, reconnection, and fallback behavior.
- Fastify or NestJS both scale well for a chat backend while keeping the codebase structured.

Recommended position:

- Ship the first production version in TypeScript.
- If traffic becomes very large, move the real-time gateway or media coordination layer into Go later without changing the product model.

### Data Layer

- `PostgreSQL` for users, conversations, memberships, messages, receipts, and calls
- `Redis` for presence, ephemeral typing signals, rate limits, socket fan-out, and job coordination
- `S3-compatible object storage` for attachments, voice notes, avatars, and call artifacts

Why:

- Chat systems have strong relational needs: memberships, delivery state, devices, and receipts are easier to model in PostgreSQL.
- Redis is ideal for short-lived state and horizontally scaled WebSocket coordination.
- Object storage keeps large media out of the database.

### Calls

- `LiveKit` SFU for voice/video from day one
- STUN/TURN managed through LiveKit

Why:

- P2P mesh is okay only for very small 1-to-1 experiments.
- Production calling becomes more stable with an SFU, especially for weak networks, multi-device sessions, and groups.

### Infra and Ops

- Docker-based local dev
- Vercel or Cloudflare for the web frontend
- Railway, Fly.io, Render, or Kubernetes for API and workers
- OpenTelemetry + Grafana/Loki/Tempo or a managed equivalent

## 3. Target System Architecture

### Core Services

1. `web-client`
Frontend app for login, chat UI, uploads, and calls.

2. `api-service`
Handles auth, conversation CRUD, pagination, uploads, contact management, and token issuance.

3. `realtime-gateway`
Owns WebSocket sessions, presence, typing, delivery fan-out, and message acknowledgements.

4. `worker-service`
Processes thumbnails, attachment scanning, notifications, dead-letter retries, and cleanup jobs.

5. `media-service`
Usually object storage plus signed upload URLs, optional transcoding, and attachment metadata validation.

6. `call-service`
LiveKit plus app-side signaling and token issuance.

### Data Flow for Messaging

1. Client sends a message mutation to the API with a client-generated id.
2. API validates membership, stores the message in PostgreSQL, and emits an event to the real-time layer.
3. Real-time gateway fans the event out to active recipients through Socket.IO rooms.
4. Offline recipients receive the message later through history sync and push notifications.
5. Client sends delivered and read acknowledgements, which update receipt tables and conversation summaries.

## 4. Real-Time Engine

### Recommendation

Use `Socket.IO` with the Redis adapter for MVP and early scale.

Why not raw `ws` first:

- `ws` is lighter, but you have to build reconnection semantics, room abstractions, ack patterns, and transport handling yourself.
- Socket.IO buys speed, reliability, and simpler horizontal scale early on.

### Rooms and Channels

- user room: all sockets for one user across multiple devices and tabs
- conversation room: active sockets participating in a conversation
- presence room: internal only, used for rapid status fan-out

### Real-Time Event Set

- `conversation:join`
- `message:create`
- `message:ack`
- `message:delivered`
- `message:read`
- `typing:start`
- `typing:stop`
- `presence:update`
- `call:incoming`
- `call:accept`
- `call:decline`
- `call:end`

### Presence Model

Store ephemeral presence in Redis:

- `presence:user:{userId}` with short TTL heartbeat
- `typing:{conversationId}:{userId}` with 5 to 8 second TTL

Online/offline:

- Socket connect updates heartbeat.
- Heartbeat refresh runs every few seconds.
- Expired key means offline.

Last seen:

- Persist durable `last_seen_at` in PostgreSQL when the final active socket disconnects or heartbeat expires.

### Delivery Reliability

- Use client-generated UUIDs for idempotent sends.
- Require server acknowledgements for send success.
- Persist before broadcast.
- Retry on reconnect using a sync cursor.

## 5. Voice and Video Integration

### Recommendation

Use `WebRTC` with `LiveKit` SFU from the start.

### Why SFU beats mesh for this product

- More stable for weak mobile tethering and hotel Wi-Fi.
- Better for group calls and screen sharing.
- Lower device CPU burn than multi-peer mesh.
- Easier call recording and moderation later.

### Call Lifecycle

1. Caller requests call creation from the API.
2. API validates conversation membership and creates a call record.
3. Server emits `call:incoming` over WebSocket.
4. Accepted users receive a LiveKit token.
5. Clients join the room and start media streams.
6. Call events update participant state and call history.

### Media Features by Phase

- Phase 3 initial: voice, camera, mute, speaker selection, end call
- Later: screen share, background noise suppression, hand raise, recording

## 6. Database Schema

PostgreSQL should be the source of truth.

### Core Tables

#### `users`

- `id`
- `phone_e164` or `email`
- `username`
- `display_name`
- `avatar_url`
- `about`
- `last_seen_at`
- `created_at`
- `updated_at`

#### `devices`

- `id`
- `user_id`
- `device_label`
- `platform`
- `push_token`
- `last_active_at`
- `created_at`

#### `sessions`

- `id`
- `user_id`
- `device_id`
- `refresh_token_hash`
- `expires_at`
- `revoked_at`

#### `conversations`

- `id`
- `type` (`direct`, `group`)
- `title`
- `avatar_url`
- `created_by`
- `created_at`
- `updated_at`
- `last_message_id`
- `last_message_at`

#### `conversation_members`

- `conversation_id`
- `user_id`
- `role` (`member`, `admin`, `owner`)
- `joined_at`
- `muted_until`
- `archived_at`
- `last_read_message_id`
- `last_read_at`

#### `messages`

- `id`
- `client_id`
- `conversation_id`
- `sender_user_id`
- `kind` (`text`, `image`, `video`, `audio`, `file`, `system`)
- `ciphertext`
- `plaintext_preview` optional for non-E2EE development only
- `reply_to_message_id`
- `created_at`
- `edited_at`
- `deleted_at`

#### `attachments`

- `id`
- `message_id`
- `storage_key`
- `mime_type`
- `size_bytes`
- `width`
- `height`
- `duration_ms`
- `checksum`

#### `message_receipts`

- `message_id`
- `user_id`
- `delivered_at`
- `read_at`

#### `calls`

- `id`
- `conversation_id`
- `initiator_user_id`
- `provider_room_name`
- `call_type` (`voice`, `video`)
- `started_at`
- `ended_at`
- `status`

#### `call_participants`

- `call_id`
- `user_id`
- `joined_at`
- `left_at`
- `connection_quality`

### E2EE Support Tables

#### `user_identity_keys`

- `user_id`
- `device_id`
- `identity_public_key`
- `signed_prekey_public`
- `signed_prekey_signature`
- `created_at`

#### `one_time_prekeys`

- `id`
- `device_id`
- `public_key`
- `consumed_at`

### Efficient Message History

- Paginate by `created_at desc, id desc` using cursor pagination
- Index `messages(conversation_id, created_at desc, id desc)`
- Maintain `conversations.last_message_at` for fast sidebar sorting
- Use separate attachment metadata rows instead of large JSON blobs
- Add monthly partitioning for `messages` only once volume justifies it

## 7. Security Framework

### Authentication

Use:

- short-lived access JWTs
- rotating refresh tokens stored as hashes
- device-bound sessions
- secure `httpOnly` cookies for web session continuity

Recommended auth flow:

1. User logs in with phone OTP or email/password in the first build.
2. Server issues access token plus refresh token.
3. Refresh token rotation invalidates stolen tokens quickly.
4. Every device is separately tracked and revocable.

### Password and Session Security

- `Argon2id` for password hashing
- per-IP and per-account rate limits with Redis
- session revocation by device
- CSRF protection for cookie-based endpoints
- same-site cookie policy

### End-to-End Encryption

Recommended path:

- 1-to-1 chats: Signal-style `X3DH` + `Double Ratchet`
- group chats: Signal `Sender Keys` for the early production path

Important rule:

- encrypt on the client
- store only ciphertext, encrypted attachment keys, and minimal routing metadata on the server

The server should still know:

- conversation id
- sender id
- message type
- timestamps

The server should not know:

- message plaintext
- attachment decryption keys

### Additional Security Controls

- signed upload URLs
- antivirus and content scanning for uploads
- CSP and strict security headers
- abuse detection and spam throttling
- optional QR-based safety number verification
- audit logs for admin actions, not for plaintext messages

## 8. API and Event Design

### REST or RPC Endpoints

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`
- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:id/messages?cursor=...`
- `POST /messages`
- `POST /messages/:id/read`
- `POST /uploads/sign`
- `POST /calls`

### WebSocket Contracts

- authenticate once on socket connect
- join all user rooms immediately
- join conversation rooms on demand or after sidebar sync
- include server sequence ids in all broadcast payloads

## 9. Frontend App Structure

### App Areas

- auth flow
- chat list sidebar
- active conversation panel
- profile and conversation detail drawer
- incoming call modal
- media composer
- settings and devices page

### Client State Split

- server state: conversations, messages, receipts, profile data
- realtime state: typing, online status, socket state
- local draft state: input text, upload queue, optimistic messages

### UX Rules

- optimistic message send
- cursor-based infinite history
- upload queue with progress
- resilient reconnect banner
- unread badges by conversation
- desktop-grade keyboard navigation

## 10. Feature Roadmap

### Phase 0: Foundation

- define schema and service boundaries
- replace current app shell
- introduce auth model and database migrations
- set up object storage and Redis
- add observability and error reporting

### Phase 1: MVP

- auth
- 1-to-1 chat
- conversation list
- message history pagination
- media uploads
- optimistic sending
- online/offline presence

Exit criteria:

- two users can sign in, exchange messages instantly, upload files, and reload without data loss

### Phase 2

- group chats
- read receipts
- last seen
- typing indicators
- basic profile settings
- archive, mute, and block actions

Exit criteria:

- group messaging is stable, receipts are correct across reloads, and presence signals are low-latency

### Phase 3

- voice calls
- video calls
- push notifications
- device management
- attachment previews

Exit criteria:

- users can receive incoming call prompts, join stable SFU-backed calls, and receive notifications while inactive

### Phase 4: Hardening

- E2EE rollout
- key verification
- multi-device sync hardening
- moderation and abuse controls
- search and retention policies

## 11. Suggested Monorepo Layout

```text
apps/
  web/
  api/
  worker/
packages/
  ui/
  config/
  database/
  contracts/
  crypto/
infra/
  docker/
  migrations/
```

For this repo, a practical near-term version is:

```text
webapp/
  src/app
  src/components
  src/features
  src/lib
  docs
```

Then split services out once the product boundary is stable.

## 12. Build Recommendation for This Repo

Given the current project state, the cleanest path is:

1. keep `.env` and deployment files
2. retire the current team-dashboard UI
3. replace Firebase chat logic with PostgreSQL + Redis oriented contracts
4. keep Next.js for the frontend shell
5. add a dedicated API and real-time layer instead of growing the current ad hoc routes

This keeps the rebuild controlled without destroying useful environment setup.
