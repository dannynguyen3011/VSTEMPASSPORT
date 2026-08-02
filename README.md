# Green STEM Compass

A Vietnamese STEM admissions platform helping high school students (grades 10–12) plan their university applications to the "Big 6" schools: VinUni, HUST, USTH, VJU, FPT, and Swinburne Vietnam.

🌐 **Live:** https://thegreenpassport-weld.vercel.app

---

## Architecture

```mermaid
flowchart TB
    subgraph Client["🌐 Client (Browser)"]
        UI["Next.js Frontend<br/>React + Tailwind"]
        ZS["Zustand Store<br/>profile · activities · chat"]
        UI <--> ZS
    end

    subgraph Vercel["▲ Vercel — Next.js runtime"]
        APP["App Router pages<br/>(SSR + Static)"]
        API["API Routes<br/>/api/chat · /api/profile · ..."]
        LIB["Server libs<br/>auth.ts · ocs.ts · rag.ts"]
        APP --> API
        API --> LIB
    end

    subgraph Mongo["🗄 MongoDB Atlas"]
        AUTH["Custom JWT Auth<br/>bcrypt password hashing"]
        DB[("MongoDB<br/>users · activities<br/>opportunities · trust")]
    end

    subgraph AI["🤖 AI / RAG"]
        CLAUDE["Anthropic Claude<br/>claude-sonnet-4-6"]
        CHROMA[("ChromaDB on Railway<br/>vector embeddings")]
        LC["LangChain<br/>+ OpenAI embeddings"]
    end

    RS["✉️ Resend<br/>teacher verification"]
    INGEST["scripts/ingest-rag.ts<br/>(one-off corpus build)"]

    Client -->|HTTPS| Vercel
    LIB -->|Mongoose ODM| DB
    LIB -->|jsonwebtoken + bcryptjs| AUTH
    LIB -->|@anthropic-ai/sdk| CLAUDE
    LIB -->|chromadb client| CHROMA
    LIB -.->|RAG retrieval| LC
    LC --> CHROMA
    CLAUDE -.->|retrieved context| CHROMA
    LIB -.->|resend SDK| RS
    INGEST -.->|PDFs → embeddings| CHROMA
```

### Request flow examples

**Register / Login:**
1. User submits the register or login form (`/register`, `/login`)
2. `POST /api/auth/register` (hashes password with bcrypt, creates the user document, signs a JWT) or `POST /api/auth/login` (verifies password, signs a JWT)
3. Client stores `{ token, user }` in `localStorage` and sends `Authorization: Bearer <token>` on every subsequent API call

**Chatbot query (RAG):**
1. User asks question in `/chatbot` (React)
2. `POST /api/chat` with the JWT
3. Server: verify JWT → embed query (LangChain + OpenAI) → query Chroma for top-K passages → call Claude with passages + chat history → stream response back
4. Client renders the markdown reply with `react-markdown`

**Save portfolio activity:**
1. User submits form on `/portfolio` (react-hook-form + Zod)
2. `POST /api/activities`
3. Server: verify JWT → Zod schema check → Mongoose `create()` into MongoDB
4. Client updates Zustand store (persisted to localStorage)

---

## Tech Stack

### Framework / Core
- **Next.js 16** (App Router) — pages, SSR, API routes
- **React 18** + **TypeScript**

### Database & Auth
- **MongoDB Atlas** — managed MongoDB, used for both local dev and production
- **Mongoose** — schema/ODM layer over MongoDB
- **jsonwebtoken** + **bcryptjs** — custom auth: password hashing + stateless JWT sessions (no third-party auth provider)

### AI / RAG
- **Anthropic Claude** (`@anthropic-ai/sdk`) — chatbot + Compass analysis
- **ChromaDB** (`chromadb`) — vector store (hosted on Railway)
- **LangChain** (`langchain`, `@langchain/openai`) — embeddings + retrieval orchestration
- **pdf-parse** — PDF text extraction during ingest

### UI
- **Tailwind CSS** + `tailwindcss-animate` + `@tailwindcss/typography`
- **@base-ui/react** — headless UI primitives (`components/ui/`)
- **lucide-react** — icons
- **framer-motion** — animations
- **recharts** — dashboard charts
- **react-markdown** — chatbot output rendering
- **@dnd-kit/\*** — drag-and-drop (portfolio reordering)
- **next-themes** — dark/light mode
- **class-variance-authority**, **clsx**, **tailwind-merge** — class composition

### Forms & Validation
- **react-hook-form** + `@hookform/resolvers`
- **Zod** — schema validation (client + server)

### State
- **Zustand** — client-side global state with localStorage persistence

### Email
- **Resend** — teacher verification emails (TrustFactor Tier 2, optional)

### Hosting
- **Vercel** — hosts the Next.js app, auto-deploys from `main`
- **Railway** — hosts ChromaDB Docker container
- **MongoDB Atlas** — managed database, free M0 tier is enough to start

---

## Project Structure

