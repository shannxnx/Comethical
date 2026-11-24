# COMETHICAL

**Swipe. Think. Learn. Be Ethical.**

COMETHICAL is an AI-assisted educational mobile game that teaches computer ethics through short, swipeable scenarios. Players judge whether an action is **ethical (swipe left)** or **unethical (swipe right)**, get an explanation when they miss, and face scenarios that adapt to their skill.

It is a native React Native app (Expo SDK 58) that runs in **Expo Go**. It is not a WebView wrapper.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start (local demo mode)](#quick-start-local-demo-mode)
- [Testing on a phone with Expo Go](#testing-on-a-phone-with-expo-go)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Supabase setup (online mode)](#supabase-setup-online-mode)
- [Gemini AI setup](#gemini-ai-setup)
- [Scripts and checks](#scripts-and-checks)
- [Troubleshooting Expo Go](#troubleshooting-expo-go)
- [Manual device testing checklist](#manual-device-testing-checklist)
- [Known limitations](#known-limitations)
- [Future development](#future-development)

---

## Features

- **Swipe gameplay.** The card follows your finger and rotates as you drag. It turns green with an ETHICAL stamp to the left and red with an UNETHICAL stamp to the right. A cancelled swipe springs back. The commit threshold is configurable, haptics tick when you cross it, and **Ethical / Unethical buttons** do the same thing as swiping.
- **Double-input protection.** Rapid swipes, swiping and tapping a button at once, and repeated presses produce only one answer. This is enforced in the store, the demo repository, and the database (`unique(session_id, scenario_id)`).
- **Feedback.** A correct answer shows a short celebration and moves on automatically. A wrong answer opens a learning sheet that stays until you dismiss it. The sheet shows your answer, the correct answer, why, the ethical principles involved and a better alternative. You can also report the scenario from there.
- **Three modes**, defined in one registry (`src/core/game.config.ts`):
  - **Classic**: 20 scenarios with adaptive difficulty.
  - **Endless**: no fixed length, adaptive difficulty, and tracking of your best score and longest streak.
  - **Smart Review**: missed scenarios first, then your weakest topics. A missed scenario is marked reviewed when you answer it correctly.
- **Adaptive difficulty.** A deterministic engine looks at your last 10 answers. It raises difficulty at 80% accuracy or higher, holds between 50% and 79%, and lowers it below 50%. It waits for a minimum number of answers, has a cooldown, moves at most one step at a time, eases off early after 3 wrong answers in a row, and stays between 1 and 10.
- **Scoring and progression.** Base points depend on the difficulty tier, with streak multipliers from 1× to 3×. Milestones at 5, 10, 20 and 30 in a row show a toast and award bonus XP. There are XP levels and 6 ranks, from Digital Rookie to Ethical Legend.
- **Learning analytics.** Accuracy trend, performance by category, strongest and weakest topics, and recommended topics. Nothing is labelled "mastered" until it has 15 or more answers at 85% or higher.
- **Review screen.** Filter by status, category and difficulty, read explanations, retry one scenario or all of them, and mark items reviewed.
- **12 configurable categories** stored as data (id, name, description, icon, color, active).
- **AI pipeline (Gemini).** Generation, schema validation, duplicate filtering, an independent difficulty and ambiguity assessment, and approval statuses (`pending`, `approved`, `rejected`, `flagged`). **Only `approved` scenarios are ever served.**
- **Local demo mode.** The full game runs with no backend, using 72 hand-written seed scenarios and progress stored on the device.
- **Design system.** Dark and light themes through CSS variables, consistent tokens, 48 pt touch targets, and color always paired with text and an icon.

## Tech stack

| Layer | Choice |
|---|---|
| App | React Native 0.88 · Expo SDK 58 · TypeScript (strict, `noUncheckedIndexedAccess`) |
| Navigation | Expo Router 58 (`src/app`), with `Stack.Protected` guards |
| Styling | NativeWind 4.2 + Tailwind 3, themed through CSS variables |
| Animation / gestures | Reanimated 4.7 + Worklets, Gesture Handler 3.3 (`usePanGesture`) |
| State | Zustand 5 (game, auth, stats, persisted settings) |
| Device | expo-haptics, expo-audio (generated WAV effects), AsyncStorage |
| Backend | Supabase: Postgres, Auth, Row Level Security, Edge Functions (Deno) |
| AI | Google Gemini REST API (JSON mode with `responseSchema`), server-side only |
| Tests | jest-expo (Jest 30) |

Every native dependency was installed with `npx expo install`, is included in Expo Go, and passes `npx expo-doctor` (20/20).

---

## Quick start (local demo mode)

Requirements: Node 20 or newer (the scripts use Node's built-in TypeScript type stripping, so `seed:sql` needs Node 22.18+ or 23.6+), and the **Expo Go** app on your phone.

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Without Supabase keys the app starts in **local demo mode**, which a banner makes clear. Demo progress is stored on the device under `comethical.demo.v1` and never mixes with account data. You can clear it from **Profile → Reset demo progress**.

Demo mode covers onboarding, home, swipe gameplay, correct and incorrect feedback, streaks, adaptive difficulty, scoring, results, Smart Review, progress analytics and settings.

## Testing on a phone with Expo Go

1. Put the phone and the computer on the same Wi-Fi.
2. Run `npx expo start`, then scan the QR code.
3. If it can't connect (corporate or guest Wi-Fi, a VPN, a firewall), use the tunnel:

```bash
npx expo start --tunnel
```

To clear the Metro cache: `npx expo start --clear`.

---

## Project structure

```text
comethical/
├── src/
│   ├── app/                      # Expo Router routes (screens only)
│   │   ├── _layout.tsx           # providers, theme, protected route groups
│   │   ├── index.tsx             # branded splash + routing
│   │   ├── onboarding.tsx        # 4 slides + interactive practice card
│   │   ├── reset-password.tsx    # deep link target for password reset
│   │   ├── (auth)/               # sign-in, sign-up, forgot-password
│   │   ├── (tabs)/               # home, progress, review, profile
│   │   └── game/[mode].tsx, game/results.tsx   # immersive, outside the tabs
│   ├── core/                     # framework-free game rules, SHARED with Edge Functions
│   │   ├── game.config.ts  difficulty.config.ts  scoring.config.ts  categories.ts
│   │   ├── swipe.ts  scoring.ts  difficulty.ts  session.ts  selection.ts
│   │   └── scenario-validation.ts  similarity.ts  types.ts
│   ├── config/                   # app-facing config (re-exports core + theme.config.ts)
│   ├── components/{ui,game,feedback}/
│   ├── features/{auth,analytics,gameplay}/
│   ├── services/                 # repository interface: demo + online implementations, feedback
│   ├── stores/                   # zustand: game, auth, stats, settings
│   ├── hooks/  lib/  types/  utils/
│   └── data/seed-scenarios.ts    # 72 hand-written scenarios
├── supabase/
│   ├── migrations/20261125000000_init.sql
│   ├── seed.sql                  # generated from src (npm run seed:sql)
│   ├── config.toml
│   └── functions/
│       ├── _shared/              # http, auth, gemini, prompts, assessment, core/ (synced copy)
│       ├── select-scenarios/     # start session / next scenarios (no answers returned)
│       ├── submit-answer/        # server-side answer validation and scoring
│       ├── complete-session/
│       ├── generate-scenarios/   # admin: Gemini batch generation
│       ├── assess-difficulty/    # admin: independent difficulty re-scoring
│       └── validate-scenarios/   # admin: AI review → approval status; manual approve/reject
├── scripts/                      # sync-core, generate-seed-sql, generate-sounds
├── tests/                        # 124 unit tests
└── assets/sounds/                # generated UI sound effects
```

## Architecture

- **One rulebook.** `src/core` has no React, Expo or Deno imports. The app imports it directly. `npm run sync:core` copies it into `supabase/functions/_shared/core`, adding the `.ts` import extensions Deno needs. A test fails if the two copies drift apart, so client and server cannot disagree on scoring, streaks, XP or difficulty.
- **Repository boundary.** Screens and stores call a single `GameRepository` interface (`src/types/game.ts`):
  - `DemoRepository` runs the core rules on the device against the seed bank.
  - `OnlineRepository` calls Edge Functions for every scored action and reads its own rows through RLS.

  `getRepository()` chooses the online repository whenever Supabase is configured. It never quietly falls back to demo data.
- **Game controller.** `src/stores/game-store.ts` is a small state machine: `loading → ready → submitting → correct | incorrect → …`. It has synchronous guards against double input, a stale-session token to handle races, prefetching (keeps 4 cards queued and refills at 2), and an error path that puts the card back.
- **Adding a mode** (Survival, Time Attack, Topic Mastery, Daily Challenge): add an entry to `GAME_MODES` with its own `sessionLength`, `timeLimitSeconds`, `lives`, `source` and `adaptiveDifficulty`. Then extend `game_sessions.game_mode` in a migration.

---

## Supabase setup (online mode)

1. **Create a project** at [supabase.com](https://supabase.com).
2. **Configure the app.** Copy `.env.example` to `.env` and fill in:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable / anon key>
   ```
   Restart with `npx expo start --clear`. Only these two public values go into the app.
3. **Apply the schema and seed data** with the Supabase CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push                 # runs supabase/migrations
   # then load the seed: paste supabase/seed.sql into the dashboard SQL editor,
   # or: psql "<connection string>" -f supabase/seed.sql
   ```
   For a local stack, `npx supabase start` followed by `npx supabase db reset` applies the migration and the seed.
4. **Auth.** In the Auth settings, add `comethical://reset-password` to the redirect URLs. When testing in Expo Go, also add the `exp://…/--/reset-password` URL that Expo prints. Turn email confirmation on or off as you prefer; the sign-up screen handles both.
5. **Deploy the Edge Functions:**
   ```bash
   npx supabase functions deploy select-scenarios --no-verify-jwt
   npx supabase functions deploy submit-answer --no-verify-jwt
   npx supabase functions deploy complete-session --no-verify-jwt
   npx supabase functions deploy generate-scenarios --no-verify-jwt
   npx supabase functions deploy assess-difficulty --no-verify-jwt
   npx supabase functions deploy validate-scenarios --no-verify-jwt
   ```
   The player functions check the user's JWT themselves (`requireUser`) and return friendly errors. The admin functions require the `x-admin-key` header.

**Security model (from the migration):**
- Clients have **no access** to `scenarios`, so answers never leak before a player responds. Scenarios are served by `select-scenarios`, and only after answering does `submit-answer` reveal the explanation.
- `profiles`: players can read their own row and update only `username` and `avatar_url`, enforced with column-level grants. XP, level and streaks are written only by the service role.
- Sessions, answers, topic stats and review items are read-own only. All writes go through `record_answer` and `complete_session`, which are `security definer` functions that only the service role can execute. They run in a single transaction with optimistic concurrency and duplicate protection.
- `get_review_items()` and `mark_review_item_reviewed()` are scoped to `auth.uid()`.

## Gemini AI setup

Store the secrets on the server. Never put them in `.env` or in the app:

```bash
npx supabase secrets set GEMINI_API_KEY=<key> ADMIN_API_KEY=<long-random-string>
# optional
npx supabase secrets set GEMINI_MODEL=gemini-flash-latest AUTO_APPROVE_VALIDATED=false GENERATION_HOURLY_LIMIT=10
```

**Generate a batch.** Each batch is validated, deduplicated, stored as `pending` and then assessed automatically:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/generate-scenarios" \
  -H "x-admin-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"count": 10, "difficultyMin": 3, "difficultyMax": 8}'
```

**Re-assess difficulty** without changing approval status:
`POST /functions/v1/assess-difficulty  {"status": "approved", "limit": 20}`

**AI validation pass** on pending scenarios. Ambiguous ones become `flagged`, wrong or misleading ones become `rejected`:
`POST /functions/v1/validate-scenarios  {"limit": 10}`

**Human approval** (the default path, because AI output is never treated as authoritative):
`POST /functions/v1/validate-scenarios  {"scenarioIds": ["…"], "setStatus": "approved", "notes": "Reviewed"}`

Set `AUTO_APPROVE_VALIDATED=true` only if you accept AI-reviewed scenarios without a human check. The `scenario_calibration` view compares the AI difficulty estimate with real player accuracy, so you can recalibrate later.

**Built-in safeguards:** 45 s timeouts, up to 3 retries with backoff on 429 and 5xx, JSON-mode output checked against a schema, rejection of invented citations or links, near-duplicate detection (Jaccard similarity on word n-grams), a per-hour rate limit, logging of every call to `ai_generation_logs`, and **no player data sent to the model**. Gameplay never calls the AI, so the app stays playable while Gemini is down.

---

## Scripts and checks

| Command | What it does |
|---|---|
| `npm start` / `npx expo start` | Dev server (Expo Go) |
| `npx expo start --tunnel` | Tunnel connection fallback |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` (ESLint flat config, eslint-config-expo) |
| `npm test` | Jest unit tests |
| `npm run doctor` | `expo-doctor` |
| `npm run sync:core` | Copy `src/core` into the Edge Functions (run after editing core) |
| `npm run seed:sql` | Regenerate `supabase/seed.sql` from the TypeScript seed data |
| `npm run sounds` | Regenerate the sound effects |

Test coverage includes swipe mapping and thresholds, answer correctness, streak increments and resets, score multipliers, XP, levels and ranks, adaptive difficulty thresholds, cooldown and min/max limits, scenario selection (no repeats, difficulty targeting, answer-pattern balancing, review priority), duplicate-scenario detection, session completion, AI response validation (invalid JSON, schema errors, citations, ambiguous items flagged), rapid and simultaneous input, network failure recovery, an empty scenario bank, duplicate submissions, abandoned sessions, persistence and corrupt storage, seed data integrity, and sync between core and the server copy.

To type-check the Edge Functions (they run on Deno):

```bash
cd supabase/functions && npx deno@2 check */index.ts
```

## Troubleshooting Expo Go

- **"Project is incompatible with this version of Expo Go"**: update Expo Go from the store. This project targets SDK 58.
- **QR code scans but loading stalls**: the phone and computer are on different networks, or a firewall blocks port 8081. Use `npx expo start --tunnel`.
- **Styles missing after editing the Tailwind config**: run `npx expo start --clear`.
- **Still in demo mode after adding keys**: env values are read when the bundle is built. Restart with `--clear`, and check that the URL starts with `https://` and the key is the publishable/anon key.
- **Edge Function 401s**: your session expired. Sign out and back in.

## Manual device testing checklist

The following were **not** tested on a physical device during development. Please check them on real Android and iOS hardware with Expo Go:

- [ ] App launches from the QR code; the splash, then onboarding, appear
- [ ] Swipe feel: drag, rotation, green/red tint, stamps, snap-back on short drags, fling to commit
- [ ] Haptics: tick at the threshold, success/warning on answers (toggle in Profile)
- [ ] Sounds play, respect the silent switch, and the toggle works
- [ ] Ethical/Unethical buttons match swipe behaviour; double-tapping or swiping while tapping gives one answer
- [ ] Wrong answer shows the learning sheet, which stays until Continue
- [ ] Streak toast at 5 in a row; difficulty-change toast
- [ ] Android hardware back during a game asks before leaving; leaving abandons the session
- [ ] iOS swipe-back is disabled on the game screen
- [ ] Results: Play again, Review mistakes, Return home; Android back goes home
- [ ] Backgrounding the app mid-game and returning resumes the same card
- [ ] Airplane mode in online mode shows a friendly error, and the card returns for retry
- [ ] Small screens (such as iPhone SE) and long scenario text fit without clipping
- [ ] Light and System themes look right
- [ ] Online: sign up, sign in, sign out, password reset deep link, progress persists across devices

**Verified in development:** `tsc` clean, lint clean, 124/124 tests passing, `expo-doctor` 20/20, Android production bundle export succeeded, `deno check` passes for all Edge Functions, and a web-preview walkthrough of onboarding, swiping, the feedback sheet, a full Classic session, results, home and profile in demo mode.

## Known limitations

- The app icon and splash images are still the Expo template defaults. Replace the files in `assets/`.
- Online mode (Supabase and Gemini) is fully implemented but has not been run against a live project in this environment. It needs your own keys.
- AI generation is triggered by an admin endpoint. Automatic replenishment needs a scheduler such as Supabase Cron or `pg_cron` calling `generate-scenarios`.
- Approving AI scenarios is done through the admin endpoint or SQL. There is no admin web dashboard (out of MVP scope).
- A demo session in progress lives in memory. If the app is killed mid-session, the answers already given are kept, but the session does not appear in history.
- Endless mode in demo reuses the 72-scenario bank once it runs out. Online, it draws from the approved bank.
- Reanimated entrance animations can run slowly in background browser tabs. This only affects the web preview.

## Future development

- Survival, Time Attack, Topic Mastery and Daily Challenge modes (the mode registry is ready)
- Teacher dashboard and classrooms, built on `scenario_reports` and the approval workflow
- Difficulty calibration job using `scenario_calibration` (player accuracy compared with the AI estimate)
- Scheduled scenario replenishment and a human review queue UI
- Achievements, leaderboards and push reminders (outside the MVP)
- EAS builds for store distribution
