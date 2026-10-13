# GoodBetterBestReads — Strategic Feature Roadmap

This document outlines the prioritized feature roadmap for GoodBetterBestReads, organized into distinct phases based on architectural leverage, user impact, and everyday usability.

---

## 🎯 Vision & North Star

Transform **GoodBetterBestReads** from a passive Goodreads library viewer into an **autonomous, social, and AI-powered reading companion**:
1. **Self-Sufficient**: Add, rate, move, and discover books without needing to export or upload CSV files.
2. **Social & Connected**: Discover books through taste compatibility with friends and family (like your spouse and reading group).
3. **Intelligent & Contextual**: Leverage your Gemini Reading DNA and library embeddings to eliminate choice paralysis and recommend what to read next.
4. **App-Like & Frictionless**: Deliver a smooth, native-feeling mobile experience on iOS and Android.

---

## 🗺️ Priority Overview

| Phase | Category | Focus | Impact | Effort |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | **Core Library Independence** | In-App Book Search, Manual Add, & Live Shelf Controls | 🔥 Critical | Medium |
| **Phase 2** | **Social & Friend Synergy** | Taste Match Score, Shared Books Overlap, & Friend Recs | 🌟 High | Low–Med |
| **Phase 3** | **AI Superpowers** | "What Should I Read Next?" Shelf Concierge | 🧠 High | Low–Med |
| **Phase 4** | **Gamification & Insights** | Annual Reading Goal Challenge & Visual Stats Hub | 📊 Medium | Medium |
| **Phase 5** | **Mobile PWA Native Polish** | Barcode Camera Scanner, iOS Share Sheet, Offline Cache | 📱 Medium | Medium |

---

## Phase 1: Core Library Independence (Top Priority)

> **Objective**: Free readers from Goodreads CSV dependencies so the app can be used every day to log, rate, and discover new books.

### 1.1 In-App Book Search & Quick Add
- [ ] **Context**: Readers currently cannot add new books unless they upload an updated CSV from Goodreads or StoryGraph.
- [ ] **User Experience**:
  - Global `+ Add Book` button in the navbar, bottom tab, and library header.
  - Quick-search modal with debounced search querying Open Library and Google Books API.
  - Real-time preview showing title, author, publish year, and high-res cover art (via the 3-tier cover engine).
  - Single-click shelf assignment: *Want to Read*, *Currently Reading*, *Read*, or *Did Not Finish*.
  - Optional initial rating (1–5 stars) and review notes.
- [ ] **Technical Implementation**:
  - New route: `GET /api/books/search?q={query}` (multi-source lookup with Open Library & Google Books fallback).
  - Auto-generate book vector embeddings via `@ai-sdk/google` upon addition so the book immediately integrates with Reading DNA and Personal Librarian search.
  - Insert into `books` and `user_books` tables with optimistic UI feedback.

### 1.2 Live Shelf Management & Inline Rating
- [ ] **Context**: Changing shelves or updating a book rating currently requires manual database edits or CSV re-imports.
- [ ] **User Experience**:
  - Dropdown badge on each book card to seamlessly switch shelves (*Want to Read* ➔ *Currently Reading* ➔ *Read*).
  - Interactive 5-star rating control directly on library cards with half-star/full-star support.
  - Date started and date finished picker when moving to *Currently Reading* or *Read*.
- [ ] **Technical Implementation**:
  - `PATCH /api/user-books/[id]` route with optimistic updates in React state.
  - Toast confirmation notifications ("Moved *The Andromeda Strain* to Read!").

---

## Phase 2: Social & Friend Synergy

> **Objective**: Turn reading into a shared, conversational experience with your spouse, friends, and book clubs.

### 2.1 "Taste Match" Compatibility Score
- [ ] **Context**: Readers can view their friends' shelves, but understanding how closely their tastes align requires manual inspection.
- [ ] **User Experience**:
  - A prominent badge on each friend's card and profile header: e.g., **"86% Taste Match with Sarah"**.
  - Visual breakdown:
    - Shared favorite genres (e.g., *Sci-Fi Thriller*, *Dark Fantasy*).
    - Pacing preference alignment (e.g., both prefer *Breakneck Pacing*).
    - Average rating alignment on overlapping books.
- [ ] **Technical Implementation**:
  - Cosine similarity calculation between the two users' 768-dimensional Reading DNA vector embeddings.
  - Cross-comparison of top trope and genre tags stored in `taste_profiles`.

### 2.2 Shared Books & Taste Overlap Hub
- [ ] **Context**: When visiting a friend's profile, finding mutual books or inspiration is difficult.
- [ ] **User Experience**:
  - Filter tabs on `/friends/[id]/library`:
    - **Both Loved**: Books both users rated 4 or 5 stars.
    - **Your Queue, Their Read**: Books on your *Want to Read* shelf that your friend has already finished and rated.
    - **Agree to Disagree**: Books where your ratings diverged significantly (great conversation starters).
- [ ] **Technical Implementation**:
  - SQL inner join on `user_books` between `auth.uid()` and `friend_user_id` joined on `book_id`.

