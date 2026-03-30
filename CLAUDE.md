# Aronlabz Teams — Project Context & Progress

## 📌 Project Overview
A **Progressive Web App (PWA)** for the Aronlabz team. Centralized dashboard installable on iOS and Android.

- **Primary URL (Vercel):** https://webapp-jojumohans-projects.vercel.app
- **Legacy URL (Hostinger):** https://slategray-fish-770407.hostingersite.com
- **GitHub:** https://github.com/jojumohan/crew-ai-webapp
- **Hosting:** Vercel (primary, current) + Hostinger Node.js (legacy)

---

## 🛠️ Tech Stack
- **Framework:** Next.js 16.2.1 (App Router, TypeScript, Turbopack)
- **Auth:** NextAuth v5 (Auth.js) — credentials provider, JWT strategy, `trustHost: true`
- **Database (SQL):** MySQL on Hostinger (`u232481472_aicrew`, host: `127.0.0.1`, user: `u232481472_openclaw`, password: `Crew2026!`)
- **Database (Realtime):** Firebase Firestore — project `meetingaron-55180` (Google account: aieurekaminds@gmail.com)
- **ORM:** Drizzle ORM (schema defined, raw mysql2 used in auth for reliability)
- **Styling:** Custom CSS Modules — dark glassmorphism theme (`#0f172a`)
- **PWA:** `@ducanh2912/next-pwa`
- **Push Notifications:** Web Push (VAPID) via `web-push` package
- **Voice/Signaling:** WebRTC mesh with Firestore signaling (flat collections)
- **TTS/STT:** Sarvam AI (voice channel)
- **LLM:** Groq llama-3.3-70b-versatile via VPS bot

---

## ✅ Completed Features

### Authentication
- Login page at `/login` with NextAuth credentials provider
- Registration page at `/register` — new users created as `status=pending`
- Admin approval flow — pending users blocked from login with message
- `status` column (`pending`/`active`) added to users table via migration API

### Dashboard Layout
- Protected `/dashboard/*` routes — redirects to login if no session
- Fixed sidebar (desktop) + bottom nav bar (mobile)
- Header with user avatar and Ring Team button
- Fully mobile responsive — 2-col stats grid, stacked panels, bottom emoji nav

### Pages Built
| Route | Description |
|-------|-------------|
| `/dashboard` | Overview with stats cards + panels |
| `/dashboard/tasks` | Task management |
| `/dashboard/agents` | AI agent control panel |
| `/dashboard/chat` | Real-time chat with AI agent |
| `/dashboard/calendar` | Google Calendar integration |
| `/dashboard/team` | Team members + admin approval |
| `/dashboard/files` | Placeholder |

### Team Management (`/dashboard/team`)
- Admin (joju) can add members directly with username/password/role
- New members can self-register at `/register` → appear as pending
- Admin sees "Pending Approval" section with Approve/Reject buttons
- Active members listed with role badges (admin=purple, staff=grey)
- Admin can remove staff members

### AI Agent — Unified Brain (VPS + Discord + Chat + Voice)
- Agent runs on VPS `185.190.140.103:8765` (systemd service `aronlabz-bot`)
- **Unified brain architecture**: single `unified_brain(user_name, message, channel)` function in `agent.py`
- **Cross-channel memory**: shared `_history` dict keyed by `user_name` only — conversations persist across Discord, chat, and voice
- **Live DB context**: agent reads pending tasks, team members, projects, attendance on every call
- **Channel-aware tone**: voice/standup = short plain speech; chat/discord = markdown
- **Actions**: task queries, mark-done, calendar event extraction, add task
- HTTP endpoints:
  - `POST /chat` — `{user, message, channel}` → `{reply, actions}`
  - `POST /standup` — triggers standup meeting
  - `POST /end` — ends meeting
  - `GET /status` — agent online/meeting status
  - `POST /meeting-note` — processes standup note via unified brain

### Google Calendar Integration
- Calendar: `aieurekaminds@gmail.com` (public, see all details)
- `/api/calendar/events` — fetches upcoming events via Google Calendar API v3 (API key)
- `/api/calendar/create` — creates events via service account JWT (for webhook use)
- **Agent creates calendar events directly from VPS** — calls Google Calendar API directly using service account, bypassing Vercel SSO
- Service account: `firebase-adminsdk-fbsvc@meetingaron-55180.iam.gserviceaccount.com`
- SA key file on VPS: `/root/aronlabz-agent/google_sa_key.pem`
- Events shown as cards with Today/Soon badges, date, location, description
- API key: `AIzaSyBvoPWyAXNnMljjDTT2L7MYJ4aUAc-eSFg`

