# TBRScout — Strategic Feature Roadmap

This document outlines the prioritized feature roadmap for TBRScout, organized into distinct phases based on architectural leverage, user impact, and everyday usability.

---

## 🎯 Vision & North Star

Transform **TBRScout** into an **autonomous, social, and AI-powered in-store reading concierge & companion**:
1. **Self-Sufficient**: Add, rate, move, and discover books without needing to export or upload CSV files.
2. **Social & Connected**: Discover books through taste compatibility with friends and family (like your spouse and reading group).
3. **Intelligent & Contextual**: Leverage your Gemini Reading DNA and library embeddings to eliminate choice paralysis and recommend what to read next.
4. **App-Like & Frictionless**: Deliver a smooth, native-feeling mobile experience on iOS and Android.

---

## 🗺️ Priority Overview

| Phase | Category | Focus | Impact | Effort | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | **Core Library Independence** | In-App Book Search, Manual Add, & Live Shelf Controls | 🔥 Critical | Medium | ✅ Complete |
| **Phase 2** | **Social & Friend Synergy** | Taste Match Score, Shared Books Overlap, & Friend Recs | 🌟 High | Low–Med | ✅ Complete |
| **Phase 3** | **AI Superpowers** | "What Should I Read Next?" Shelf Concierge & Series Tracker | 🧠 High | Low–Med | ✅ Complete |
| **Phase 4** | **Gamification & Insights** | Annual Reading Goal Challenge & Visual Stats Hub | 📊 Medium | Medium | ✅ Complete |
| **Phase 5** | **Mobile PWA Native Polish** | Barcode Camera Scanner, iOS Share Sheet, Offline Cache | 📱 Medium | Medium | ✅ Complete |
| **Phase 6** | **Web Push Notifications** | Granular iOS/Android Push Alerts & Reading Reminders | 🔔 Optional | Low–Med | 💡 In Backlog |

---

## Phase 1: Core Library Independence (Top Priority) ✅ Completed

> **Objective**: Free readers from Goodreads CSV dependencies so the app can be used every day to log, rate, and discover new books.

### 1.1 In-App Book Search & Quick Add
- [x] **Context**: Readers currently cannot add new books unless they upload an updated CSV from Goodreads or StoryGraph.
- [x] **User Experience**:
  - Global `+ Add Book` button in the navbar, bottom tab, and library header.
  - Quick-search modal with debounced search querying Open Library and Google Books API.
  - Real-time preview showing title, author, publish year, and high-res cover art (via the 3-tier cover engine).
  - Single-click shelf assignment: *Want to Read*, *Currently Reading*, *Read*, or *Did Not Finish*.
  - Optional initial rating (1–5 stars) and review notes.
- [x] **Technical Implementation**:
  - New route: `GET /api/books/search?q={query}` (multi-source lookup with Open Library & Google Books fallback).
  - Auto-generate book vector embeddings via `@ai-sdk/google` upon addition so the book immediately integrates with Reading DNA and Personal Librarian search.
  - Insert into `books` and `user_books` tables with optimistic UI feedback.

### 1.2 Live Shelf Management & Inline Rating
- [x] **Context**: Changing shelves or updating a book rating currently requires manual database edits or CSV re-imports.
- [x] **User Experience**:
  - Dropdown badge on each book card to seamlessly switch shelves (*Want to Read* ➔ *Currently Reading* ➔ *Read*).
  - Interactive 5-star rating control directly on library cards with half-star/full-star support.
  - Date started and date finished picker when moving to *Currently Reading* or *Read*.
- [x] **Technical Implementation**:
  - `PATCH /api/user-books/[id]` route with optimistic updates in React state.
  - Toast confirmation notifications ("Moved *The Andromeda Strain* to Read!").

---

## Phase 2: Social & Friend Synergy ✅ Completed

> **Objective**: Turn reading into a shared, conversational experience with your spouse, friends, and book clubs.

### 2.1 "Taste Match" Compatibility Score
- [x] **Context**: Readers can view their friends' shelves, but understanding how closely their tastes align requires manual inspection.
- [x] **User Experience**:
  - A prominent badge on each friend's card and profile header: e.g., **"86% Taste Match with Sarah"**.
  - Visual breakdown:
    - Shared favorite genres (e.g., *Sci-Fi Thriller*, *Dark Fantasy*).
    - Pacing preference alignment (e.g., both prefer *Breakneck Pacing*).
    - Average rating alignment on overlapping books.
