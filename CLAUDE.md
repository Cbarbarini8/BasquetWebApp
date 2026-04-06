# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Liga Comercial de Basquet" — Basketball tournament management web app with real-time updates. Two audiences: public viewers (fixture, standings, stats, gallery) and admin (live match scoring, team/player CRUD, roles/permissions). ~10 teams, ~156 players.

## Tech Stack

- **Frontend:** React 19 + Vite 6 + React Router v7
- **Styling:** TailwindCSS v4 (via @tailwindcss/vite plugin)
- **Backend/DB:** Firebase (Firestore + Auth) — no custom server
- **Real-time:** Firestore `onSnapshot` listeners
- **Images:** Cloudinary (free tier) — logos, player photos, post thumbnails
- **Hosting:** Firebase Hosting (https://basquet-ef86a.web.app)

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (outputs to `dist/`)
- `npm run lint` — ESLint
- `npm run build && firebase deploy --only hosting` — Deploy to production

## Architecture

### Data Flow
- All data comes from Firestore via real-time `onSnapshot` listeners
- Standings and player stats are **computed client-side** from raw match/event data (not stored as aggregates)
- Match scores are **denormalized** on match documents for fast fixture/standings reads
- When admin adds a scoring event, a Firestore **batch write** atomically adds the event AND increments the score

### Firestore Collections
- `teams` — name, shortName, logoUrl (Cloudinary)
- `players` — firstName, lastName, number, teamId, photoUrl, photoStatus, uploadToken
- `matches` — round, homeTeamId, awayTeamId, homeScore, awayScore, status (scheduled/live/finished), quarter, scheduledDate, scheduledTime, courtId, seasonId
- `matches/{id}/events` — type, playerId, teamId, quarter, made (subcollection)
- `seasons` — name, active (bool), createdAt
- `courts` — name, mapsUrl
- `users` — email, displayName, role (owner/admin), permissions (object), active
- `posts` — url (Instagram), thumbnailUrl (Cloudinary), order, createdAt
- `auditLog` — userId, userEmail, action, collection, documentId, description, timestamp

### Event types
Scoring: `2pt`, `3pt`, `ft` (with `made: true/false`)
Other: `foul`, `assist`, `offRebound`, `defRebound`, `steal`, `block`, `turnover`

### Key Patterns
- `src/hooks/useCollection.js` — Generic real-time Firestore hook; all data hooks build on it
- `src/hooks/useUserRole.js` — Role/permissions hook for current user
- `src/lib/calculations.js` — Pure functions for standings and player stats computation
- `src/lib/audit.js` — `logAction()` writes to auditLog collection (ALL writes must be audited)
- `src/lib/cloudinary.js` — Upload with folder and publicId (uses entity ID to overwrite, not duplicate)
- `src/lib/utils.js` — normalizeDriveUrl, generateToken
- Theme system uses CSS variables on `:root` with `data-theme` attribute (3 themes: blue, orange, dark)
- Admin routes protected via `ProtectedRoute` component + Firebase Auth + users collection
- All styles use CSS variables (`var(--color-*)`) for theme support — avoid hardcoded colors
- Action buttons in admin use SVG icons with tooltips (see `src/components/common/Icons.jsx`)

### Roles & Permissions
- **Owner**: full access + Users/Audit tabs
- **Admin**: per-section permissions (view/edit/none) for: seasons, teams, players, courts, fixture, matches, scoring, posts
- Components receive `canEdit` prop — hide forms/action buttons when false

### Seasons
- Matches are filtered by `seasonId` — historical data preserved across seasons
- Public pages have season selector dropdown when multiple seasons exist
- Fixture generator creates matches with active season's ID

### Cloudinary
- Cloud name: `dttjycffp`, Upload preset: `player_photos`
- Folders: `teams/`, `players/`, `posts/`
- Uses entity ID as `public_id` to overwrite on re-upload (no duplicates)
- Clearing image = set URL to empty in Firestore (Cloudinary keeps file, overwrites on next upload)

### Firebase Config
- Credentials in `.env.local` (see `.env.example`), prefixed `VITE_FIREBASE_*`
- Firebase project: `basquet-ef86a`
- Auth: email/password provider
- Hosting: rewrites all routes to /index.html (SPA)

### Scripts (in `scripts/`)
- `create-owner.mjs` — Initialize owner user: `node scripts/create-owner.mjs <email> <password> [name]`
- `bulk-players.mjs` — Bulk load players by team
- `add-tokens.mjs` — Add upload tokens to existing players
- `load-match-stats.mjs` — Bulk load match statistics with validation mode

## User Preferences
- Spanish-speaking user (Argentina), communicate in Spanish
- Prefers comprehensive features over minimal
- Commits organized by section with descriptive Spanish summaries
- Always commit, push, and deploy together when asked
- Icons with tooltips preferred over text buttons in admin
