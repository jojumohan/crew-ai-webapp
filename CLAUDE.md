# Crew AI WebApp - Project Context & Progress

This document serves as a status report and context file for the Crew AI WebApp project. It outlines the architecture, completed tasks, and current state to allow other LLMs or agents to jump in and work in parallel.

## 📌 Project Overview
The goal is to build a **Progressive Web App (PWA)** for the Crew AI team. This acts as a centralized dashboard/hub installable on iOS and Android. 
Key features:
*   Member authentication (Admin: "joju", plus staff).
*   Interaction area: Chat, Voice notes, File exchange.
*   AI integration: All Python AI agents exist here to trigger/assist in tasks.
*   Communication: Group calls, individual calls with ringing notifications.
*   Dashboards: Task management, project status, calendar events.

## 🛠️ Tech Stack & Architecture
*   **Framework:** Next.js (App Router, TypeScript).
*   **Styling:** Custom Vanilla CSS with CSS Modules (Tailwind was deliberately disabled to focus on custom premium aesthetics with glassmorphism and tailored dark mode).
*   **Database:** MySQL (Hosted remotely on Hostinger).
*   **ORM:** Drizzle ORM (Installation in progress).
*   **Authentication:** NextAuth.js / Auth.js (Installation in progress).
*   **Real-time (Planned):** Socket.io for chat/notifications and WebRTC for A/V calls.
*   **PWA:** `@ducanh2912/next-pwa` for mobile installability.

## ✅ Completed Work (Phase 1: Foundation)
1.  **Project Initialization:** 
    *   Created the Next.js project in `D:\anti gravity\AGENT\webapp`.
    *   Cleaned out default boilerplate.
2.  **Premium UI Foundation:**
    *   Set up a sleek, modern `globals.css` utilizing custom CSS variables, a dark-slate theme (`#0f172a`), and `glass` utility classes.
    *   Built the initial landing page structure in `page.tsx` with related CSS modules.
3.  **PWA Configuration:**
    *   Installed next-pwa and configured `next.config.ts`.
    *   Created `public/manifest.json` and a placeholder `public/icon.svg`.
    *   Updated `src/app/layout.tsx` to include correct metadata and `viewport` tags for the PWA.
4.  **Database Credentials Ready:**
    *   We have the Hostinger MySQL database details ready to insert into `.env`:
        *   Host: `212.1.211.104` 
        *   User/DB Name: `u232481472_crewai`

## ⏳ Current Status / Next Steps
We are currently in the middle of installing database and authentication packages (`drizzle-orm`, `mysql2`, `next-auth`).

**Immediate parallel tasks for agents:**
1.  **Database Wiring:** Create the `.env` file with the Hostinger MySQL credentials and set up the Drizzle schema (`src/db/schema.ts`) for Users, Teams, and Tickets.
2.  **Authentication:** Configure `auth.ts` (NextAuth) using the credentials provider (with bcrypt for passwords) ensuring the default admin `joju` can log in.
3.  **Dashboard UI:** Begin building the protected `/dashboard` routes and standard component layouts (Sidebar, Header) using the established CSS modules.
