# Haney Chat

A modern AI chat application powered by a custom 537M-parameter GPT-style transformer model deployed on Modal GPU infrastructure. Built with Next.js, Clerk authentication, Supabase PostgreSQL, LangChain, and shadcn/ui.

![Haney Chat](https://picsum.photos/seed/haney1/800/400)

## Architecture

```
User Browser
    ↓
Next.js (App Router)
    ↓
Clerk Auth Middleware
    ↓
Next.js API Routes (rate-limited, validated)
    ↓
LangChain (custom chat model adapter)
    ↓
Modal GPU Inference (Haney Chat 537M)
    ↓
Supabase PostgreSQL (conversation & user data)
```

## Features

- **Streaming AI responses** — token-by-token SSE streaming with typing animation
- **Persistent chat history** — conversations survive browser refreshes and logins
- **Threaded conversations** — each chat is an isolated thread with full context
- **Clerk authentication** — email/password, Google, GitHub, and more
- **Admin dashboard** — user management, stats, search, and deletion
- **Role-based access** — user/admin roles synced from Clerk to Supabase
- **Mobile responsive** — slide-out sidebar, responsive chat bubbles
- **Dark mode** — always on, ChatGPT-inspired UI
- **Security** — rate limiting, input validation, security headers, error boundaries

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Auth | Clerk |
| Database | Supabase PostgreSQL |
| ORM | Drizzle ORM |
| AI Integration | LangChain |
| Model | Haney Chat 537M (GGUF → Modal L4 GPU) |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Deployment | Netlify |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A [Clerk](https://clerk.com) account
- A [Supabase](https://supabase.com) project
- A Modal endpoint for the Haney Chat model (or use the default)

### Setup

```bash
# Clone the repository
git clone ...
cd haney-chat-website

# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# Modal inference endpoint
MODEL_API=...

# Clerk authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=..
NEXT_PUBLIC_CLERK_SIGN_UP_URL=..
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=...
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=...

# Clerk webhooks (for role sync)
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase PostgreSQL (pooler)
DATABASE_URL=.....
DIRECT_URL=.....
```

### Database Setup

```bash
# Push schema to Supabase
npx drizzle-kit push
```

This creates four tables:

| Table | Purpose |
|---|---|
| `users` | User records synced from Clerk |
| `conversations` | Chat threads linked to users |
| `messages` | Individual user/assistant messages |
| `user_settings` | Per-user preferences |

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

## Project Structure

```
├── app/
│   ├── (auth)/              # Sign-in & sign-up pages
│   │   ├── sign-in/
│   │   ├── sign-up/
│   │   └── layout.tsx
│   ├── (dashboard)/         # Protected routes
│   │   ├── chat/            # Chat interface
│   │   │   ├── page.tsx     # New chat
│   │   │   └── [id]/        # Existing conversation
│   │   ├── admin/           # Admin dashboard
│   │   ├── settings/        # User settings
│   │   └── layout.tsx       # Sidebar + user sync
│   ├── api/
│   │   ├── chat/            # POST — stream AI responses
│   │   ├── conversations/   # CRUD for conversations
│   │   ├── admin/users/     # Admin user management
│   │   ├── health/          # GET — health check
│   │   └── webhooks/        # Clerk webhook handler
│   ├── page.tsx             # Landing page (50/50 split)
│   ├── layout.tsx           # Root layout + Clerk provider
│   └── globals.css          # Tailwind + shadcn theme
├── components/
│   ├── auth-switcher.tsx    # Sign-in ↔ sign-up toggle
│   ├── chat-input.tsx       # Auto-resize textarea + send
│   ├── chat-messages.tsx    # Message bubbles + markdown
│   ├── conversation-list.tsx # Sidebar thread list
│   ├── sidebar-client.tsx   # Client-side conversation sync
│   ├── mobile-sidebar.tsx   # Hamburger sidebar for mobile
│   ├── landing-carousel.tsx # Picsum image carousel
│   ├── error-boundary.tsx   # React error boundary
│   ├── loading-skeleton.tsx # Skeleton loading states
│   └── ui/                  # shadcn/ui primitives
├── lib/
│   ├── db/
│   │   ├── schema.ts        # Drizzle ORM table definitions
│   │   └── index.ts         # Database connection
│   ├── model.ts             # Custom LangChain chat model adapter
│   ├── conversations.ts     # Conversation & message DB operations
│   ├── admin.ts             # Admin stats & user management
│   ├── rate-limit.ts        # In-memory rate limiter
│   ├── validations.ts       # Zod schemas + sanitization
│   └── utils.ts             # CSS class merging
├── scripts/
│   └── clean-db.ts          # Wipe all database data
├── drizzle/                 # Migration files
├── middleware.ts            # Clerk auth middleware
├── netlify.toml             # Netlify deployment config
└── next.config.ts           # Security headers + image config
```

## API Routes

### POST `/api/chat`

Send a message and stream the AI response.

```
Body: { conversationId?: string, message: string }
Response: SSE stream with { delta, done, conversationId, error }
```

### GET `/api/conversations`

List the current user's conversations.

```
Response: [{ id, title, updatedAt, ... }]
```

### POST `/api/conversations`

Create a new conversation.

```
Body: { title?: string }
Response: { id, title, ... }
```

### GET `/api/conversations/[id]`

Get messages for a conversation.

```
Response: { conversation: {...}, messages: [{ role, content, ... }] }
```

### PATCH `/api/conversations/[id]`

Rename a conversation.

```
Body: { title: string }
Response: { id, title, ... }
```

### DELETE `/api/conversations/[id]`

Delete a conversation and all its messages.

### GET `/api/admin/users`

Admin-only. List users with optional search.

```
Query: ?search=email&limit=50&offset=0
Query: ?stats=true (returns aggregate stats)
```

### DELETE `/api/admin/users/[id]`

Admin-only. Delete a user from both Supabase and Clerk. Self-deletion blocked.

### GET `/api/health`

Health check — returns `{ status: "healthy" }` if DB is reachable.

## Authentication

Clerk handles all authentication. Unauthenticated users see the landing page with sign-in/sign-up forms. Authenticated users are redirected to `/chat`.

### Protected Routes

- `/chat` — chat interface
- `/settings` — user settings  
- `/admin` — admin dashboard (also requires `role=admin`)

### Role Sync

On every login, the dashboard layout syncs the user's Clerk role (stored in `private_metadata.role`) to the Supabase `users` table. A Clerk webhook at `/api/webhooks/clerk` handles `user.created` and `user.updated` events for real-time sync.

### Admin Promotion

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → Users
2. Edit a user → set Private Metadata to `{"role": "admin"}`
3. On next login, the role syncs automatically

## LangChain Integration

The project uses a **custom LangChain chat model adapter** (`lib/model.ts`) because the Modal endpoint uses an OpenAI-compatible JSON format but is not an OpenAI model.

- `_generate()` — non-streaming call, returns full response
- `_streamResponseChunks()` — detects SSE vs plain JSON, yields `AIMessageChunk` objects for token-by-token streaming

The API route uses LangChain's streaming via `for await (const chunk of model._streamResponseChunks(...))` and pipes the tokens through Server-Sent Events.

## Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/chat` | 30 | 1 minute |
| API conversations | 60 | 1 minute |
| API admin | 100 | 1 minute |

Exceed the limit and you get a `429 Too Many Requests` with a `Retry-After` header.

## SEO & Performance

- Server-rendered metadata with OpenGraph tags
- `robots.txt` pointing to the domain
- Template-based page titles (`"page | Haney Chat"`)
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- API routes: `Cache-Control: no-store`
- Database indexes on `clerk_user_id`, `email`, `role`, and foreign keys

## Deployment to Netlify

```bash
# Build and deploy
npm run build
```

Configure these environment variables in Netlify dashboard:
- `MODEL_API`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`

## Utility Scripts

```bash
# Clean all data from the database
npx tsx scripts/clean-db.ts
```

## License

MIT