### VoiceRoom (`/dashboard/standup` or VoiceRoom component)
- WebRTC mesh signaling via Firestore **flat collections** (critical — nested subcollections caused all voice bugs)
  - `standup_presence/{userId}` — presence docs (2 segments = doc ref ✓)
  - `standup_signals` collection with `where('to', '==', myId)` query (not subcollections)
- AudioContext unlocked on join click (browser autoplay policy)
- Processed signal docs deleted after handling
- Agent participates via Sarvam TTS/STT
- **IMPORTANT**: Any future refactor must keep flat collection paths — invalid Firestore path segments throw synchronously and break everything silently

### Ring / Push Notifications
- VAPID web push implemented
- Users enable notifications → subscription saved to `push_subscriptions` table
- "Ring Team" button in header → pushes notification to all other devices
- Service worker at `/sw-push.js` handles push + vibration
- Ring tone at `/ring.mp3`

---

## 🗄️ Databases

### MySQL (Hostinger) — Persistent Data
**Host:** `127.0.0.1:3306` | **DB:** `u232481472_aicrew` | **User:** `u232481472_openclaw` / `Crew2026!`

Tables:
- `users` — id, username, email, password_hash, role (admin/staff), status (pending/active), display_name, created_at
- `teams`, `team_members`, `tickets` — schema defined in Drizzle
- `push_subscriptions` — user_id, endpoint, p256dh, auth_key

Seed User: **joju** / `Crew2026!` / admin / active

### SQLite (VPS) — Agent Memory
- Path: `/root/aronlabz-agent/aronlabz.db`
- Stores tasks, chat history, team info used by the agent brain

### Firestore (Firebase) — Realtime Signaling
- **Project:** `meetingaron-55180` (Google account: aieurekaminds@gmail.com)
- **Status (2026-03-30):** Rules ruleset uploaded, but database may not be created yet — if Firestore returns 404, go to Firebase Console → Firestore Database → Create database (region: asia-south1)
- Collections: `standup_presence`, `standup_signals`, `messages`, `users`
- Rules file: `webapp/firestore.rules` — deploy with `node webapp/deploy-rules.mjs`

---

## 🔑 Environment Variables

### Vercel (Primary Deployment)
```
FIREBASE_PROJECT_ID=meetingaron-55180
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@meetingaron-55180.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=<from meetingaron-55180-firebase-adminsdk-fbsvc-d83661bdcb.json>
NEXT_PUBLIC_FIREBASE_API_KEY=<from firebase config>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=meetingaron-55180.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=meetingaron-55180
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=meetingaron-55180.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from firebase config>
NEXT_PUBLIC_FIREBASE_APP_ID=<from firebase config>
AGENT_URL=http://185.190.140.103:8765
GOOGLE_CALENDAR_ID=aieurekaminds@gmail.com
GOOGLE_CALENDAR_API_KEY=AIzaSyBvoPWyAXNnMljjDTT2L7MYJ4aUAc-eSFg
CALENDAR_CREATE_SECRET=<secret for /api/calendar/create>
VERCEL_BYPASS_SECRET=<vercel protection bypass token>
```

