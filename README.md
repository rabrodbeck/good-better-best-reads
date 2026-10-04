# GoodBetterBestReads

An AI-powered reading taste intelligence system and conversational librarian that transforms static reading history into high-dimensional vector embeddings, dynamic taste archetypes, and personalized book recommendations.

---

## Overview

GoodBetterBestReads moves beyond five-star whole-number ratings and generic bestseller lists. By combining client-side CSV parsing, Google Gemini 2.5 Flash, and PostgreSQL `pgvector`, the application extracts deep narrative preferences—such as pacing tempo, emotional tone, loved tropes, and critical dealbreakers—and grounds conversational recommendations in the reader's actual history.

### Live Production Deployment
- **URL**: [goodbetterbestreads.vercel.app](https://goodbetterbestreads.vercel.app)
- **Hosting**: Vercel (Serverless and Edge Runtimes)
- **Database**: Supabase PostgreSQL with `pgvector` extension

---

## Core Capabilities

### 1. Zero Cold-Start Ingestion
- Ingests Goodreads and StoryGraph CSV exports entirely client-side using chunked processing.
- Handles libraries with hundreds of books in seconds without server timeouts or gateway limits.
- Automatically handles publication date cleaning, author normalization, and rating scaling.

### 2. 60-Second Reading Taste Quiz
- Provides an immediate entry point for readers who do not have an existing CSV export.
- Evaluates preferred genres, narrative pacing, emotional atmosphere, loved tropes, and pet peeves.
- Employs a non-destructive preview sandbox so users can explore generated archetypes before applying them to their profile.

### 3. Semantic Vector Embeddings
- Synthesizes user reading patterns into high-dimensional vector representations using Google's 768-dimensional text embedding models.
- Employs PostgreSQL Hierarchical Navigable Small World (HNSW) indexes for sub-millisecond cosine distance lookups across the shared book catalog.

### 4. Conversational Vector Librarian
- Interactive chat interface powered by Gemini 2.5 Flash and Vercel AI SDK v7.
- Incorporates multi-turn tool calling to search Open Library and return verified publication years, page counts, and high-resolution cover art in real time.
- Excludes titles the user has already read or marked as Did Not Finish (DNF) directly at the database query level.

### 5. English-First Cover Art Enrichment
- Automated metadata fallback service using Open Library's editions hierarchy.
- Inspects edition language attributes (`eng`) to prevent foreign-language translations from displaying on English catalog titles.
- Implements standardized "Cover Unavailable" UI fallbacks with image error handling.

### 6. Edge-Rendered Reading DNA Cards
- Generates dynamic, high-resolution social sharing cards using Satori and Next.js Edge Runtime (`/api/og/reading-dna`).
- Displays the reader's primary archetype, dominant tone, top tropes, and reading stats.

### 7. Progressive Web App (PWA)
- Full web app manifest, dynamic icons, and responsive layout supporting native installation across mobile (iOS/Android) and desktop browsers.

---

## System Architecture

```text
[ Browser / Client ]
  │
  ├── CSV Parser (Client-Side Normalization)
  ├── 60-Second Taste Quiz (Interactive Wizard)
  └── Responsive UI (Next.js 16, React 19, Tailwind CSS v4)
        │
        ▼
[ Next.js Route Handlers (Vercel Serverless & Edge) ]
  │
  ├── /api/chat     ──> Google Gemini 2.5 Flash (Streaming AI Librarian)
  ├── /api/quiz     ──> Taste Synthesis & Vector Generation
  ├── /api/import   ──> Batch Upsert & Enrichment
  ├── /api/library  ──> Scoped User Shelf Queries
  └── /api/og/*     ──> Satori / Edge Image Generation
        │
        ▼
[ Data Layer ]
  ├── Supabase PostgreSQL 15+ (pgvector HNSW index, Row Level Security)
  ├── Supabase Auth (Google OAuth 2.0 with SSR session cookies)
  └── Open Library API (Book metadata and cover art CDN)
```

---

## Technical Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack, React 19) |
| **Styling** | Tailwind CSS v4, Base UI, Lucide Icons |
| **Artificial Intelligence** | Google Gemini 2.5 Flash, Gemini Text Embedding 004 via `@ai-sdk/google` |
| **Database** | Supabase (PostgreSQL 15+, `pgvector` extension) |
| **Authentication** | Supabase Auth with Google OAuth (`@supabase/ssr`) |
| **Data Normalization** | PapaParse, Zod schema validation |
| **Image Generation** | `@vercel/og`, Satori |
| **Deployment** | Vercel (Edge & Serverless Node.js runtimes) |

---

## Database Architecture

The PostgreSQL database relies on four primary tables and an HNSW vector index:

- **`public.profiles`**: Stores user identity, Google OAuth metadata, reading goals, and the current taste archetype. Linked to `auth.users` with cascading deletion.
- **`public.books`**: Global crowdsourced book catalog storing clean titles, authors, ISBNs, cover URLs, publication metadata, and 768-dimensional Gemini embeddings.
- **`public.user_books`**: Maps individual users to catalog books with their private shelf state (`read`, `currently-reading`, `to-read`, `did-not-finish`), star rating, date read, and personal notes.
- **`public.taste_profiles`**: Contains the synthesized narrative archetype, summary, preferred pacing, emotional tone, top tropes, dealbreakers, and the user's composite 768-dimensional taste vector.
- **`match_books` (RPC Function)**: Executes fast cosine similarity queries (`1 - (embedding <=> query_embedding)`) against `books`, automatically excluding books already present on the requesting user's `read` or `did-not-finish` shelves.

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- npm, pnpm, or yarn
- A Supabase project with the `vector` extension enabled
- A Google AI Studio API key (Gemini)

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/brodbeck85/good-better-best-reads.git
cd good-better-best-reads
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Google Gemini AI Configuration
GOOGLE_GENERATIVE_AI_API_KEY=<your-gemini-api-key>
```

### 3. Run Database Migrations
Execute the SQL migration scripts located in the `supabase/migrations/` directory within your Supabase SQL Editor:
1. `supabase/migrations/20260929_init.sql` (Tables, RLS policies, HNSW index, match_books function)
2. `supabase/migrations/20261002_taste_enhancements_and_dedup.sql` (Pacing and emotional tone columns)

### 4. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Verification

To run a production build locally with Turbopack:

```bash
npm run build
npm run start
```

---

## License

This project is open-source and available under the [MIT License](LICENSE).
