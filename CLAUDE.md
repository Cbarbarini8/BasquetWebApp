# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Basketball tournament management web app with real-time updates. Two audiences: public viewers (fixture, standings, stats) and admin (live match scoring, team/player CRUD).

## Tech Stack

- **Frontend:** React 19 + Vite 6 + React Router v7
- **Styling:** TailwindCSS v4 (via @tailwindcss/vite plugin)
- **Backend/DB:** Firebase (Firestore + Auth) — no custom server
- **Real-time:** Firestore `onSnapshot` listeners

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (outputs to `dist/`)
- `npm run lint` — ESLint
- `npm run preview` — Preview production build

## Architecture

### Data Flow
- All data comes from Firestore via real-time `onSnapshot` listeners
- Standings and player stats are **computed client-side** from raw match/event data (not stored as aggregates)
- Match scores are **denormalized** on match documents for fast fixture/standings reads
- When admin adds a scoring event, a Firestore **batch write** atomically adds the event AND increments the score

### Firestore Collections
- `teams` — Team documents (name, shortName)
- `players` — Player documents (firstName, lastName, number, teamId)
- `matches` — Match documents (round, homeTeamId, awayTeamId, homeScore, awayScore, status, quarter)
- `matches/{id}/events` — Event subcollection (type, playerId, teamId, quarter, made)

### Event types
Scoring: `2pt`, `3pt`, `ft` (with `made: true/false`)
Other: `foul`, `assist`, `offRebound`, `defRebound`, `steal`, `block`, `turnover`

### Key Patterns
- `src/hooks/useCollection.js` — Generic real-time Firestore hook; all data hooks build on it
- `src/lib/calculations.js` — Pure functions for standings and player stats computation
- Theme system uses CSS variables on `:root` with `data-theme` attribute (3 themes: blue, orange, dark)
- Admin routes protected via `ProtectedRoute` component + Firebase Auth
- All styles use CSS variables (`var(--color-*)`) for theme support — avoid hardcoded colors

### Firebase Config
Credentials go in `.env.local` (see `.env.example`). Variables are prefixed `VITE_FIREBASE_*`.
