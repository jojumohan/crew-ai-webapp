# Messaging App Rebuild

This project is being rebuilt into a WhatsApp-like web application focused on:

- Private 1-to-1 messaging
- Group conversations
- Media sharing
- Voice and video calling
- Secure, device-aware authentication

## Current Direction

The previous "Aronlabz Teams" product surface is being replaced with a chat-first architecture. Existing secrets and deployment files are being preserved during the rebuild so we do not lose working environment configuration.

## Blueprint

The full technical blueprint lives here:

- [`WHATSAPP_CLONE_BLUEPRINT.md`](./WHATSAPP_CLONE_BLUEPRINT.md)

## Immediate Build Order

1. Replace the current UI shell with a messaging-first experience.
2. Introduce durable conversation and message models.
3. Add WebSocket-based real-time delivery and presence.
4. Add media uploads and read-state sync.
5. Integrate LiveKit-based calling and push notifications.

## Existing Config Worth Preserving

- `.env`
- `.env.vercel`
- `firebase.json`
- `firestore.rules`
- deployment scripts

## New Messaging Config

- `DATABASE_URL`

When `DATABASE_URL` is present, the new `/api/v1` messaging routes and dashboard use PostgreSQL-backed reads and writes.
Without it, the app falls back to the seeded in-memory store so the rebuild remains usable during setup.

## Development

```bash
npm run dev
```
