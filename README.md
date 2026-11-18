# Royal Casino

A premium black-and-gold online casino that runs entirely on your machine. It uses **virtual credits only**: nothing is bought, sold or withdrawn, and all data lives in a local SQLite file.

All branding, game names, studios, artwork and sounds are original. Game artwork is vector art drawn in code: slots show a reel cabinet with the title's own symbol, roulette a 37-pocket wheel, blackjack and Hold'em cards and chips, each on the game's palette and motif. Sound effects are synthesised in the browser. The app ships no third-party images or audio files.

## Tech stack

| Layer      | Choice                                       |
| ---------- | -------------------------------------------- |
| Framework  | Next.js 15 (App Router, Server Components)   |
| Language   | TypeScript (strict)                          |
| Styling    | Tailwind CSS v4 (CSS-first `@theme`)         |
| Database   | SQLite through Prisma ORM 6                  |
| Auth       | Argon2id (`@node-rs/argon2`), DB sessions    |
| Animation  | Framer Motion 12                             |
| Validation | Zod 4                                        |
| Icons      | lucide-react                                 |

## Runs locally only

Royal Casino is built to run on your own computer. **Do not deploy it to a public server.** It is a play-money demo: the development seed creates an account with a published password (`guest`), the rate limiter lives in one process's memory, and SQLite is a single local file. Opening it to other devices on your home network is fine (see [LAN access](#lan-access)).

## Installation

### 1. Requirements

- **Node.js 20.12 or newer** (built and tested on Node 24 with npm 11). Check with `node -v`. Download from nodejs.org if needed.
- About 600 MB of free disk space for dependencies.
- Windows, macOS or Linux. Commands below work in PowerShell, Terminal or any bash shell.

### 2. Install dependencies

Open a terminal in the project folder (the one with `package.json`) and run:

```bash
npm install
```

This also generates the Prisma database client. If npm 11+ warns that install scripts were blocked, approve them and rebuild (Prisma needs its postinstall step):

```bash
npm install-scripts approve prisma @prisma/engines @prisma/client esbuild
npm rebuild
```

### 3. Create the configuration file

Copy the example settings. They work as they are:

```bash
cp .env.example .env          # macOS / Linux / Git Bash
copy .env.example .env        # Windows PowerShell or cmd
```

`.env` holds the database path and the optional admin-seed settings. It is ignored by git and never sent to the browser.

### 4. Create the database

```bash
npm run setup
```

This creates `prisma/casino.db` and loads the demo catalogue, VIP tiers, offers, showcase players and the demo account.

### 5. (Optional) Create an admin account

```bash
npm run db:seed:admin
```

