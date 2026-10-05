# Fuelcast prototype

Hands-free food ordering driven by wearable signals. Fuelcast reads a (simulated)
glucose sensor and watch, predicts when you're about to get hungry, picks a meal
that fits, and lets you approve it with one tap on your watch.

"Fuelcast" is a working name. **All health data is simulated and no real orders
are placed.** This is a pitch prototype, not a medical device.

| Piece | Folder | Stack | Hosted on |
|---|---|---|---|
| Database | `db/`, `api/app/models.py` | Postgres 16 (SQLite in tests) | Render Postgres |
| API | `api/` | Python 3.12, FastAPI, SQLAlchemy 2 | Render web service |
| Website + live dashboard + ops dashboard | `web/` | Next.js 16 (App Router) | Vercel |
| Phone app | `mobile/` | Expo SDK 57 / React Native | Expo EAS (iOS and Android builds), Vercel (web preview) |

The full reasoning behind these choices is in
[`docs/Fuelcast_Tech_Stack_Guide.docx`](docs/Fuelcast_Tech_Stack_Guide.docx).

```
.
├── api/                 FastAPI backend (simulator, hunger model, recommender, orders)
├── web/                 Next.js website, live demo dashboard, ops dashboard
├── mobile/              Expo app for iPhone and Android
├── db/schema.sql        Plain-SQL copy of the database schema
├── docs/                Tech stack guide
├── render.yaml          Render Blueprint: API + Postgres
├── docker-compose.yml   Whole stack on one machine
└── .github/workflows/   CI: API tests, web build, mobile typecheck and web export
```

## Put it on GitHub

1. Create an empty repository on GitHub (no README, no .gitignore), for example `fuelcast`.
2. From this folder:

   ```bash
   git init -b main          # skip if the folder already has a .git directory
   git add .
   git commit -m "Fuelcast prototype"
   git remote add origin https://github.com/<your-username>/fuelcast.git
   git push -u origin main
   ```

   Or drag the folder's contents into GitHub's "uploading an existing file" page.
   `node_modules`, `.next`, `.env` and other generated files are already excluded by `.gitignore`.
3. The CI workflow runs on every push. Check the Actions tab for a green run.

## Deploy it

Do these in order, because each step needs the URL from the one before.

**1. API and database on Render**