- [x] **Technical Implementation**:
  - Cosine similarity calculation between the two users' 768-dimensional Reading DNA vector embeddings.
  - Cross-comparison of top trope and genre tags stored in `taste_profiles`.

### 2.2 Shared Books & Taste Overlap Hub
- [x] **Context**: When visiting a friend's profile, finding mutual books or inspiration is difficult.
- [x] **User Experience**:
  - Filter tabs on `/friends/[id]/library`:
    - **Both Loved**: Books both users rated 4 or 5 stars.
    - **Your Queue, Their Read**: Books on your *Want to Read* shelf that your friend has already finished and rated.
    - **Agree to Disagree**: Books where your ratings diverged significantly (great conversation starters).
- [x] **Technical Implementation**:
  - SQL inner join on `user_books` between `auth.uid()` and `friend_user_id` joined on `book_id`.

### 2.3 Direct Friend Book Recommendations
- [x] **Context**: Recommending a book usually requires texting a link or title that gets lost in chat apps.
- [x] **User Experience**:
  - **"Recommend to a Friend"** button on any book card.
  - Select a friend and write an optional note (e.g., *"You loved Project Hail Mary, you'll obsess over this!"*).
  - Recipient gets a notification badge and a dedicated **"Recommended by Friends"** shelf.
- [x] **Technical Implementation**:
  - New `book_recommendations` table (`sender_id`, `receiver_id`, `book_id`, `note`, `status`).

---

## Phase 3: AI Superpowers (Personal Librarian Concierge) ✅ Completed

> **Objective**: Solve reader decision paralysis by putting your personal AI librarian directly into your library shelves.

### 3.1 "What Should I Read Next?" Shelf Concierge
- [x] **Context**: Readers often have 50+ books on their *Want to Read* shelf and spend 20 minutes trying to decide what to pick up next.
- [x] **User Experience**:
  - Action button at the top of the *Want to Read* shelf: **"Ask Librarian What's Next"**.
  - Quick mood selector: *"I want something fast-paced"*, *"Surprise me with a mystery"*, *"Something light and cozy"*, or custom prompt.
  - The Personal Librarian evaluates your *Want to Read* catalog against your Reading DNA and outputs 3 personalized recommendations with custom pitches.
- [x] **Technical Implementation**:
  - Scoped prompt passed to Gemini 2.5 Flash containing the user's *Want to Read* subset and user taste profile.
  - Output structured JSON rendered as interactive book recommendation cards with a 1-click "Start Reading Now" action.

### 3.2 Spoil-Free Series Tracker & Progression
- [x] **Context**: Readers forget which book comes next in a fantasy/thriller series or which books they've already read.
- [x] **User Experience**:
  - Book cards automatically group or badge series order (e.g., *"Hades & Persephone #2"*).
  - Shows progress bar for completed series (e.g., *"2 of 4 books read"*).

---

## Phase 4: Gamification & Reading Insights ✅ Completed

> **Objective**: Provide rewarding visual milestones that motivate consistent reading habits.

### 4.1 Annual Reading Challenge & Progress Bar
- [x] **Context**: Readers love setting yearly goals (e.g., read 30 books in 2026).
- [x] **User Experience**:
  - Set a custom yearly goal in user profile.
  - Interactive progress widget on Home and Library: *"24 of 30 books read (80%) • On track to finish 3 books ahead of schedule"*.
  - Celebration animation (confetti) upon completing the goal.
- [x] **Technical Implementation**:
  - Query `user_books` where `status = 'read'` and `date_finished` falls within the current calendar year.

### 4.2 Visual Reading Insights Dashboard
- [x] **Context**: StoryGraph and Goodreads Year-in-Review are immensely popular because readers love visualizing their habits.
- [x] **User Experience**:
  - Dedicated `/insights` dashboard:
    - **Books read per month** (bar chart).
    - **Total pages read** with milestone equivalents ("You read 12,400 pages — that's 3 Lord of the Rings trilogies!").
    - **Rating distribution** (how generous are you with 5 stars?).
    - **Top authors and genres** read this year.

---

## Phase 5: Mobile & Native PWA Polish ✅ Completed