```
src/
├── app/
│   ├── (app)/               # FRONTEND — authenticated app pages
│   │   ├── dashboard/       # Main dashboard with OCS score & profile summary
│   │   ├── compass/         # Strategic Matching — gap analysis vs Big 6 schools
│   │   ├── portfolio/       # 10-Slot Portfolio Optimizer (STAR format)
│   │   ├── opportunities/   # STEM competitions, scholarships, workshops
│   │   ├── chatbot/         # AI advisor chatbot (RAG-powered)
│   │   ├── mentor/          # Mentor connection page
│   │   ├── profile/         # Profile settings (GPA, SAT, IELTS, school)
│   │   └── layout.tsx       # App layout with Sidebar + AuthDataLoader
│   │
│   ├── (auth)/              # FRONTEND — login & register pages
│   │   ├── login/
│   │   └── register/
│   │
│   ├── demo/                # FRONTEND — public demo (no login required)
│   │
│   ├── api/                 # BACKEND — Next.js API routes
│   │   ├── profile/         # GET/POST/PUT user profile
│   │   ├── activities/      # GET/POST/DELETE portfolio activities
│   │   ├── chat/            # POST — Claude RAG chatbot endpoint
│   │   ├── opportunities/   # GET opportunities list
│   │   ├── mentor/          # GET mentors, POST connection request
│   │   ├── ocs/calculate/   # POST — Overall Competency Score calculation
│   │   ├── compass/analyze/ # POST — school match analysis
│   │   ├── auth/lookup-username/ # GET — resolve username to email for login
│   │   └── admin/           # Admin endpoints (trust verification, opportunities)
│   │
│   └── page.tsx             # FRONTEND — landing page
│
├── components/
│   ├── shared/
│   │   ├── Topbar.tsx       # FRONTEND — top bar with auth dropdown / demo switcher
│   │   ├── AuthDataLoader.tsx # FRONTEND — loads real DB data into Zustand on login
│   │   ├── ThemeToggle.tsx  # FRONTEND — dark/light mode toggle
│   │   └── TrustBadge.tsx   # FRONTEND — trust tier badge component
│   └── ui/                  # FRONTEND — @base-ui/react primitives
│
├── backend/
│   ├── db/
│   │   ├── mongoose.ts      # BACKEND — cached MongoDB connection singleton
│   │   └── models/          # BACKEND — Mongoose schemas (User, Activity, Opportunity, ...)
│   ├── auth.ts              # BACKEND — JWT sign/verify + requireAuth()/isAdmin() helpers
│   ├── rag.ts                # AI RAG — document retrieval from Chroma
│   ├── nlp-tagger.ts         # AI — auto-tags activities with tech keywords
│   └── rocketchat.ts         # BACKEND — optional admin notification webhook
│
├── shared/
│   ├── auth-client.ts       # FRONTEND — JWT session helpers (localStorage-backed)
│   ├── ocs.ts                # BACKEND/FRONTEND — Overall Competency Score logic
│   ├── matching.ts           # BACKEND/FRONTEND — school matching & unrealistic goal detection
│   ├── constants.ts          # FRONTEND — Big 6 school data, category labels/colors
│   └── demoUsers.ts          # FRONTEND — seed data for demo mode
│
├── store/
│   └── useProfileStore.ts   # FRONTEND — Zustand store (profile + activities state)
│
└── types/
    └── index.ts             # Shared TypeScript types
```

---

## Frontend

All pages under `src/app/(app)/`, `src/app/(auth)/`, `src/app/demo/`, and `src/app/page.tsx`.

Responsibilities:
- Renders the UI with Tailwind CSS (dark/light mode via `next-themes`)
- Manages client state via Zustand (`useProfileStore`)
- Handles auth session via `src/shared/auth-client.ts` (JWT stored in `localStorage`)
- Demo mode: uses hardcoded seed data from `demoUsers.ts`, no login required

---

## Backend

All routes under `src/app/api/` plus `src/backend/db/` and `src/backend/auth.ts`.

Responsibilities:
- REST API endpoints for auth, profile, activities, opportunities, mentors
- Authentication via a self-issued JWT (Bearer token on every request), verified in `src/backend/auth.ts`
- Password hashing with bcrypt; no third-party auth provider
- Database access via Mongoose → MongoDB Atlas
- OCS score calculation and school match logic
- Admin endpoints for trust verification and opportunity management

---

## AI / RAG

Files: `src/backend/rag.ts`, `src/backend/nlp-tagger.ts`, `src/app/api/chat/route.ts`, `scripts/ingest-rag.ts`

- **`rag.ts`** — connects to Chroma, retrieves relevant chunks for a query (university admission docs, scholarship info)
- **`nlp-tagger.ts`** — keyword-tags portfolio activities with tech/skill labels
- **`api/chat/route.ts`** — orchestrates the RAG pipeline:
  1. Take user message + profile context
  2. Retrieve top-K chunks from Chroma
  3. Build a prompt with context + chat history
  4. Call Claude (`claude-sonnet-4-6`) via the Anthropic SDK
  5. Stream response with cited sources
- **`scripts/ingest-rag.ts`** — one-off: reads PDFs from `corpus/`, chunks them, embeds, uploads to Chroma

