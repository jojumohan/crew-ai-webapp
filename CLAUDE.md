# Aronlabz Teams — Project Context & Progress

## 📌 Project Overview
A **Progressive Web App (PWA)** for the Aronlabz team. Centralized dashboard installable on iOS and Android.

- **URL:** https://slategray-fish-770407.hostingersite.com
- **GitHub:** https://github.com/jojumohan/crew-ai-webapp
- **Hosting:** Hostinger Node.js (auto-deploy from GitHub master branch)

---

## 🛠️ Tech Stack
- **Framework:** Next.js 16.2.1 (App Router, TypeScript, Turbopack)
- **Auth:** NextAuth v5 (Auth.js) — credentials provider, JWT strategy, `trustHost: true`
- **Database:** MySQL on Hostinger (`u232481472_aicrew`, host: `127.0.0.1`, user: `u232481472_openclaw`, password: `Crew2026!`)
- **ORM:** Drizzle ORM (schema defined, raw mysql2 used in auth for reliability)
- **Styling:** Custom CSS Modules — dark glassmorphism theme (`#0f172a`)
- **PWA:** `@ducanh2912/next-pwa`
- **Push Notifications:** Web Push (VAPID) via `web-push` package

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
| `/dashboard/tasks` | Placeholder |
| `/dashboard/agents` | AI agent control panel |
| `/dashboard/chat` | Placeholder |
| `/dashboard/calendar` | Google Calendar integration |
| `/dashboard/team` | Team members + admin approval |
| `/dashboard/files` | Placeholder |

### Team Management (`/dashboard/team`)
- Admin (joju) can add members directly with username/password/role
- New members can self-register at `/register` → appear as pending
- Admin sees "Pending Approval" section with Approve/Reject buttons
- Active members listed with role badges (admin=purple, staff=grey)
- Admin can remove staff members

### AI Agent Integration
- Agent runs on VPS `185.190.140.103:8765` (systemd service `aronlabz-bot`)
- `/api/agent/status` — polls agent online/meeting status every 15s
- `/api/agent/trigger` — POST `{action: 'standup'|'end'}` to control agent
- Agents page shows live status badge + Trigger Standup / End Meeting buttons

### Google Calendar
- Connected to `aieurekaminds@gmail.com` calendar (set to public, see all details)
- `/api/calendar/events` — fetches upcoming events via Google Calendar API v3
- Events shown as cards with Today/Soon badges, date, location, description
- API key: `AIzaSyBvoPWyAXNnMljjDTT2L7MYJ4aUAc-eSFg`

### Ring / Push Notifications
- VAPID web push implemented
- Users enable notifications → subscription saved to `push_subscriptions` table
- "📞 Ring Team" button in header → pushes notification to all other devices
- Service worker at `/sw-push.js` handles push + vibration
- Ring tone at `/ring.mp3` (generated 2.8s tone)

---

## 🗄️ Database

**Host:** `127.0.0.1:3306`
**DB:** `u232481472_aicrew`
**User:** `u232481472_openclaw` / `Crew2026!`

### Tables
- `users` — id, username, email, password_hash, role (admin/staff), status (pending/active), display_name, created_at
- `teams`, `team_members`, `tickets` — schema defined in Drizzle
- `push_subscriptions` — user_id, endpoint, p256dh, auth_key (created on first push subscribe)

### Seed User
- **Username:** `joju` | **Password:** `Crew2026!` | **Role:** admin | **Status:** active

---

## 🌐 Hostinger Environment Variables
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
- **HTTP endpoints:** `POST /standup`, `POST /end`, `GET /status`
- **Port:** 8765
- **Bot:** Discord bot using Groq Llama-3.3-70b, SQLite DB at `/root/aronlabz-agent/aronlabz.db`
- **Env:** `/root/.env` (DISCORD_TOKEN, GROQ_API_KEY, SARVAM_API_KEY, GOOGLE_CALENDAR_API_KEY)

---

## ⏳ Planned / Next Steps
- Chat page — real-time messaging (Socket.io or polling)
- Tasks page — create/assign/complete tasks linked to DB
- Files page — file upload/sharing
- Dashboard stats — wire up real counts from DB
- Push notification badge count on mobile
