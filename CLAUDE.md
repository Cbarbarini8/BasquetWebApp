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
- `npm run preview` — Preview production build locally
- `npm run build && firebase deploy --only hosting` — Deploy to production
- No test framework — no unit or integration tests exist

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

### Routes (in `App.jsx`)
- `/` — Fixture (home), `/standings`, `/stats`, `/gallery` — Public pages
- `/match/:matchId` — Public match detail with live updates
- `/jugador/foto/:token` — Player self-service photo upload (no auth, token-based)
- `/admin/login` — Admin login page
- `/admin` — Admin dashboard (protected, tabbed: Temporadas/Equipos/Jugadores/Canchas/Fixture/Partidos/Instagram/Usuarios/Auditoria)
- `/admin/match/:matchId` — Live scoring page (protected)

### Provider Hierarchy
`BrowserRouter` → `ThemeProvider` → `AuthProvider` → routes. `useAuth()` returns `{ user, userDoc, loading, isOwner, isActive, canView, canEdit, login, logout }` — `canView(section)` / `canEdit(section)` check permission strings like 'teams', 'matches', etc.

### Key Patterns
- `src/hooks/useCollection.js` — Generic real-time Firestore hook; all data hooks build on it. Uses `JSON.stringify(queryConstraints)` in deps to prevent infinite re-renders from array identity churn — preserve this pattern when extending.
- `src/hooks/useDocument.js` — Single-document real-time hook counterpart
- `src/hooks/useUserRole.js` — Role/permissions hook for current user
- `src/lib/calculations.js` — Pure functions for standings and player stats computation
- `src/lib/audit.js` — `logAction(user, action, collection, documentId, description, details)` writes to auditLog (ALL writes must be audited). Called **after** the Firestore commit, not inside the batch, so audit failures never block the mutation.
- `src/lib/cloudinary.js` — Upload with folder and publicId (uses entity ID to overwrite, not duplicate)
- `src/lib/utils.js` — normalizeDriveUrl, generateToken
- Theme system uses CSS variables on `:root` with `data-theme` attribute (3 themes: blue, orange, dark). Blue is the base (no attribute set); `orange` / `dark` set `data-theme`. Persisted in localStorage.
- Admin routes protected via `ProtectedRoute` component + Firebase Auth + users collection (user must also exist in `users` collection with `active: true`)
- All styles use CSS variables (`var(--color-*)`) for theme support — avoid hardcoded colors
- Action buttons in admin use SVG icons with tooltips (see `src/components/common/Icons.jsx`)
- Common UI: `PageShell` (layout wrapper with title), `SeasonSelector`, `TeamLogo`, `LoadingSpinner`, `EmptyState`, `LiveBadge`
- Pure JavaScript — no TypeScript, no PropTypes. Trust component contracts; document signatures in JSDoc comments where ambiguous.

### Data Composition Pattern
Derived data hooks (`useStandings`, `usePlayerStats`) follow a three-layer pattern:
1. Fetch raw data via thin `useCollection` wrappers (e.g. `useMatches`, `useTeams`)
2. Compute via pure functions from `src/lib/calculations.js`
3. Wrap the result in `useMemo` keyed on the raw inputs

`usePlayerStats` aggregates events across many `matches/{id}/events` subcollections by attaching one `onSnapshot` per match and tracking an `initialLoadCount` to coordinate first-paint. If you add similar multi-subcollection aggregation, early-return when the parent list is empty to avoid unnecessary listeners.

### Scoring Batch Write Contract
In `LiveScoring.jsx`, every scoring change touches two places in one `writeBatch`:
1. Add/remove the event document in `matches/{id}/events`
2. Increment/decrement `homeScore`/`awayScore` on the match doc (denormalized)

Undo must reverse **both**. If you add new event mutations, preserve this pairing or the denormalized score will drift from the event log. Audit log is written after the batch commits.

### Permission Check Order
`useUserRole.hasPermission` checks in this specific order — preserve it:
1. `!userDoc || !isActive` → false (deactivated users, including deactivated owners, lose access)
2. `isOwner` → true (owner bypass)
3. Specific section permission ('view' / 'edit' / 'none')

`AdminDashboard` filters tab visibility at render: `ownerOnly` tabs (Users, Audit) are hidden from non-owners; the matches tab is shown if the user can view **either** matches or scoring.

### Compact Mode
`LiveScoring` accepts a `compact` prop (driven by `useIsCompactScoring` — landscape-phone heuristic) that reshapes jersey sizes, grid columns, text sizes, and flips the away side to `flex-row-reverse`. Keep both modes in sync when editing the scoring UI.

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
