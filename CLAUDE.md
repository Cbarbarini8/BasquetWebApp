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
- `npm run build && firebase deploy --only hosting` — Deploy app to production
- `firebase deploy --only firestore:rules` — Deploy Firestore security rules (versioned in `firestore.rules`)
- `npm run build && firebase deploy --only hosting,firestore:rules` — Full deploy (app + rules)
- No test framework — no unit or integration tests exist

### Local testing with Firebase Emulator
The Firebase Emulator Suite (Firestore + Auth) is configured for local testing without touching production. Requires Java (Temurin/OpenJDK).

- `npm run emulators:fresh` — Start emulators **without** importing prior state. Use the very first time (creates `.firebase-emulator-data/` on Ctrl+C). Saves snapshot on exit.
- `npm run emulators` — Start emulators with import + export-on-exit. Use after the first run; persists state across sessions in `.firebase-emulator-data/` (gitignored).
- `npm run seed:emulator` — Populate the running emulator with synthetic data: 1 owner (`admin@local.test` / `admin123`), 1 active season, 1 court, 4 teams, 40 players (mixed ages including legacy with no `birthDate`), 7 matches across `scheduled`/`live`/`finished`/`walkover` and one `phase: 'semifinal'`.
- `npm run dev:emulator` — Start the Vite dev server in `emulator` mode (loads `.env.emulator` which sets `VITE_USE_EMULATOR=true`). `firebase.js` then calls `connectFirestoreEmulator` / `connectAuthEmulator` on boot. Analytics is auto-disabled in emulator mode. The plain `npm run dev` always points to production — keep that distinction.
- Emulator UI: http://127.0.0.1:4000 — inspect/edit Firestore docs and auth users live.
- **Typical workflow** (3 terminals): A — `npm run emulators` (or `:fresh` first time), B — `npm run seed:emulator` (only first run or to reset), C — `npm run dev:emulator`, then open http://127.0.0.1:5173.

## Architecture

### Data Flow
- All data comes from Firestore via real-time `onSnapshot` listeners
- Standings and player stats are **computed client-side** from raw match/event data (not stored as aggregates)
- Match scores are **denormalized** on match documents for fast fixture/standings reads
- When admin adds a scoring event, a Firestore **batch write** atomically adds the event AND increments the score