> **Objective**: Make the web app feel 100% indistinguishable from an App Store application on iOS and Android.

### 5.1 Physical Book Barcode / Camera Scanner
- [x] **Context**: Browsing in a physical bookstore or library and wanting to instantly check if a book matches your taste or add it to your shelf.
- [x] **User Experience**:
  - In the "Add Book" modal, tap a camera icon: **"Scan Barcode"**.
  - Uses the phone camera to scan the ISBN barcode on the back cover.
  - Instantly pulls up book details, ratings, and lets you add it to *Want to Read* in under 3 seconds.
- [x] **Technical Implementation**:
  - Cross-platform `@zxing/browser` and `@zxing/library` barcode reader engine (compatible with iOS Safari WebKit and Android).
  - Full support for Bookland EAN-13 barcodes with 5-digit price extensions (e.g., *The Never Queen*).
  - Direct 3-tier lookup via Open Library / Amazon CDN.

### 5.2 Native iOS Share Sheet Integration
- [x] **Context**: Sharing a great book or Reading DNA card with a friend over iMessage or AirDrop.
- [x] **User Experience**:
  - Tapping "Share" opens the native iOS/Android system share sheet with book title, author, cover image, and link.
- [x] **Technical Implementation**:
  - Use `navigator.share({ title, text, url })` with fallback to clipboard copy on unsupported desktop browsers.

### 5.3 Offline Library Caching
- [x] **Context**: Accessing your library while flying or in places with spotty reception.
- [x] **User Experience**:
  - Shelves load immediately even when completely offline.
- [x] **Technical Implementation**:
  - Service Worker (`public/sw.js`) caching network requests and static assets.
  - Offline localStorage caching engine (`lib/offline-storage.ts`) displaying cached shelves with offline indicator ribbon.

---

## Phase 6: Web Push Notifications & Reader Alerts (Under Consideration / Backlog)

> **Objective**: Deliver high-value, low-noise native push notifications to Home Screen apps on iOS (16.4+) and Android without requiring an App Store download.

### 6.1 Potential Notification Types to Consider
- [ ] **Friend Book Recommendations (High Value, Low Noise)**:
  - *Example*: *"Sarah just recommended 'Tomorrow, and Tomorrow, and Tomorrow' to you: 'You have to read this next!'"*
  - Triggered immediately when a friend uses the "Recommend to Friend" feature.
- [ ] **Annual Goal Milestones & Reading Recaps**:
  - *Example*: *"🎉 Boom! You just hit 25 books and achieved 100% of your 2026 reading challenge!"*
  - Optional end-of-month summary: *"October wrap-up: You finished 3 books and are 2 books ahead of pace."*
- [ ] **Series Release & Next-in-Series Tracker**:
  - *Example*: *"The next book in the Red Rising saga is out"* or *"Ready for Book 2 of The Empyrean? It's waiting on your Want to Read shelf."*
  - Triggered when marking the previous volume in a series as Read.
- [ ] **Weekend Reading Nudge / Shelf Concierge**:
  - *Example*: *"Looking for your next read this weekend? Your Librarian concierge picked 3 matches from your Want to Read shelf."*
  - Low-frequency, gentle nudge (e.g., Friday afternoon) only when the user's *Currently Reading* shelf is empty.

### 6.2 Granular User Notification Controls
- [ ] **Context**: Prevent notification fatigue by giving the reader 100% control over which alert types are active.
- [ ] **User Experience**:
  - Notification Preferences section in User Profile settings with independent switches:
    - [ ] Friend recommendations
    - [ ] Goal milestones & monthly summaries
    - [ ] Next-in-series alerts
    - [ ] Weekend concierge suggestions
- [ ] **Technical Implementation**:
  - W3C Web Push API standard with VAPID keys.
  - Service worker `push` and `notificationclick` handlers in `public/sw.js`.
  - Supabase `push_subscriptions` table (`user_id`, `endpoint`, `p256dh`, `auth`, `preferences`).
  - Native iOS Home Screen Web App push support (iOS 16.4+ APNs integration).

---

## 📅 Current Status & What's Next

- **Phases 1–5 are 100% complete and deployed to production.**
- **Phase 6 (Push Notifications)** is captured in the backlog above for future consideration whenever you decide which alerts you'd like to implement.