### 2.3 Direct Friend Book Recommendations
- [ ] **Context**: Recommending a book usually requires texting a link or title that gets lost in chat apps.
- [ ] **User Experience**:
  - **"Recommend to a Friend"** button on any book card.
  - Select a friend and write an optional note (e.g., *"You loved Project Hail Mary, you'll obsess over this!"*).
  - Recipient gets a notification badge and a dedicated **"Recommended by Friends"** shelf.
- [ ] **Technical Implementation**:
  - New `book_recommendations` table (`sender_id`, `receiver_id`, `book_id`, `note`, `status`).

---

## Phase 3: AI Superpowers (Personal Librarian Concierge)

> **Objective**: Solve reader decision paralysis by putting your personal AI librarian directly into your library shelves.

### 3.1 "What Should I Read Next?" Shelf Concierge
- [ ] **Context**: Readers often have 50+ books on their *Want to Read* shelf and spend 20 minutes trying to decide what to pick up next.
- [ ] **User Experience**:
  - Action button at the top of the *Want to Read* shelf: **"Ask Librarian What's Next"**.
  - Quick mood selector: *"I want something fast-paced"*, *"Surprise me with a mystery"*, *"Something light and cozy"*, or custom prompt.
  - The Personal Librarian evaluates your *Want to Read* catalog against your Reading DNA and outputs 3 personalized recommendations with custom pitches.
- [ ] **Technical Implementation**:
  - Scoped prompt passed to Gemini 2.5 Flash containing the user's *Want to Read* subset and user taste profile.
  - Output structured JSON rendered as interactive book recommendation cards with a 1-click "Start Reading Now" action.

### 3.2 Spoil-Free Series Tracker & Progression
- [ ] **Context**: Readers forget which book comes next in a fantasy/thriller series or which books they've already read.
- [ ] **User Experience**:
  - Book cards automatically group or badge series order (e.g., *"Hades & Persephone #2"*).
  - Shows progress bar for completed series (e.g., *"2 of 4 books read"*).

---

## Phase 4: Gamification & Reading Insights

> **Objective**: Provide rewarding visual milestones that motivate consistent reading habits.

### 4.1 Annual Reading Challenge & Progress Bar
- [ ] **Context**: Readers love setting yearly goals (e.g., read 30 books in 2026).
- [ ] **User Experience**:
  - Set a custom yearly goal in user profile.
  - Interactive progress widget on Home and Library: *"24 of 30 books read (80%) • On track to finish 3 books ahead of schedule"*.
  - Celebration animation (confetti) upon completing the goal.
- [ ] **Technical Implementation**:
  - Query `user_books` where `status = 'read'` and `date_finished` falls within the current calendar year.

### 4.2 Visual Reading Insights Dashboard
- [ ] **Context**: StoryGraph and Goodreads Year-in-Review are immensely popular because readers love visualizing their habits.
- [ ] **User Experience**:
  - Dedicated `/insights` or tab in `/dna`:
    - **Books read per month** (bar chart).
    - **Total pages read** with milestone equivalents ("You read 12,400 pages — that's 3 Lord of the Rings trilogies!").
    - **Rating distribution** (how generous are you with 5 stars?).
    - **Top authors and genres** read this year.

---

## Phase 5: Mobile & Native PWA Polish

> **Objective**: Make the web app feel 100% indistinguishable from an App Store application on iOS and Android.

### 5.1 Physical Book Barcode / Camera Scanner
- [ ] **Context**: Browsing in a physical bookstore or library and wanting to instantly check if a book matches your taste or add it to your shelf.
- [ ] **User Experience**:
  - In the "Add Book" modal, tap a camera icon: **"Scan Barcode"**.
  - Uses the phone camera to scan the ISBN barcode on the back cover.
  - Instantly pulls up book details, ratings, and lets you add it to *Want to Read* in under 3 seconds.
- [ ] **Technical Implementation**:
  - Use HTML5 Barcode Detection API or lightweight JS barcode reader (`@zxing/library` or `quagga2`).
  - Lookup via ISBN directly through Amazon/Open Library CDN.

### 5.2 Native iOS Share Sheet Integration
- [ ] **Context**: Sharing a great book or Reading DNA card with a friend over iMessage or AirDrop.
- [ ] **User Experience**:
  - Tapping "Share" opens the native iOS/Android system share sheet with book title, author, cover image, and link.
- [ ] **Technical Implementation**:
  - Use `navigator.share({ title, text, url })` with fallback to clipboard copy on unsupported desktop browsers.

### 5.3 Offline Library Caching
- [ ] **Context**: Accessing your library while flying or in places with spotty reception.
- [ ] **User Experience**:
  - Shelves load immediately even when completely offline.
- [ ] **Technical Implementation**:
  - Cache Supabase responses in IndexedDB via TanStack Query / SWR or Workbox service worker caching.

---

## 📅 Suggested Implementation Next Step

When you are ready to begin, we recommend starting with **Phase 1.1 & 1.2: In-App Book Search & Live Shelf Management**. This gives you the biggest immediate quality-of-life leap and makes the app fully self-sustaining.