### Hostinger (Legacy)
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=u232481472_openclaw
DB_PASSWORD=Crew2026!
DB_NAME=u232481472_aicrew
DATABASE_URL=mysql://u232481472_openclaw:Crew2026!@127.0.0.1:3306/u232481472_aicrew
AUTH_SECRET=ZwXkt41MxQY5BXbcB+8GSWfmRx4zMyOwVVvG+3Ag3xM=
NEXTAUTH_URL=https://slategray-fish-770407.hostingersite.com
NODE_ENV=production
AGENT_URL=http://185.190.140.103:8765
GOOGLE_CALENDAR_ID=aieurekaminds@gmail.com
GOOGLE_CALENDAR_API_KEY=AIzaSyBvoPWyAXNnMljjDTT2L7MYJ4aUAc-eSFg
VAPID_PUBLIC_KEY=BCpva0FExgUDVR3Nz-2a6jV40EZ35ELZcqoPAGb6F0L3ezBo6jU36fqIj8CqxmqoIF3OJsUdess7UWj_iEHcFrE
VAPID_PRIVATE_KEY=hhJHNm3O2NQ_FoN_tztwv-83uVka5k0gBeyFxhlC_tQ
VAPID_EMAIL=mailto:aieurekaminds@gmail.com
MIGRATE_SECRET=aronlabz-migrate-2026
```

---

## 🤖 AI Agent (VPS)

- **VPS:** `185.190.140.103` (root / `5I1TER2g9Qq6G3sAr63XI`)
- **Service:** `systemctl status aronlabz-bot`
- **Logs:** `journalctl -u aronlabz-bot -f`
- **Working dir:** `/root/aronlabz-agent/`
- **Python env:** `/root/crewai-env/bin/python`
- **Key files:**
  - `bot.py` — aiohttp HTTP server + Discord bot, imports `unified_brain` from agent.py
  - `agent.py` — unified brain, LLM calls, action detection, cross-channel memory
  - `google_sa_key.pem` — service account private key for Google Calendar (meetingaron-55180)
  - `aronlabz.db` — SQLite agent memory
- **VPS `.env`:**
  ```
  DISCORD_TOKEN=...
  GROQ_API_KEY=...
  SARVAM_API_KEY=...
  GOOGLE_SA_EMAIL=firebase-adminsdk-fbsvc@meetingaron-55180.iam.gserviceaccount.com
  GOOGLE_SA_KEY_FILE=/root/aronlabz-agent/google_sa_key.pem
  GOOGLE_CALENDAR_ID=aieurekaminds@gmail.com
  WEBAPP_URL=https://webapp-jojumohans-projects.vercel.app
  ```

### Calendar Integration (VPS → Google directly)
The agent creates calendar events by calling Google Calendar API directly (not via Vercel API route).
Flow: `create_calendar_event()` in bot.py → `_make_google_jwt()` signs RS256 JWT with key file → `_get_google_token()` exchanges for OAuth2 token → POST to `googleapis.com/calendar/v3/calendars/{id}/events`
This bypasses Vercel SSO protection entirely.

---

## 🔥 Firebase Project Migration (Completed 2026-03-30)

Migrated from old Firebase project `meetings-8e008` (different Google account) to new project `meetingaron-55180` (aieurekaminds@gmail.com — same account as Google Calendar).

**Why:** Service account from `meetings-8e008` couldn't write to `aieurekaminds@gmail.com` calendar without extra cross-account sharing. New project uses the same Google account.

**Files updated:**
- `webapp/deploy-rules.mjs` — new project ID + SA credentials
- `webapp/check_rules.mjs` — diagnostic script for rules release status
- `webapp/set_env.py` — script to push FIREBASE_PRIVATE_KEY to Vercel env
- VPS: `/root/aronlabz-agent/google_sa_key.pem` — new SA private key
- VPS: `/root/.env` — new SA email + key file path

**Pending (as of 2026-03-30):**
1. Create Firestore Database in `meetingaron-55180` Firebase Console (not yet done — rules return 404)
2. After DB created: redeploy rules with `node webapp/deploy-rules.mjs`
3. Re-seed `users` collection in new Firestore project (old data was in `meetings-8e008`)
4. Verify VoiceRoom works with new Firebase config (Vercel env vars must be updated)

---

## 🐛 Known Issues / Gotchas

### Firestore Path Segments (CRITICAL)
- `doc()` requires **even** number of path segments; `collection()` requires **odd**
- Violations throw **synchronously** with no useful error — breaks entire component silently
- Voice room was completely broken until this was fixed
- All signaling now uses flat collections: `standup_presence/{userId}` and `standup_signals` with where query

### Vercel SSO Protection
- Vercel deployment protection (SSO) blocks server-to-server HTTP requests to `/api/*` routes
- VPS bot cannot call `https://webapp-jojumohans-projects.vercel.app/api/calendar/create`
- **Workaround**: VPS calls Google APIs directly, never through Vercel

### Python String Escaping on VPS
- Writing Python code via shell heredocs (bash `python -c "..."`) mangles f-strings, backslashes, triple-quoted strings
- **Always** write Python patches via SFTP file transfer or local `.py` scripts, never via shell echo/heredoc

---

## ⏳ Pending / Next Steps
1. Create Firestore Database in `meetingaron-55180` Firebase Console
2. Redeploy Firestore rules after DB creation
3. Re-seed `users` collection in new Firestore
4. Verify Vercel env vars have correct `meetingaron-55180` Firebase config
5. End-to-end test: ask agent about event in chat → calendar event created → shows in `/dashboard/calendar`
6. Tasks page — wire up real task CRUD to MySQL + agent
7. Files page — file upload/sharing
8. Dashboard stats — real counts from DB