With `ADMIN_PASSWORD` left empty in `.env`, a strong password is generated and **printed once** in the terminal. Save it. See [Admin accounts](#admin-accounts-development-only).

## Starting the app

**Development** (hot reload, while you change code):

```bash
npm run dev
```

**Production build** (faster, what a player would see):

```bash
npm run build
npm run start
```

Then open **http://localhost:3000** and log in with the demo account, or register (new accounts start with 10,000 credits):

| Username | Password       | Role   |
| -------- | -------------- | ------ |
| `guest`  | `crownjewels7` | `USER` |

The login page shows these demo credentials in development builds only. Stop the server with **Ctrl + C** in its terminal.

### LAN access

`npm run start` also listens on your network address (shown as "Network" when it starts), so a phone on the same Wi-Fi can open it. Production cookies are `Secure` and need HTTPS, so for plain HTTP on a LAN set `INSECURE_COOKIES=1` in `.env` and restart. Leave `TRUST_PROXY` unset unless a reverse proxy sits in front.

### Troubleshooting

| Symptom | Fix |
| ------- | --- |
| "The local database isn't set up yet" or `no such table` | Run `npm run setup`. |
| `Port 3000 is in use` | Stop the other server, or use another port: `npm run dev -- -p 4000` / `npm run start -- -p 4000`. |
| `EPERM ... query_engine` during `npm install` or `prisma generate` (Windows) | A running server holds the Prisma engine open. Stop it (Ctrl + C) and run the command again. |
| The production site shows errors after you also ran `npm run dev` | Dev and production share the `.next` folder. Run one at a time, and `npm run build` again before `npm run start`. |
| "Too many attempts" on login or sign-up | Rate limits reset after their window (15–60 minutes) or when the server restarts. |
| Forgot the admin password | Run `npm run db:seed:admin` again; it resets the password and prints a new one. |
| Offers page is empty | `npm run db:promotions` reloads just the offers. |

### Upgrading from an earlier version

This version replaced the `Player` model with `User`, `Wallet` and `Transaction`, and moved the database to `prisma/casino.db` (set in `.env`). Your old `prisma/royal.db` is left untouched. Delete it once you no longer need it. To create the new database:

```bash
cp .env.example .env     # or set DATABASE_URL="file:./casino.db" yourself
npm run setup
```

The demo wallet added transaction statuses, idempotency keys, deposit fields and the `AuditLog` table. Later releases added `GameRound`, `UserAchievement`, game engines, avatars, bonus streaks, tier bonus amounts, account status, game availability and audit targets. All changes are additive, so an existing `casino.db` upgrades in place without data loss. Re-seed afterwards to load the new catalogue:

```bash
npm run db:push
npm run db:seed
```

## Commands

| Command                 | What it does                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`           | Start the development server with hot reload (port 3000)                          |
| `npm run build`         | Create an optimised production build                                              |
| `npm run start`         | Serve the production build (run `build` first)                                    |
| `npm run typecheck`     | Type-check the project with `tsc --noEmit`                                        |
| `npm run setup`         | `db:push` then `db:seed`; first-time database setup                               |
| `npm run db:generate`   | Regenerate the Prisma client after editing `prisma/schema.prisma`                 |
| `npm run db:push`       | Sync the schema to the SQLite database                                            |
| `npm run db:seed`       | Replace catalogue and **all USER accounts** with demo data. ADMIN accounts are kept |
| `npm run db:seed:admin` | **Development only.** Create or reset an ADMIN account from `.env`                |
| `npm run db:promotions` | Reload only the offers on `/promotions` (players and history are kept)            |
| `npm run db:reset`      | Drop the database, recreate it and re-seed it (admins included in the wipe)       |
| `npm run db:studio`     | Open Prisma Studio to browse and edit data in your browser                        |
| `npm test`              | Run the Vitest suite against a throwaway `prisma/test.db`: auth, sessions, authorization, wallet, game rules and payouts, duplicate/stale/race protection |
| `npm run test:watch`    | Run the tests in watch mode                                                        |
| `npm run sim:rtp`       | Monte Carlo RTP for slots (free spins included), blackjack (basic strategy) and roulette, using the production RNG |
| `npm run test:wallet`   | Wallet service self-test: concurrency, duplicates, rollback, limits, ledger and audit (uses a throwaway user) |

To use another port: `npm run dev -- -p 4000` or `npm run start -- -p 4000`. To simulate a different number of rounds: `npm run sim:rtp -- 5000000`.

## Admin accounts (development only)

`npm run db:seed:admin` runs `prisma/seed-admin.ts`, which:

- **refuses to run** when `NODE_ENV=production`;
- reads `ADMIN_USERNAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` or the shell. These are server-side variables, never prefixed `NEXT_PUBLIC_`, and never imported by app code;
- if `ADMIN_PASSWORD` is empty, generates a strong random password and **prints it once** to your terminal. Only its Argon2id hash is stored;
- if the user already exists, promotes it to ADMIN, resets its password and revokes its sessions.

Admin credentials are never written to source code, the seed data, the login page or any client bundle.

Sign in with that account and open `/admin` (or the shield icon in the header). See [Administration dashboard](#administration-dashboard) below.

## Pages

| Route                 | Access    | Description                                                                         |
| --------------------- | --------- | ----------------------------------------------------------------------------------- |
| `/`                   | Public    | Home: PLAY LIKE ROYALTY hero, featured, popular and new games, VIP promotion, recent demo winners, casino statistics |
| `/games`              | Public    | Full catalogue with category chips, search, sorting and a favourites filter         |
| `/games/[slug]`       | Public    | Game details: artwork, RTP, volatility, bet limits, jackpot, related games          |
| `/games/[slug]/play`  | USER      | The game's table: slots, blackjack, European roulette or Texas Hold'em (resumes an unfinished round) |
| `/wallet`             | USER      | **DEMO** wallet overview: main virtual balance, display currency, demo BTC/ETH/USDT view, daily bonus, recent activity |
| `/wallet/deposit`     | USER      | **DEMO** deposit simulator: currency choice, DEMO ONLY QR code, pending deposits to confirm or cancel |
| `/wallet/history`     | USER      | Filterable, paginated transaction history with statuses, ledger reconciliation and the audit trail |
| `/profile`            | USER      | Avatar, username, join date, virtual balance, games played and won, VIP progress, daily bonus, statistics with charts, achievements, recent games |
| `/profile/history`    | USER      | Full game history: every settled round with result, stake and net; filter by game |
| `/profile/settings`   | USER      | Account settings: avatar, display name and email, password, sound, privacy, sessions |
| `/admin`              | ADMIN     | Dashboard: accounts, active users, games played, credits in circulation, ledger integrity, rounds per day, top games, recent activity |
| `/admin/users`        | ADMIN     | Search and filter accounts; `/admin/users/[id]` shows the profile with status, role, sessions, wallet adjustment, games, transactions and audit history |
| `/admin/games`        | ADMIN     | Enable or disable games; `/admin/games/[id]` edits limits, lobby flags and demo payout rules, with change history |
| `/admin/transactions` | ADMIN     | Every demo transaction, filterable by status and type, searchable by user or reference |
| `/admin/audit`        | ADMIN     | Append-only audit log: administrator actions or all activity, with timestamps, actor, account, before/after |
| `/login`, `/register` | Public    | Account access; both return you to the page you came from                           |
| `/vip`                | Public    | The Royal Circle: Bronze to Diamond, live benefits, and (signed in) your progress and daily bonus |
| `/promotions`         | Public    | Offers that describe real features (welcome credits, daily bonus, free spins, jackpots, VIP), with key terms and a link to each |
| `/responsible-gaming` | Public    | Safer-play guidance, warning signs, support organisations and an FAQ                |

The games page accepts query parameters, which are validated with Zod. Invalid values fall back to the defaults:
`?category=slots|live|table|jackpots|instant`, `?q=<text>`, `?sort=popular|new|rtp|name`, `?favorites=1`.

## Authentication and security

### Data model

| Model         | Purpose                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------- |
| `User`        | Username, email, display name, Argon2id `passwordHash`, `role` (`USER`/`ADMIN` enum), VIP points |
| `Session`     | One row per signed-in browser. The primary key is the **SHA-256 of the token**, plus expiry, user agent and IP |
| `Wallet`      | One per user: balance (integer cents), display-currency preference and daily-bonus timestamp |
| `Transaction` | Ledger rows (`signup`, `bonus`, `deposit`, `bet`, `win`, `adjustment`) with a status, public reference, idempotency key and the resulting balance |
| `AuditLog`    | Append-only record of every balance change and wallet event: actor, balance before/after, IP, user agent |
| `UserAchievement` | Earned badges with their unlock date (insert-only)                                   |
| `GameRound`   | One round of any game: secret engine state (server only), version, request ids, amounts staked and returned |

### Passwords

- **Hashing:** Argon2id with the OWASP baseline (19 MiB memory, 2 iterations, 1 lane) in `src/lib/password.ts`. Plain-text passwords are never stored or logged.
- **Policy:** at least 10 characters, with a letter and a number, and not containing the username. It is enforced with Zod on the server, and the strength meter on the form is advisory only.
- **No account enumeration:** a login for a username that does not exist still runs a dummy hash check, so response timing doesn't reveal which accounts exist. The error message is the same for a wrong username and a wrong password.

### Sessions and cookies (`src/lib/auth.ts`)

- **Token:** 32 random bytes (base64url) live only in the cookie. The database stores the SHA-256 hash, so a leaked database can't be replayed as sessions.
- **Cookie:** `HttpOnly`, `SameSite=Lax` and `Path=/`, with a 30-day lifetime. In production builds it is also `Secure` and uses the `__Host-` prefix (`__Host-rc_session`). To serve a production build over plain HTTP on a LAN address, set `INSECURE_COOKIES=1`.
- **Renewal:** the session is extended at most once a day when authenticated actions run.
- **Fixation and revocation:**
  - Login always issues a fresh token and revokes any token the browser already carried.
  - Changing your password revokes every session and issues a new one for the current browser.
  - Sessions created before a password change are rejected.
  - **Sign out other devices** on the profile page revokes everything except the current session.

### Route protection

- **Middleware** (`src/middleware.ts`): sends requests without a session cookie for `/wallet`, `/profile`, `/admin` and `/games/*/play` to `/login?next=…`.
- **Server checks:** every protected page and server action independently checks the session against the database with `requireUser()` or `requireAdmin()`. A forged or expired cookie never reaches protected content.
- **Admin area:** non-admins see a 404 (including the page title), so the admin area's existence isn't confirmed. The Admin links in the header and sidebar are cosmetic; the server enforces the role.
- **Redirects:** `next=` redirect targets are restricted to same-site paths: one leading `/`, printable ASCII, no spaces, tabs, newlines or backslashes (browsers strip or rewrite those, so `/	/evil.example` would otherwise become `//evil.example`).
- **Client IP and rate limits:** `X-Forwarded-For` / `X-Real-IP` are sent by the client and `next start` passes a forged one through unchanged, so they are read only when `TRUST_PROXY=1` (set it behind a reverse proxy that overwrites them). Otherwise every request shares one per-IP bucket, which is what a local install sees anyway. The per-account login limit is keyed on the account, so alternating username and email does not add attempts.
- **Security headers** (`next.config.ts`): a Content-Security-Policy that allows only the site's own scripts, styles, fonts and images (`frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`), plus `X-Frame-Options`, `nosniff`, a strict referrer policy and a locked-down permissions policy.
- **Roles:** never taken from user input. Registration always creates a `USER`.

### Validation

Every form and server action parses its input with Zod (`src/lib/validations.ts`):

- usernames are lowercased and limited to `[a-z0-9_]`, and staff-like names such as `admin` are reserved;
- emails are normalised to lowercase;
- display names use a restricted character set;
- bets, ids and admin amounts are bounds-checked.

### Rate limiting (`src/lib/rate-limit.ts`)

| Endpoint          | Limit                                         |
| ----------------- | --------------------------------------------- |
| Login             | 20 per IP and 5 per account, per 15 minutes   |
| Register          | 5 per IP per hour                             |
| Password change   | 5 per user per 15 minutes                     |
| Demo deposit      | 10 per user per 10 minutes                    |
| Confirm / cancel  | 60 per user per 10 minutes                    |

A successful login clears that account's counter. The limiter keeps counts in process memory, which suits this single-process local app; a multi-instance deployment would move it to a shared store such as Redis.

### Other hardening

- **Security headers** on every response: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`.
- **CSRF:** server actions are POST-only and checked against the request origin by Next.js, and `SameSite=Lax` blocks cross-site cookie use.
- **Client components** receive only display fields (name, balance, tier). Password hashes, emails of other users and session data stay on the server.

## Demo wallet

> **Simulation only.** Royal Casino uses virtual credits. There are no real-money deposits or withdrawals, no payment providers and no cryptocurrency transfers. Nothing in the code contacts a blockchain, exchange or price feed. Every wallet page carries a DEMO banner, and every wallet card carries a DEMO tag.

### What the player sees

- **Main virtual balance:** always held in credits. The player can choose to *display* it in credits or in demo BTC, ETH or USDT.
- **Demo currency view:** the balance expressed in each demo coin at **fixed demo rates** (1 BTC = 65,000 credits, 1 ETH = 3,200, 1 USDT = 1). These are constants, not market prices.
- **Demo deposit:** pick a demo currency and an amount (100–25,000 credits). This creates a **pending** deposit with:
  - a demo address that is deliberately invalid on every real network (`DEMO-BTC-XXXX-…`);
  - a QR code that encodes a plain-text warning, not a payment URI, with a DEMO ONLY overlay.

  The player then clicks **Simulate confirmation**, which credits the wallet, or **Cancel**. Unconfirmed deposits expire after 30 minutes.
- **Statuses:** `pending`, `completed`, `failed`, `cancelled` and `expired`, shown as badges in the history. Amounts that were never applied appear struck through.
- **History:** filter by type and status, 25 rows per page. A badge confirms that the sum of completed ledger rows equals the stored balance.
- **Audit trail:** the last 40 wallet events with balance before and after, the actor and a masked IP. Admins see the same feed across all members on `/admin`.

### How it is built

| Piece | File | Responsibility |
| ----- | ---- | -------------- |
| Wallet service | `src/lib/wallet/service.ts` | The **only** code that changes `Wallet.balance`. `postEntry()` applies the balance change, writes the ledger row and the audit row in one database transaction. |
| Transaction service | `src/lib/wallet/transactions.ts` | Demo deposit lifecycle (create, confirm, cancel, expire) and ledger/audit reads. |
| Currencies & limits | `src/lib/wallet/currencies.ts`, `limits.ts` | Fixed demo rates with exact BigInt conversion, and all wallet limits. Shared with the UI for hints only. |
| Actions | `src/lib/actions/wallet.ts` | Authenticated, rate-limited, Zod-validated server actions. |

**Guarantees**

- **Server-only balances.** No action accepts a balance, wallet id or user id from the browser. The wallet comes from the session, and the browser supplies only an amount, a currency or a transaction id. Each is validated and bounds-checked, and any extra form fields are ignored.
- **Balance validation:**
  - every amount must be a positive whole number of cents within limits;
  - debits are conditional (`balance >= amount`), so a balance can never go negative;
  - credits are capped at 10,000,000 credits, which keeps the value well inside the database column.
- **Atomic database transactions.** Balance change, ledger row and audit row commit together or not at all. A deposit confirmation claims the pending row first, so only one of many parallel confirmations can credit it.
- **Duplicate transaction protection:**
  - each deposit form, slot spin and admin adjustment carries a client-generated request id, unique per wallet in the database;
  - a replayed or double-submitted request is recognised and never applied twice;
  - the daily bonus is additionally guarded by its cooldown.
- **Audit history.** `AuditLog` rows are only ever inserted; no code path updates or deletes them.
- **Concurrency:**
  - SQLite allows one writer, so the Prisma client uses a single connection (`src/lib/db.ts`) and queues transactions instead of colliding on the lock;
  - transient lock errors are retried, which is safe because the transaction was fully rolled back.
- **Demo limits:**
  - 100,000 credits of deposits per rolling 24 hours;
  - at most 3 pending deposits at once;
  - 10 deposit requests per 10 minutes.

Run `npm run test:wallet` to check all of this against the real service. The script:

- fires 20 parallel bets at a 1,000-credit balance (exactly 10 succeed);
- replays request ids;
- confirms one deposit 8 times in parallel (credited once);
- forces a rollback mid-transaction;
- checks the daily cap and the balance ceiling;
- verifies that the ledger and audit trail reconcile.

## Games

Four complete games, all played with virtual credits. Every catalogue entry runs on one of them: the 22 listed games are themed tables and machines for these four engines.

| Engine | Games | Rules in brief | RTP |
| ------ | ----- | -------------- | --- |
| **Slots** | 6 slots, 4 jackpot slots, 2 instant | 5×3 reels, 1–20 selectable paylines. **Wild** (reels 2–5) substitutes and pays line wins ×2. **Scatter** pays 2/10/50× total bet anywhere and 3+ start **free spins** (8/12/20, every win ×3, retriggers up to 50). Jackpot slots add a real **progressive pool**: 1% of each stake feeds it; win chance = contribution ÷ pool. | 95.6% (+1% pool on jackpot slots) |
| **Blackjack** | Obsidian, Classic, Turbo | 6 decks shuffled every hand, dealer stands on all 17s and peeks, blackjack pays 3:2, double on any first two cards. No split, insurance or surrender. | 99.0% with basic strategy |
| **European roulette** | Grand Salon, French Gold, Monte Carlo, Express | Single zero, numbers 0–36. Straight up 35:1; dozens and columns 2:1; red/black, odd/even, 1–18/19–36 1:1. Zero loses all outside bets. | 97.3% |
| **Texas Hold'em** | Midnight (3 AI), High Stakes (4 AI), Heads-Up (1 AI) | Fixed limit: blinds, small bets pre-flop/flop, big bets turn/river, max 4 bets per street. Pre-flop, flop, turn, river, showdown; best five of seven wins; ties split (odd cent left of the button). | No rake (you play the AI) |

### Engine design (`src/lib/games/`)

- **Pure engines.** `slots/engine.ts`, `blackjack/engine.ts`, `roulette/engine.ts`, `holdem/{evaluator,game,ai}.ts` are plain functions of state and an injected random source. They contain no I/O, so the tests drive them with seeded or scripted RNGs.
- **Cryptographic RNG.** Live play uses `secureRng` (`node:crypto` `randomInt`, the OS CSPRNG). Decks are shuffled with an unbiased Fisher–Yates; slot reels and roulette pockets are drawn directly. `Math.random` is never used for an outcome.
- **AI opponents** (`holdem/ai.ts`) see only what a player in their seat would see: their own hole cards, the board, the pot and the betting. `decide()` takes exactly those inputs, never the deck or other hands. Each bot estimates equity by Monte Carlo over the unseen cards and plays to a personality (tight, loose, aggressive, bluffer).

### Server authority (`src/lib/games/server/`, `src/lib/actions/games.ts`)

- **The browser sends intents only:** a stake, a line count, bet positions or a move. It never sends results, payouts or balances. Payouts are computed on the server from the engine result. Extra fields such as a forged `returned` are ignored, and every input is validated with Zod.
- **State stays on the server.** Each round lives in `GameRound.state`: the shoe or deck, hidden cards and free spins. Clients receive a derived view with the dealer's hole card, opponents' cards and the deck removed.
- **Every move is validated.** Illegal moves (doubling after a hit, checking when facing a bet, acting out of turn, acting on someone else's round) are rejected without touching the wallet.
- **Duplicate and stale protection:**
  - every request carries a client request id;
  - a repeated start returns the original round (`@@unique([userId, requestId])`), and a repeated action returns the current state instead of re-applying;
  - multi-step actions also carry the round `version`, applied with a compare-and-set, so parallel or stale requests change nothing;
  - wallet entries reuse the request id as their idempotency key;
  - the client retries a network failure once with the same id, which is safe;
  - one live blackjack or Hold'em hand per table, and free spins must be finished before the next paid spin.
- **Atomic money.** State change, stakes, returns, VIP points and audit rows commit in one database transaction through the wallet service. A stake without funds rolls the whole move back.
- **Ledger types:** stakes are `bet`, payouts are `win`, a blackjack push returns the stake as `refund`, and Hold'em winnings are `win` for the pot share.

### Tests

`npm test` runs 137 tests. They use their own database, `prisma/test.db`, which `tests/support/global-setup.ts` recreates from the schema before every run, so tests never read or change `prisma/casino.db`.

| File | Covers |
| ---- | ------ |
| `tests/slots.test.ts` | Paylines, active-line limits, wild substitution and ×2, scatter pays and free-spin awards, ×3 bonus multiplier, retrigger cap, jackpot contribution and draw odds, bet limits, simulated RTP band |
| `tests/blackjack.test.ts` | Soft/hard totals, naturals, S17 dealer, peek, 3:2, push, bust, double, illegal moves, hidden hole card |
| `tests/roulette.test.ts` | Wheel layout and colours, every bet type, zero, validation, exact payouts, 2.70% edge per bet, RNG uniformity |
| `tests/holdem.test.ts` | All hand categories, wheel straights, kickers, best-of-seven, blinds and heads-up order, streets, bet sizes and cap, fold-outs, showdown, split pots with odd cents, hidden cards, AI equity and legality |
| `tests/admin.test.ts` | No code outside the wallet service writes a balance (static scan); payout config parsing and derived RTP; pay scale, 6:5, H17 and La Partage rules; integrity check catches an unaudited write; disabled games refuse new rounds but finish live ones |
| `tests/auth.test.ts` | Registration (Argon2id hash, funded and audited wallet, role/balance from the form ignored, field validation, duplicates, parallel sign-up), login (username/email, generic errors, per-account and per-IP limits that forged `X-Forwarded-For` cannot reset, suspended accounts, off-site `next` blocked), sessions (hashed tokens, tampered and expired tokens, logout, fixation, password change revokes other devices) |
| `tests/security.test.ts` | Every admin action refuses signed-out visitors and USERs; demotion takes effect at once; admins cannot change their own role, status or wallet; audited, idempotent adjustments; deposits deduplicated, confirmed once under parallel clicks, never by another player; double-clicked daily bonus pays once; game request ids cannot be replayed across games; parallel spins never overdraw; ledger integrity at the end |
| `tests/vip.test.ts` | Tier progress, bonus maths and streak window, avatars, achievement rules, round summaries, stats and insert-only badge storage against the database |
| `tests/game-server.test.ts` | Real server functions on the database: replayed and parallel requests charge once, stale versions are rejected, illegal moves leave the wallet alone, funds checks, table limits, bonus rounds, jackpot funding, ledger/round reconciliation |

## VIP system

### Progress from simulated activity only

- **Earning:** Crown Points are earned in exactly one place, `applyMoney` in `src/lib/games/server/rounds.ts`, at 1 point per whole virtual credit staked in a game.
- **Never earning:** deposits, bonuses, wins and admin adjustments add nothing, and no code path or form lets anyone set or buy points.
- **Demo data:** the seeded guest and showcase players get their points from rounds played through the real engines.

| Tier | Crown Points | Daily bonus base | Unlocks |
| ---- | ------------ | ---------------- | ------- |
| Bronze | 0 | 1,000 | 8 starter avatars, bronze ring |
| Silver | 5,000 | 1,500 | Ember and Silver Quill avatars, silver ring |
| Gold | 25,000 | 2,500 | Royal Keep and Duellist avatars, gold ring |
| Platinum | 100,000 | 4,000 | Platinum Sun avatar, platinum ring |
| Diamond | 500,000 | 6,000 | Diamond Heart avatar, animated diamond ring |

Every listed benefit is implemented. Cashback and other perks that the app cannot deliver were removed from the copy.

### Daily demo bonus (`src/lib/profile/bonus.ts`, `claimDailyBonus`)

- **Amount and streak:** one claim every 24 hours. The amount is the tier base plus 10% per consecutive day, capped at +50% from day 6. A claim within 48 hours of the previous one continues the streak; otherwise it restarts at day 1.
- **Server-side:** the claim recomputes the tier and streak on the server and is a compare-and-set on the previous claim time, so a double-click or a second tab pays once.

### Profile, statistics and history (`src/lib/profile/stats.ts`)

- **Stored summaries:** each settled round stores a summary such as "Won · 20 vs dealer 19", "17 black · straight up hit" or "Won the pot · Full house", with tags for achievements. Rounds settled before summaries existed are backfilled from their stored state.
- **Statistics:**
  - games played, wins, pushes and losses;
  - total virtual wins and total staked;
  - biggest win, best multiplier and longest win streak;
  - favourite game and per-game breakdown;
  - a 14-day net-result chart (diverging bars with hover, legend and a table view).
- **Chart colours:** validated for colour-blind separation and contrast on the dark surface.

### Achievements (`src/lib/achievements.ts`)

- **The 20 badges:** first round, 50 and 500 rounds, all four games, 3 wins in a row, 10× and 50× wins, free spins, jackpot, blackjack natural, doubled win, straight-up hit, showdown win, full house or better, daily bonus, 7-day streak, and Silver to Diamond.
- **Unlocking:** badges are evaluated on the server from recorded play. The first time one is seen as earned, it is stored with that date.

### Account settings

- **Avatar:** choose from 14 preset avatars (original artwork, no uploads), where higher tiers unlock more. The server re-checks the tier on save, and a forged request for a locked avatar is refused.
- **Details and security:** display name and email, password change, and sign out other devices.
- **Privacy:** hide yourself from the public "recent winners" board.

## Administration dashboard

Only `ADMIN` accounts can use it.

- **Access control:**
  - the middleware sends signed-out visitors to login;
  - the admin layout, every admin page and every admin server action call `requireAdmin()` on the server;
  - non-admins get the site's ordinary 404, and the page titles don't reveal the area either.
- **Getting an admin account:** create one with `npm run db:seed:admin` (development only; see above).

| Area | What it does |
| ---- | ------------ |
| **Dashboard** | Registered accounts (new, admins, suspended); active demo users (played or signed in, 24 h and 7 days); games played (settled rounds); virtual credits in circulation and pending demo deposits; rounds per day; top games; recent activity. |
| **Ledger integrity** | A banner on the dashboard re-checks on every visit: (1) wallets whose balance differs from the sum of their completed ledger rows; (2) completed ledger rows without an audit record. Both must be zero. |
| **Users** | Search by username, name or email. Filter by status or role. The profile page has status (suspend or reactivate, reason required), role, sign-out-everywhere, wallet adjustment, statistics, recent games, transactions and the account's full audit history. |
| **Games** | Enable or disable a game, set bet limits (or Hold'em blinds), lobby flags and the demo payout rules. Shows published RTP next to the RTP observed over the last 30 days, plus each game's change history. |
| **Transactions** | All demo ledger entries with status counts, type filter, user/reference search and pagination. |
| **Audit** | Administrator actions by default, or all activity. Filter by action type, search text, and see second-precision timestamps, actor, account, amount with balance before and after, and masked IP. |

### Demo payout configuration (`src/lib/games/config.ts`)

Payouts are a fixed menu of rules, not free numbers. The published RTP is derived from simulations of each rule set and cannot be typed in.

| Engine | Options | Published RTP |
| ------ | ------- | ------------- |
| Slots | Pay scale 90–110% (scales every line and scatter pay) | 95.6% × scale (+1% on jackpot slots) |
| Blackjack | Blackjack pays 3:2 or 6:5; dealer stands or hits on soft 17 | 99.1 / 98.8 / 97.6 / 97.5% |
| Roulette | La Partage on or off (half back on even-money bets when zero hits) | 97.3% (98.65% on even chances with La Partage) |
| Hold'em | 1–5 AI opponents; blinds from the min bet | No rake |

Rules are copied onto each round when it starts, so a change never alters a hand or free-spins round already in progress. A disabled game leaves the lobby and refuses new rounds, but players can finish live ones.

### Account status

Suspending an account (reason required) signs it out everywhere and blocks sign-in; the message is shown only after a correct password. Every request rechecks the status in `getCurrentUser`. Admins cannot change their own status or role, and an admin must be demoted before suspension.

### No unaudited balance changes

- **One path:** the only way to change a balance is the wallet service. Each change writes one completed ledger row and one audit row with the actor, reason, and balance before and after.
- **Admin adjustments:** these use the same path, need a reason and carry an idempotency key. An admin cannot adjust their own wallet; another admin has to.
- **No other access:** there is no hidden or "silent" adjustment, and no admin screen edits balances, ledger rows or audit rows.
- **Enforcement:**
  - `tests/admin.test.ts` scans the source and fails if anything outside `src/lib/wallet/service.ts` writes `Wallet.balance`;
  - the dashboard's integrity check catches any write that bypassed the service at runtime;
  - the seed scripts record audit rows for the history they create, so the check holds for demo data too.

## Project structure

```
prisma/
  schema.prisma        User, Session, Wallet, Transaction, AuditLog, Game, GameRound, Favorite, Promotion, VipTier, Role enum
  seed.ts              Demo catalogue, demo USER, showcase players and simulated rounds
  seed-admin.ts        Development-only admin creation (env-driven, refuses in production)
  promotions.ts        The offers on /promotions (each describes a real feature); seed-promotions.ts reloads them
tests/                 Vitest unit + integration tests (npm test)
scripts/
  simulate-rtp.ts      Monte Carlo RTP for slots, blackjack and roulette (npm run sim:rtp)
  wallet-selftest.ts   Wallet service checks (npm run test:wallet)
src/
  middleware.ts        Cookie-presence gate for protected routes
  app/
    layout.tsx         Shell: fonts, sidebar, header, footer, mobile tab bar, navigation feedback
    template.tsx       Page-change fade
    error.tsx global-error.tsx not-found.tsx   Error and 404 screens
    icon.svg apple-icon.tsx manifest.ts         Favicon, home-screen icon, web-app manifest
    page.tsx           Homepage
    games/             Catalogue, [slug] details and [slug]/play
    wallet/            DEMO wallet: layout (banner + tabs), overview, deposit/, history/
    login/ register/ profile/ admin/ vip/ promotions/ responsible-gaming/
  components/
    layout/            Header, Sidebar, SidebarNav, MobileNav, Footer, NavigationFeedback
    ui/                Button, Card, Badge, Input, PasswordInput, Field, Logo, Rail, Reveal,
                       Skeleton(s), SoundSettings, EmptyState, …
    auth/              AuthShell, LoginForm, RegisterForm
    profile/           Avatar, AchievementBadge, VipCard, Charts, GameHistoryList, ProfileTabs,
                       SettingsForms (avatar, privacy), ProfileForm, SecurityForms
    admin/             AdminNav, AuditTable, TxTable, RoundsChart, UserForms, GameForms, RoleToggle, ui
    wallet/            Demo badges & ribbon, WalletTabs, CurrencySelector, DepositForm,
                       DepositActions, DemoQr, TxList, AuditTrail, DailyBonus
    games/             SlotMachine, BlackjackTable, RouletteTable, HoldemTable,
                       play/ (useRound hook, PlayingCard, chips, HUD, result banner), GameCard, …
    home/ promotions/
  lib/
    auth.ts            Sessions, cookies, getCurrentUser, requireUser, requireAdmin
    password.ts        Argon2id hashing
    rate-limit.ts      Fixed-window limiter and client IP helper
    actions/           Server actions: auth.ts, account.ts, wallet.ts, games.ts, admin.ts
    games/             rng.ts, cards.ts, slots/, blackjack/, roulette/, holdem/ (pure engines)
                       server/ (rounds, context, one module per game: authority, money, replay)
    wallet/            service.ts (balance changes), transactions.ts (deposits, history, audit),
                       currencies.ts (demo rates), limits.ts
    request-id.ts      Client request ids for duplicate protection
    sound.ts           Synthesised sound effects and per-device sound settings
    client-ip.ts       Client address for rate limits (proxy headers only with TRUST_PROXY=1)
    vip.ts             Tier progress, tier styles, daily-bonus and streak maths
    avatars.ts  achievements.ts   Avatar presets and badge definitions (pure)
    profile/           stats.ts (statistics, history, achievements), bonus.ts (daily bonus)
    admin/             queries.ts (dashboard, integrity, users, transactions, audit, games), meta.ts
    games/config.ts    Per-game config schemas, payout rules and the derived published RTP
    validations.ts     Zod schemas
    queries.ts         Server-only data access
    constants.ts  navigation.ts  vip.ts  utils.ts  db.ts
```

## Design system

Colour tokens are defined in `src/app/globals.css` and work as normal Tailwind classes (`bg-ink`, `text-gold`, `border-line`, and so on).

| Token          | Value     | Use                                 |
| -------------- | --------- | ----------------------------------- |
| `ink`          | `#0B0B0D` | App background                      |
| `surface`      | `#151515` | Cards and panels                    |
| `gold`         | `#D4AF62` | Primary accent                      |
| `gold-2`       | `#B89550` | Secondary gold                      |
| `gold-light`   | `#F1D99B` | Highlights and text on dark         |
| `ivory`        | `#F4EFE4` | Primary text                        |
| `muted/subtle` | greys     | Secondary and tertiary text         |

- **Typography:** Cormorant Garamond for display headings and Manrope for UI text, both self-hosted through `next/font`.
- **Branding:** the crown-in-octagon monogram (`src/components/ui/Logo.tsx`) is the favicon (`src/app/icon.svg`), the home-screen icon (`src/app/apple-icon.tsx`, rendered to PNG at build time) and the web-app manifest icon (`src/app/manifest.ts`).
- **Game artwork** (`src/components/games/GameArt.tsx`): one scene per game type (reels, wheel, cards and chips) on the title's palette and motif. Gradient ids are unique per artwork, so hidden copies (such as the hero cards on phones) never break the visible ones.
- **Motion:** Framer Motion for deals, spins, banners and menus; each page settles in with one short fade (`src/app/template.tsx`). All motion respects `prefers-reduced-motion`.
- **Loading states** (`src/components/layout/NavigationFeedback.tsx`, `src/components/ui/Skeletons.tsx`): a thin gold bar starts the moment you follow a link, and if the next page takes more than ~0.2 s, a skeleton shaped like that page (lobby, game, table, wallet, profile, VIP, admin) covers the old one. This is done on the client rather than with `loading.tsx`, because a route-level Suspense boundary in this Next.js version can leave a server action (a deposit, a bonus claim) pending forever after it revalidates. Buttons show a spinner and a "…ing" label while their action runs.
- **Sound** (`src/lib/sound.ts`, `src/components/ui/SoundSettings.tsx`): reels, card deals, chips, the roulette ball, win fanfares, free-spin sparkle and error tones, all synthesised with the Web Audio API. The speaker button in the header opens quick controls; **Profile → Settings → Sound** has the full panel: on/off, volume, and separate switches with samples for table sounds, win fanfares and interface tones. Settings are saved per device in `localStorage`. Nothing plays until you have clicked or pressed a key on the page.
- **Empty and error states:** every empty list says what will appear there and offers the next step (browse games, make a demo deposit, clear filters). The error page tells the player their balance is safe and offers retry or the lobby, and only suggests `npm run setup` when the database is actually missing; `global-error.tsx` covers a failure of the shell itself.
- **Responsive navigation:**
  - **Desktop (`xl` and wider):** the header shows Home, Games, VIP Club, Wallet and Profile.
  - **Below `lg`:** the sidebar becomes a slide-in drawer with the auth actions, and a bottom tab bar gives one-tap access to the five main pages.