1. Sign in at [render.com](https://render.com) with GitHub.
2. New > Blueprint > pick your repository. Render reads `render.yaml`, creates
   the `fuelcast-db` Postgres database and the `fuelcast-api` web service, and
   connects them.
3. When the deploy finishes, open `https://fuelcast-api.onrender.com/api/health`
   (your URL may differ). It should say `{"ok":true}`. The API loads the demo
   data on first start. Interactive docs are at `/docs`.

Free Render services sleep after a period without traffic; the first request then
takes about a minute. The web and phone apps keep retrying until it wakes. Open
the site a minute before a pitch, or use a paid plan.

**2. Website and dashboards on Vercel**

1. Sign in at [vercel.com](https://vercel.com) with GitHub. Add New > Project > import the repository.
2. Set **Root Directory** to `web`. Vercel detects Next.js.
3. Add the environment variable `NEXT_PUBLIC_API_URL` = your Render API URL
   (for example `https://fuelcast-api.onrender.com`, with no trailing slash). Deploy.
4. Back on Render, set the API's `CORS_ORIGINS` to your Vercel URL (for example
   `https://fuelcast.vercel.app`) to stop other sites calling it. `*` also works for a demo.

**3. Phone app**

*Shareable web preview (fastest for a pitch).* Import the same repository into
Vercel again as a second project with **Root Directory** `mobile`. `mobile/vercel.json`
already holds the build settings. Add `EXPO_PUBLIC_API_URL` = your Render API URL.
The result is the phone app running in a browser, which works on any phone with no install.

*Real iOS and Android builds with Expo EAS.*

```bash
npm install -g eas-cli
cd mobile
eas login                       # free Expo account
eas init                        # links the project and writes its ID into app.json
# edit eas.json: set EXPO_PUBLIC_API_URL to your Render URL in both profiles
# edit app.json: change com.fuelcast.app to a bundle ID you own
eas build -p android --profile preview      # installable .apk link to share
eas build -p ios --profile production       # needs an Apple Developer account ($99/year)
eas submit -p ios                           # uploads to App Store Connect / TestFlight
```

For quick testing on your own phone without a build, install Expo Go and run
`npx expo start` (see below).

**Other hosts.** `docker-compose.yml`, `api/Dockerfile` and `web/Dockerfile` run the
whole stack on any machine with Docker, such as a DigitalOcean droplet, Fly.io or
Railway. The API reads `DATABASE_URL` and accepts the `postgres://` URLs those hosts give out.

## Run it locally

**1. Database and API**

With Docker (Postgres, API and website together):

```bash
docker compose up --build        # website :3000, API :8000, Postgres :5432
```

Without Docker (needs a local Postgres with a `fuel` user and database, password `fuel`):

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env             # optional; defaults match a local fuel/fuel database
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

The API seeds demo data on first start. `python -m app.seed` or
`POST /api/sim/reset` wipes and reloads it. Set `DATABASE_URL` to point at
another database.

**2. Website and dashboards**

```bash
cd web
npm install
npm run dev                      # http://localhost:3000
```

- `/` landing page for the pitch
- `/dashboard` live demo: pick a persona, press Play or +15 min, watch the
  hunger score climb, then approve the meal on the simulated watch
- `/ops` operator view: orders, acceptance rate, approval method, kitchens

Set `NEXT_PUBLIC_API_URL` if the API isn't on `http://localhost:8000`.

**3. Phone app**

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8000 npx expo start
```

Scan the QR code with Expo Go. On a phone, `localhost` means the phone, so the
API URL must be your computer's LAN address. `npx expo start --web` runs it in
a browser instead. The app polls the API, so taps on the web dashboard's watch
show up on the phone and the other way round.

**Tests**

```bash
cd api && pytest                 # 11 tests, in-memory SQLite, no Postgres needed
cd web && npm run typecheck && npm run build
cd mobile && npm run typecheck
```

## The demo script

1. **Maya** (CGM + watch, confirm mode). Starts at 2:00 PM after a high-carb
   lunch. Play forward: glucose dips around 3 PM, the hunger score crosses 70
   at 3:15 PM, and a turkey chili is proposed with the reason ("Glucose
   falling, 3h 05m since lunch, about 423 kcal burned"). Tap ✓ on the watch;
   it arrives at 3:35 PM, logs as a meal and the score drops.
2. **Jordan** (watch + ring, no CGM, autopilot). Mid bike workout at 1:15 PM.
   Hunger is held back during exercise; when the workout ends it jumps,
   a high-protein meal is proposed and autopilot places it after the
   5-minute cancel window.
3. **Priya** (CGM + watch, vegetarian, tree-nut allergy). Skipped lunch on
   shift, so a vegetarian meal is proposed on the first tick. Tap ✕ to show
   the 45-minute cooldown guardrail.

## How it works

`api/app/engine.py` runs the loop every simulated 5 minutes:

1. **Sense** (`simulator.py`): deterministic glucose curve from meals and
   exercise (rise, then a dip whose depth depends on how fast the carbs
   were), plus heart rate, HRV, steps and active calories.
2. **Predict** (`hunger.py`): a 0–100 hunger score from time since the last
   meal (scaled by its size), glucose trend and level vs the user's baseline,
   calories burned since eating, and low HRV. Users without a CGM get the same
   model without the glucose term. Every score comes with a plain-language
   reason. This is a hand-tuned heuristic standing in for a learned per-user model.
3. **Choose** (`recommender.py`): ranks one main plus an optional side per
   kitchen by calorie fit, protein (more after a workout), glycemic load (slow
   carbs when glucose is dipping), price, rating and ETA. Allergens and diet
   are hard filters; the weekly budget is a hard cap.
4. **Confirm**: confirm mode waits 15 minutes for a tap; autopilot orders
   unless cancelled within the user's cancel window. Guardrails: mode off,
   one active order at a time, daily order cap, weekly budget, 45-minute
   cooldown after a "not now".
5. **Deliver**: the order moves through preparing and on the way, and on
   delivery becomes a meal, which feeds back into glucose and hunger.

Each user has their own simulated clock (`users.sim_now`), so personas can be
at different times of day.

## API

Interactive docs at `http://localhost:8000/docs`. Main routes:

| Method | Path | What |
|---|---|---|
| GET | `/api/users` | Demo users |
| GET | `/api/users/{id}/state` | Hunger, latest reading, recommendations, active order, today's totals |
| GET | `/api/users/{id}/readings?hours=` | Simulated CGM and watch samples |
| GET | `/api/users/{id}/hunger/history?hours=` | Hunger score over time |
| GET | `/api/users/{id}/recommendations` | Meals that fit right now |
| GET/POST | `/api/users/{id}/orders` | Order history / place an order by hand |
| PATCH | `/api/users/{id}` | Mode, threshold, budget, caps, allergies, diet |
| POST | `/api/orders/{id}/confirm` | Approve (`via`: `watch_tap`, `voice`, `phone`) |
| POST | `/api/orders/{id}/cancel` | Decline a proposal or cancel before pickup |
| GET | `/api/restaurants` | Partner kitchens and menus |
| POST | `/api/sim/users/{id}/advance` | Move the simulated clock forward |
| POST | `/api/sim/users/{id}/workout` | Start a workout now |
| POST | `/api/sim/users/{id}/meal` | Log something eaten outside the app |
| POST | `/api/sim/reset` | Reload demo data |
| GET | `/api/admin/stats` | Ops dashboard numbers |

## What's fake, and what the real product needs

- Health data: replace `simulator.py` with HealthKit, Health Connect and the
  Dexcom API.
- Hunger model: replace the heuristic with a per-user model trained on
  readings and order history, with user corrections.
- Ordering: replace the order state machine's timers with a delivery partner
  API (e.g. DoorDash Drive) and Stripe payments.
- Watch: a real watchOS / Wear OS app for the one-tap confirm; the web
  dashboard and phone app only simulate it.
- Accounts and auth, consent per data source, and a health-privacy review
  before launch.