To use the chatbot in production, ChromaDB must be deployed (Railway in this project) and `CHROMA_URL` set in environment variables. The corpus is populated by running `npm run rag:ingest` locally after placing the source PDFs in `corpus/`.

---

## Getting Started

1. **Create a MongoDB Atlas cluster** (free M0 tier is enough): [cloud.mongodb.com](https://cloud.mongodb.com) → Database → Connect → Drivers → copy the `mongodb+srv://...` connection string. Under Network Access, allow access from anywhere (`0.0.0.0/0`) — this is required for both local dev (dynamic IP) and Vercel (no static IPs on the default tier).
2. **Fill in `.env.local`:**

```bash
npm install
cp .env.example .env.local   # fill in MONGODB_URI, JWT_SECRET, ANTHROPIC_API_KEY, etc.
```

3. **Seed reference data (school personas + opportunities) and run:**

```bash
npm run db:seed
npm run dev
```

4. Open `http://localhost:3000/register` and create an account — no separate database migration step is needed (MongoDB is schemaless; Mongoose creates collections/indexes on first write).

For the RAG chatbot, after setting `CHROMA_URL`:

```bash
# Place admission PDFs in ./corpus/, then:
npm run rag:ingest
```

---

## Running with Docker

The project ships with a multi-stage production `Dockerfile`, a `Dockerfile.dev` for hot reload, and a `docker-compose.yml` that spins up the Next.js app + ChromaDB locally.

### Local development (recommended)

Brings up Next.js (hot reload) + ChromaDB with a persistent volume. The compose file overrides `CHROMA_URL` to point at the local `chromadb` service, so you don't need to change your `.env.local`. The app's own database is always MongoDB Atlas (cloud) — `MONGODB_URI` in `.env.local` is used as-is inside the container, Docker doesn't change that.

```bash
cp .env.example .env.local   # fill in MONGODB_URI, JWT_SECRET, Anthropic keys
docker compose up app chromadb   # build + start just the app + Chroma
# App: http://localhost:3000
# Chroma: http://localhost:8000/api/v2/heartbeat

docker compose logs -f app   # tail app logs
docker compose down          # stop (keeps chroma_data volume)
docker compose down -v       # stop AND wipe Chroma data
```

The compose file also defines `mongodb`, `mongodb-init`, and `rocketchat` services — those back an optional, unrelated admin-notification feature (Rocket.Chat), not the app's own database. Add them to the `up` command (or run `docker compose up` with no service list) only if you want that feature too; see `docs/rocketchat.md`.

To ingest the RAG corpus into the local Chroma (after placing PDFs in `./corpus/`):

```bash
docker compose exec app npm run rag:ingest
```

### Production image

Multi-stage build using Next.js standalone output. Final image is ~276 MB, runs as non-root.

```bash
docker build -t greenstem .
docker run -p 3000:3000 --env-file .env.local greenstem
```

Deploy this image to any container host — Fly.io, Render, AWS ECS, Google Cloud Run, or a plain VPS. Set the same environment variables documented below.

**Troubleshooting:** If `docker build` fails with `apk add` DNS errors (`dl-cdn.alpinelinux.org: name does not exist`), it's a BuildKit network namespace issue on Docker Desktop. Rebuild with the host network:

```bash
docker build --network=host -t greenstem .
```

### File layout

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage production build (deps → builder → runner) |
| `Dockerfile.dev` | Development image used by `docker compose` for hot reload |
| `docker-compose.yml` | Local stack: Next.js + ChromaDB with persistent volume |
| `.dockerignore` | Excludes `node_modules`, `.env*`, `.next`, `corpus/`, etc. |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string (same cluster for local dev and production) |
| `JWT_SECRET` | Long random secret used to sign/verify auth JWTs — keep it secret, never commit it |
| `JWT_EXPIRES_IN` | JWT session lifetime, e.g. `7d` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `CHROMA_URL` | ChromaDB URL (Railway public domain) |
| `NEXT_PUBLIC_APP_URL` | Deployed app URL |
| `RAG_DATA_FRESHNESS_DATE` | Date shown in chatbot "data current as of" disclaimer |
| `ADMIN_USER_IDS` | Comma-separated MongoDB `_id` strings (from the `users` collection) with admin access |
| `RESEND_API_KEY` | Resend API key (optional — for teacher verification email) |
| `RESEND_FROM_EMAIL` | Sender address for Resend |

---

## Deployment

Deployed on **Vercel** (Next.js app), **MongoDB Atlas** (database), and **Railway** (ChromaDB).

- **Vercel** — every push to `main` triggers an automatic redeployment. Set `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ANTHROPIC_API_KEY`, `CHROMA_URL`, `ADMIN_USER_IDS`, and the rest of the table above as Vercel project environment variables (Project Settings → Environment Variables).
- **MongoDB Atlas** — under Network Access, allow access from anywhere (`0.0.0.0/0`); Vercel's serverless functions don't have static outbound IPs on the default tier, so per-IP allowlisting isn't practical here.
- **Railway** — `chromadb/chroma` Docker image, port `8000`, persistent volume mounted at `/chroma/chroma`, env vars `IS_PERSISTENT=TRUE` and `ANONYMIZED_TELEMETRY=FALSE`