### Firestore Collections
- `teams` — name, shortName, logoUrl (Cloudinary)
- `players` — firstName, lastName, number, teamId, photoUrl, photoStatus, uploadToken, pendingPhotoUrl (self-upload pending approval), `birthDate` (ISO `yyyy-mm-dd` string; empty/missing = legacy data, treated as "+30" for quota purposes)
- `matches` — round, homeTeamId, awayTeamId, homeScore, awayScore, status (`scheduled` / `live` / `finished` / `walkover`), quarter, scheduledDate, scheduledTime, courtId, seasonId, `homeCaptainId`/`awayCaptainId` (set when match starts; required by `StartMatchModal`), `referee1`/`referee2` (free text), `phase` (`regular` default | `play-in` | `play-off` | `semifinal` | `final` — affects timeout caps; missing = treated as `regular`), `playerNumbers` (object `{playerId: jerseyNumber}` — also serves as the per-match roster: a player is convocado iff they appear here), `libres.{home|away}` (array of playerIds marked as libre for this match), `walkoverNoShow` (`'home'` | `'away'` — only set when status=walkover, indicates which team didn't show up). Clock/stint fields: `clockRunning`, `clockRemainingMs`, `clockStartedAt`, `currentStint` (open stint embedded — see Match Clock section). Timeout fields: `timeouts.{home|away}.{quarter}` is an integer counter of TMs used (legacy boolean tolerated via `timeoutsUsedIn` helper).
- `matches/{id}/events` — type, playerId, teamId, quarter, made (subcollection)
- `matches/{id}/playerStints` — closed time-on-court stints: playerId, teamId, quarter, startClockMs, endClockMs, durationMs, createdAt (subcollection)
- `seasons` — name, active (bool), createdAt
- `courts` — name, mapsUrl
- `users` — email, displayName, role (owner/admin), permissions (object), active
- `posts` — url (Instagram), thumbnailUrl (Cloudinary), order, createdAt
- `auditLog` — userId, userEmail, action, collection, documentId, description, timestamp
- `updates`, `config` — misc app state (rules permit authenticated writes)

### Event types
Scoring: `2pt`, `3pt`, `ft` (with `made: true/false`)
Fouls: `foul` (personal — 5th ejects from match), `foulTech` (technical), `foulUnsport` (unsportsmanlike), `foulTechBench` (technical against the bench — has `teamId` but no `playerId`), `ejection` (direct expulsion — carries `suspensionMatches: N`)
Other: `assist`, `offRebound`, `defRebound`, `steal`, `block`, `turnover`, `timeout` (TM event — has `teamId`, `quarter`, optional `byBenchTechPenalty: true` for auto-emitted penalties)

**Foul accumulation rules (`LiveScoring.jsx`)**:
- `PERSONAL_FOUL_TYPES = ['foul', 'foulTech', 'foulUnsport']` — counted per player (5 → ejected from match, does NOT suspend next match)
- `TEAM_FOUL_TYPES = PERSONAL_FOUL_TYPES + ['foulTechBench']` — counted per team per quarter (4+ = bonus)
- Flagrant accumulation (2 of `foulTech` and/or `foulUnsport` combined) → ejected from match. Per torneo regulation:
  - 2× `foulTech` (doble técnica) → ejected **+ 1-match suspension**: same batch emits an `ejection` event with `suspensionMatches: 1` and `autoFromDoubleTech: true` so `suspensions.js` picks it up.
  - 1× `foulTech` + 1× `foulUnsport` → ejected, no suspension.
  - 2× `foulUnsport` → ejected, no suspension.
- 2nd `foulTechBench` of the same team in the match → if captain is available, auto-emits an `ejection` event for the captain with `suspensionMatches: 1` in the same batch; if captain is already ejected or missing, only a warning toast (no extra sanction). The auto-ejection event has `autoFromBenchTech: true` for traceability.

### Routes (in `App.jsx`)
- `/` — Fixture (home), `/standings`, `/stats`, `/gallery` — Public pages
- `/match/:matchId` — Public match detail with live updates
- `/jugador/foto/:token` — Player self-service photo upload (no auth, token-based)
- `/admin/login` — Admin login page
- `/admin` — Admin dashboard (protected, tabbed: Temporadas/Equipos/Jugadores/Canchas/Fixture/Partidos/Instagram/Usuarios/Auditoria)
- `/admin/match/:matchId` — Live scoring page (protected)

### Provider Hierarchy
`BrowserRouter` → `ThemeProvider` → `AuthProvider` → `ToastProvider` → `DataProvider` → routes. `useAuth()` returns `{ user, userDoc, loading, isOwner, isActive, canView, canEdit, login, logout }` — `canView(section)` / `canEdit(section)` check permission strings like 'teams', 'matches', etc. `useToast()` exposes `success/error/warning/info` for transient notifications.

### Shared Data Subscriptions (DataContext)
`src/context/DataContext.jsx` centralizes Firestore subscriptions to avoid each screen mounting its own `onSnapshot`:
- **Always-mounted** (cheap, ~10–20 docs each, used everywhere): `teams`, `courts`, `seasons`. Consumed via `useData()`.
- **Lazy ref-counted** (expensive, ~156 docs, only stats/match-detail/admin need it): `players`. Consumers call `usePlayersSubscription()`, which increments a ref count on mount and decrements on unmount; the listener attaches on the first consumer and detaches when the last one unmounts.

When adding a new screen, prefer the context hooks over re-subscribing. When adding a new "always-on" collection, weigh doc count vs. ubiquity before adding it to the always-mounted set — anything sizeable should follow the players ref-count pattern instead.

### Key Patterns
- `src/hooks/useCollection.js` — Generic real-time Firestore hook; all data hooks build on it. Uses `JSON.stringify(queryConstraints)` in deps to prevent infinite re-renders from array identity churn — preserve this pattern when extending.
- `src/hooks/useDocument.js` — Single-document real-time hook counterpart
- `src/hooks/useMatchDoc.js` — Variant for the public match page: `getDoc` initial, only escalates to `onSnapshot` if `status === 'live'`. Drops the listener if the match transitions to finished mid-session. Use this instead of `useDocument` for the public match page to keep Firestore reads down.
- `src/hooks/useMatchDetailData.js` — Same live-vs-one-shot strategy applied to `events` + `playerStints` subcollections of a match: `getDocs` once for `scheduled`/`finished`, `onSnapshot` only while `status === 'live'`. Re-runs and tears down listeners when status transitions. Pair with `useMatchDoc` on the public match page.
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

### Match Clock & Stints (time-on-court)
Clock model (`src/hooks/useMatchClock.js`): the clock is `clockRemainingMs` (base) + optional `clockStartedAt` (epoch ms). If `clockRunning` is true, current remaining = `base - (now - clockStartedAt)`. Defaults: 10 min per regular quarter, 5 min per overtime (Q5+). Use `pausedRemainingFromMatch(match)` to freeze the clock deterministically into a single ms value.

Stint model (`src/lib/stints.js`): `match.currentStint` (on match doc) represents the **open** stint — `{ startClockMs, quarter, startedAt, players: [{playerId, teamId}] }` or null. Closed stints go into the `playerStints` subcollection with `durationMs`. `usePlayerStats` / stats UI aggregate via `aggregateStintsByPlayer`.

**Stint closing contract**: any action that changes who's on court, pauses the clock, changes quarter, edits the clock, or finishes the match **must close the open stint** via `closeOpenStintToBatch(batch, db, match)` in the same batch that mutates the match doc. Skipping this drifts minute totals from actual elapsed time. Grep existing usages in `LiveScoring.jsx` before adding new clock/lineup mutations.

### Standings tiebreakers (reglamento)
`computeStandings` (`src/lib/calculations.js`) groups teams by total points and resolves each tied group via a recursive cascade matching the reglamento's adaptation of FIBA rules:
- **2 equipos empatados** → only `headToHeadWins` between them. Goles a/c (overall diff/PF) **NOT** used per regulation. If they haven't played (theoretical edge case), deterministic fallback by `teamId`.
- **3+ equipos empatados** → `cascadeTieBreak` builds a mini-table including only matches between still-tied teams, then sorts by criteria in order:
  1. `miniWon` (more wins in mini-table)
  2. `miniDiff` (better point diff in mini-table)
  3. `miniFor` (more points-for in mini-table)
- When a subgroup reduces to 2 at any cascade level, it reverts to `breakTie2` (head-to-head) per regulation: *"vuelve a clasificar por el resultado entre si"*.
- The mini-table is **rebuilt at each recursion level** to include only the still-tied teams (so once a team breaks free, its matches are excluded from the inner cascade).
- If the cascade exhausts all 3 criteria with teams still tied, regulation says *sorteo* — code falls back to deterministic order by `teamId` so the rendered standings stay reproducible. The actual tournament organizer would resolve the real sorteo manually.

Walkover matches DO count for both head-to-head and mini-table calculations (the no-show team is treated as a 0-20 loss).

### Walkover (reglamento)
A scheduled match can be marked as **walkover** (`MatchManager.markWalkover`) when one team doesn't show up. Per regulation:
- Score is set to **20-0** in favor of the present team.
- `match.walkoverNoShow` records which side (`'home'` or `'away'`) didn't show up.
- Standings give the winner `pointsForWin` (default 2) and the no-show team `pointsForWO` (default **0**, NOT the regular `pointsForLoss=1`). `computeStandings` (`src/lib/calculations.js`) treats both `finished` and `walkover` matches as counted, branching on `match.status === 'walkover'` to choose the loser's points.
- Walkover matches show a "WO" badge in `MatchCard` (fixture) and `MatchManager` (admin); `MatchDetailPage` shows a "WALKOVER · {team} no se presentó" header and a "Partido no disputado" message in place of the box score.
- `FixturePage` and `MatchManager` treat `walkover` as terminal: rounds where every match is `finished` OR `walkover` show under "completed".

### Match Roster & Libres (reglamento)
`src/lib/roster.js` codifies the regulation's roster rules:
- **Max 12 convocados per team per match** (`MAX_ROSTER_SIZE`). The `match.playerNumbers` object IS the roster — a player is convocado iff they have an entry there. `AdminMatchPage` already filters team players by `playerNumbers` before passing to `LiveScoring`.
- **Max 3 libres per team per match** (`MAX_LIBRES_PER_MATCH`). Stored in `match.libres.{home|away}` as an array of playerIds. The libres are a subset of the convocados (they must also appear in `playerNumbers`).
- **Libre eligibility** (`checkLibreEligibility`):
  - Cannot be `CATEGORY_YOUNG` (20-25).
  - Cannot have played as libre for **another** team in any prior match (cross-team conflict, derived at runtime via `deriveLibreHistory(matches)` — no denormalized field).
  - In phase `semifinal` or `final`: cannot be a NEW libre — must have been libre for this same team in a prior match.

`StartMatchModal` enforces all of these at confirm time and provides per-player toggles. A migration grace rule applies: matches without `playerNumbers` fall back to "all team players are eligible" (current behavior); matches without `libres` simply have no libres marked.

`PlayerJersey` (full mode) and `Jersey` (compact mode) display a small "L" badge in the bottom-right corner when the player is in `match.libres.{side}`. The `CourtEditorSheet` (compact bottom sheet for picking the 5 starters) also shows the badge.

**Not yet implemented (TODO)**:
- Adding more convocados during the match (regulation allows up to Q3 start). Today the roster is locked when the match starts.
- Per-match roster editing for finished matches in `MatchManager`.

### Timeouts (reglamento)
`src/lib/timeouts.js` codifies the regulation's timeout caps per phase/quarter:
- **Regular / play-in / play-off**: 1 TM per quarter, no carry-over.
- **Semifinal**: 1 in Q1/Q2/Q3, **2 in Q4**.
- **Final**: 1 in Q1, 1 in Q2, **pool of 3 across Q3+Q4 with max 2 in Q4** (the regulation's "must use 1 in Q3" rule is left as soft visual guidance — not hard-blocked).
- **Overtime (Q5+)**: 1 TM regardless of phase.

Helpers: `timeoutsUsedIn(match, q, side)` (tolerates boolean legacy data), `timeoutsAllowedFor(phase, q)` (returns `{ allowed, pool? }`), `timeoutsAvailableNow(match, q, side)` (clamped ≥0; respects pool caps).

**Each TM is written as both an event AND a counter update** (single batch, mirrors the scoring pattern):
- Event: `{ type: 'timeout', teamId, quarter, timestamp, byBenchTechPenalty?: true }` in `matches/{id}/events`.
- Counter: `match.timeouts.{side}.{quarter}` integer, updated explicitly (not via `increment()` because legacy data may be boolean — overwrite avoids type errors).
- Undo flow: the standard event-undo path in `LiveScoring.undoEvent` decrements the counter when the deleted event is `type: 'timeout'`.

**Bench technical foul → timeout penalty** (`planBenchTechTimeoutPenalty`): each `foulTechBench` consumes 1 TM (current quarter if available, else next quarter). In Q4 or OT with no margin, the penalty is "deferred to next match" — currently shown only as a warning toast; the carry-over write is **not yet implemented** (TODO when match-to-match orchestration is added).

### Player Age Categories (reglamento)
`src/lib/playerCategory.js` codifies the regulation's age-based quotas:
- **20-25** (`CATEGORY_YOUNG`): max **3** per team roster, max **2** simultaneously on court.
- **26-30** (`CATEGORY_MID`): max **6** per team roster, no on-court cap.
- **31+** (`CATEGORY_SENIOR`): no caps.

`computeAge(birthDate, refDate)` returns null when birthDate is missing/invalid; `categoryFor` falls back to `CATEGORY_SENIOR` in that case — this is the **migration grace rule**: legacy players without a `birthDate` don't participate in quotas until the admin fills the field.

**Enforcement points:**
- `PlayerForm`: shows a `toast.warning` (non-blocking) when adding/editing a player would push the team over the 3- or 6-quota for the resulting category. We don't hard-block because corrections (typo fixes, birthdays crossing the 25→26 line) need to go through.
- `LiveScoring.togglePlayerOnCourt`: hard-blocks bringing in a 4th 20-25 player when 2 are already on court (only for players whose birthDate is loaded).

`PlayerBulkImport.jsx` handles CSV download/upload for filling birthDates in bulk: download exports headers `ID,Equipo,Nombre,Apellido,Numero,FechaNacimiento` (UTF-8 BOM so Excel respects accents); upload accepts `yyyy-mm-dd`, `dd/mm/yyyy`, or `dd-mm-yyyy` and shows a preview with valid changes / parse errors / unmatched IDs before committing in 400-op batches.

### Playoffs (Apertura 2026 — auto-seed bracket)
`src/lib/playoffs.js` codifica el bracket de 10 equipos del reglamento (2 play-in + 4 cuartos + 2 semis + 1 final).

**Data model**: cada match doc del playoff lleva tres campos extra:
- `bracketSlot`: uno de `pi-1`/`pi-2`/`qf-1`..`qf-4`/`sf-1`/`sf-2`/`final` — identifica el cruce.
- `homeSeedRef`/`awaySeedRef`: objetos `{ type, ... }` que describen *de dónde sale* el equipo (no el teamId directo). Tipos:
  - `{ type: 'rank', position: N }` — N-ésimo de la tabla general (1..10).
  - `{ type: 'playInWinnerReorder', reorderedPosition: 7|8 }` — ganadores de play-in reordenados por seed (7° = mejor seed, 8° = peor). **Este es el único reseed por tabla del bracket.**
  - `{ type: 'matchWinner', slot: '<bracket-slot>' }` — ganador directo de otro slot. **De cuartos en adelante el bracket es estático** (formato oficial del cliente): `sf-1`=G(`qf-3`,1v8) vs G(`qf-1`,4v5), `sf-2`=G(`qf-4`,2v7) vs G(`qf-2`,3v6), `final`=G(`sf-1`) vs G(`sf-2`). El local nominal sale del lado de mejor seed (sf-1, sf-2 home = lado del 1°/2°), pero la sede se confirma manual.
- El doc de la **temporada** guarda `playoffSeeds: [teamId1..teamId10]` (snapshot ordenado al momento de generar). `resolveSeedToTeamId` lee de ese snapshot, no de la tabla "viva" — así el bracket se mantiene estable si se edita un partido regular después.

**Generación**: `PlayoffGenerator` (tab Fixture en admin) habilita el botón solo cuando todos los regulares están finished/walkover y hay ≥10 equipos en standings. Al confirmar el seeding, escribe `playoffSeeds` en season + los 9 docs en `matches` con seedRefs. Los 4 partidos sin dependencias (play-in + 4°v5° + 3°v6°) ya nacen con `homeTeamId`/`awayTeamId` materializados; los otros 5 con `null`.

**Propagación (`propagateBracket`)**: se invoca después del commit principal de `MatchManager.finishMatch` y `markWalkover`. Para cada match del playoff con teamId null y seedRef seteada, intenta resolver y escribir. Idempotente. Falla silenciosamente (loguea) si la season no tiene seeds o no hay matches del bracket. **Limitación conocida v1**: si el admin edita el score de un partido del bracket ya finalizado y eso cambia el ganador, los downstream materializados quedan stale — hay que resetear manualmente.

**UI bracket** (`src/components/playoffs/PlayoffBracket.jsx`): 4 columnas (Play-in / Cuartos / Semis / Final) con cada slot mostrando equipos resueltos o un placeholder derivado de `seedLabel(seedRef)`. Las líneas conectoras se dibujan con SVG (paths absolute-positioned dentro del wrapper scrollable, calculados via `useLayoutEffect` + `ResizeObserver`) siguiendo `CONNECTIONS` (const en el componente). Como el bracket es estático de cuartos en adelante, **las líneas qf→sf→final son precisas**; solo las líneas play-in→cuartos son indicativas (el reseed 7/8 define qué play-in alimenta `qf-3`/`qf-4`). Por eso únicamente `qf-3`/`qf-4` llevan el tag visual "Reord.".

**FixturePage** tiene tabs Fase regular / Playoffs (`useState`, default calculado: Playoffs si todos los regulares están finished/walkover y hay matches del bracket, sino Regular). La tab Playoffs solo aparece si hay matches con `bracketSlot` para la temporada activa. La lista de fechas regulares filtra fuera los partidos del bracket (`m.bracketSlot` truthy). El `<select>` de fechas vive debajo de las tabs (solo visible en vista regular) para que el header no salte al cambiar entre tabs.

**MatchManager** replica el mismo patrón de tabs. En vista Playoffs agrupa por `phase` (no por `round`) y los headers son `PHASE_HEADER` (Play-in / Cuartos de final / Semifinales / Final) en lugar de "Fecha N". El botón "Agregar partido manual" solo aparece en vista regular.

**Constantes parametrizables**: `PLAYOFF_TEAM_COUNT` y `PLAYOFF_TEMPLATE` están exportadas — si en una temporada futura cambia el formato (8 equipos sin play-in, etc.), conviene crear un template nuevo en vez de parametrizar el existente.

**Botón "Iniciar" en MatchManager**: se deshabilita si el match del bracket no tiene ambos teamIds (todavía espera resolución de ronda previa). El admin sí puede asignar fecha/horario antes de eso.

### Automatic Suspensions
`src/lib/suspensions.js`: only `ejection` events suspend future matches. Each `ejection` carries `suspensionMatches: N` (set via the modal in `LiveScoring`, default 1, min 1, no max). Events without that field (legacy data) default to N=1. 5 personal fouls and 2 flagrants only eject from the current match — they do NOT carry over.

`computeActiveSuspensionsForTeam(currentMatch, recentFinishedMatches, eventsByMatchId, teamId)` walks the team's recent finished matches (ascending), counts how many finished matches happened *after* each ejection, and returns the players whose `N - playedAfter > 0`. `StartMatchModal` calls `findRecentFinishedMatches(allMatches, currentMatch, teamId, MAX_LOOKBACK=10)` and fetches events for each one to feed this. The legacy `findPreviousFinishedMatch` is preserved as a thin wrapper for any external callers.

When the 2nd bench technical fires the captain's auto-ejection (see Event types above), it writes a regular `ejection` event with `suspensionMatches: 1` — the suspension pipeline picks it up automatically.

### Firestore Rules
`firestore.rules` is versioned in the repo. Two non-trivial rules:
- `players`: unauthenticated users can update **only** `pendingPhotoUrl` + `photoStatus` — this powers the token-based self-upload flow at `/jugador/foto/:token` (admin approves to promote to `photoUrl`).
- `auditLog`: create-only for authenticated users; no updates or deletes.

After editing rules, deploy separately with `firebase deploy --only firestore:rules` (hosting deploy does NOT push rules).

### Permission Check Order
`useUserRole.hasPermission` checks in this specific order — preserve it:
1. `!userDoc || !isActive` → false (deactivated users, including deactivated owners, lose access)
2. `isOwner` → true (owner bypass)
3. Specific section permission ('view' / 'edit' / 'none')

`AdminDashboard` filters tab visibility at render: `ownerOnly` tabs (Users, Audit) are hidden from non-owners; the matches tab is shown if the user can view **either** matches or scoring.

### Compact Mode
`LiveScoring` accepts a `compact` prop (driven by `useIsCompactScoring` — landscape-phone heuristic) that reshapes jersey sizes, grid columns, text sizes, and flips the away side to `flex-row-reverse`. The compact mode delegates to `CompactScoringUI`, which renders its own header, jersey columns, and the bench-technical button. Keep both modes in sync when editing the scoring UI — every captain-aware or bench-tech-aware change must touch both files (and `LiveScoring` passes captains/bench counts as props).

### Roles & Permissions
- **Owner**: full access + Users/Audit tabs
- **Admin**: per-section permissions (view/edit/none) for: seasons, teams, players, courts, fixture, matches, scoring, posts
- Components receive `canEdit` prop — hide forms/action buttons when false

### Seasons
- Matches are filtered by `seasonId` — historical data preserved across seasons
- Public pages have season selector dropdown when multiple seasons exist
- Fixture generator creates matches with active season's ID

### Stats Columns Config
`src/lib/statsColumns.js` exports `HIDEABLE_STATS_COLUMNS` — the columns the admin can hide on `/stats` via `SettingsManager`. Visibility is persisted in the `config/stats` document (collection `config`). Identity columns (position, name, team) are not hideable — when adding a new stats column, decide whether it belongs in that list or must remain always visible.

### Cloudinary
- Cloud name: `dttjycffp`, Upload preset: `player_photos`
- Folders: `teams/`, `players/`, `posts/`
- Uses entity ID as `public_id` to overwrite on re-upload (no duplicates)
- Clearing image = set URL to empty in Firestore (Cloudinary keeps file, overwrites on next upload)

### Firebase Config
- Credentials in `.env.local` (see `.env.example`), prefixed `VITE_FIREBASE_*`
- Firebase project: `basquet-ef86a`
- Auth: email/password provider
- `firebase.json` configures hosting (`public: dist`, SPA rewrite of all routes to `/index.html`) and points Firestore rules at `firestore.rules`
- **Analytics (optional)**: `src/lib/firebase.js` initializes `getAnalytics(app)` only when `VITE_FIREBASE_MEASUREMENT_ID` is set and the browser supports it. To enable: in Firebase Console → Project Settings → Integrations → Google Analytics, link a GA4 property; copy the resulting `measurementId` (format `G-XXXXXXXXXX`) into `.env.local`; rebuild and redeploy. Analytics has its own quota and does NOT count against Firestore reads.

### Scripts (in `scripts/`)
- `create-owner.mjs` — Initialize owner user: `node scripts/create-owner.mjs <email> <password> [name]`
- `bulk-players.mjs` — Bulk load players by team
- `add-tokens.mjs` — Add upload tokens to existing players
- `load-match-stats.mjs` — Bulk load match statistics with validation mode
- `seed-emulator.mjs` — Populate the local Firebase Emulator with synthetic data. Connects to `127.0.0.1:8080` (Firestore) and `127.0.0.1:9099` (Auth) directly via `connectFirestoreEmulator`/`connectAuthEmulator`, so no real credentials needed. Run via `npm run seed:emulator` while the emulator is up.
- `seed-triple-tie.mjs` — Mutates 3 emulator matches to force a 3-way tie at 5pts in standings, used to validate the FIBA mini-table cascade (`miniWon → miniDiff → miniFor`). Run **after** `seed:emulator` via `npm run seed:triple-tie`.
- `seed-playoff.mjs` — Seed alternativo: 10 equipos + round-robin completo todo `finished` con scores que producen un ranking 1°..10° unívoco. Permite testear el flujo de "Generar Playoffs" en el admin sin tocar producción. Corre via `npm run seed:playoff` (usar `emulators:fresh` antes para limpiar estado previo).
