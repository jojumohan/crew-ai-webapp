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

The rebuilt messaging app now uses Firebase as the primary backend.

Required:

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Optional:

- `DATABASE_URL`

`DATABASE_URL` is no longer required for this build. It is only relevant if you later want to add or restore a PostgreSQL-backed messaging layer.

## Config Checklist

Use the committed example file as the template:

- `.env.example`

Validate your local environment:

```bash
npm run env:check
```

Important:

- Firebase admin credentials are required because the app now uses Firebase for both the current login flow and the new messaging store.
- If `DATABASE_URL` is set, it must be PostgreSQL, not MySQL.

## Development

```bash
npm run dev
```
