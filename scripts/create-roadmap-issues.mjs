import { execSync } from "child_process";

const GH_EXE = `"C:\\Program Files\\GitHub CLI\\gh.exe"`;
const REPO = "rabrodbeck/good-better-best-reads";
const PROJECT_NUMBER = "1";
const PROJECT_ID = "PVT_kwHOCGDCW84Bl1rJ";
const OWNER = "rabrodbeck";

// Field IDs in Project 1
const STATUS_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7WA";
const STATUS_OPTIONS = {
  Backlog: "f75ad846",
  Ready: "61e4505c",
  InProgress: "47fc9ee4",
  InReview: "df73e18b",
  Done: "98236657",
};

const PRIORITY_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7yg";
const PRIORITY_OPTIONS = {
  P0: "79628723",
  P1: "0a877460",
  P2: "da944a9c",
};

const SIZE_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7yk";
const SIZE_OPTIONS = {
  XS: "6c6483d2",
  S: "f784b110",
  M: "7515a9f1",
  L: "817d0097",
  XL: "db339eb2",
};

const ISSUES = [
  // --- Phase 1: Core Library Independence ---
  {
    phase: 1,
    title: "[Phase 1] feat(search): multi-provider book search with 3-tier cover engine & Google Books fallback",
    labels: ["enhancement", "phase-1"],
    priority: "P0",
    size: "M",
    status: "Ready",
    body: `### Overview
Expand \`GET /api/books/search\` to provide resilient book lookup by querying Open Library and automatically falling back to Google Books API if Open Library returns zero results, times out, or encounters 5xx errors.

### Tasks
- [ ] Connect search results to the 3-tier cover resolution engine (\`cover-service.ts\`) so books with missing Open Library covers attempt Amazon ISBN CDN and Goodreads lookups.
- [ ] Implement Google Books fallback query when Open Library returns empty or fails.
- [ ] Filter out study guides (SuperSummary, CliffsNotes, SparkNotes) and multi-book collection box sets from search results.
- [ ] Add unit tests verifying search fallback, cover resolution, and study guide rejection.`,
  },
  {
    phase: 1,
    title: "[Phase 1] feat(library): global quick-add modal accessible from navbar and mobile bottom nav",
    labels: ["enhancement", "phase-1"],
    priority: "P0",
    size: "M",
    status: "Ready",
    body: `### Overview
Provide a persistent "+ Add Book" action accessible from the top Navbar and mobile navigation bar, allowing readers to search and add any book to their library from anywhere in the application.

### Tasks
- [ ] Add "+ Add Book" button in desktop Navbar and mobile action areas.
- [ ] Wire AddBookModal to support one-click shelf assignment (*Want to Read*, *Currently Reading*, *Read*, *Did Not Finish*), optional star rating (1–5), and notes.
- [ ] Trigger background vector embedding generation (\`@ai-sdk/google\`) on book creation so it immediately integrates with Reading DNA and Personal Librarian search.
- [ ] Provide optimistic state updates with toast notifications confirming book additions.`,
  },
  {
    phase: 1,
    title: "[Phase 1] feat(library): live shelf transitions with reading date tracking and toast feedback",
    labels: ["enhancement", "phase-1"],
    priority: "P1",
    size: "S",
    status: "Ready",
    body: `### Overview
Allow readers to seamlessly transition books between shelves (*Want to Read*, *Currently Reading*, *Read*, *Did Not Finish*) with instant optimistic UI feedback.

### Tasks
- [ ] Support dropdown shelf switching on book cards across all views.
- [ ] Automatically set or prompt for \`date_read\` when moving a book into the *Read* shelf.
- [ ] Sync updates via \`PATCH /api/library\` with automatic error rollback and informative toast alerts.
- [ ] Recalculate library shelf counters and statistics in real time without page reload.`,
  },
  {
    phase: 1,
    title: "[Phase 1] feat(library): interactive book card rating controls with optimistic sync",
    labels: ["enhancement", "phase-1"],
    priority: "P1",
    size: "S",
    status: "Ready",
    body: `### Overview
Support instant 1–5 star rating assignment and clearing directly on library cards without opening sub-menus or re-importing CSV files.

### Tasks
- [ ] Interactive star hover and tap hit zones with 44pt touch manipulation for mobile.
- [ ] Instant optimistic state updates for rating values.
- [ ] Persist rating changes via \`PATCH /api/library\`.
- [ ] Recompute library average rating and 5-star/4-star counts dynamically.
- [ ] Add unit tests covering shelf and rating PATCH handlers and state management.`,
  },

  // --- Phase 2: Social & Friend Synergy ---
  {
    phase: 2,
    title: "[Phase 2] feat(friends): calculate Reading DNA taste compatibility match score between friends",
    labels: ["enhancement", "phase-2"],
    priority: "P1",
    size: "M",
    status: "Backlog",
    body: `### Overview
Compute a taste compatibility score (e.g. "86% Taste Match") between two readers by comparing their 768-dimensional Reading DNA vector embeddings and archetype traits.

### Tasks
- [ ] Implement cosine similarity comparison between user taste profiles in Supabase.
- [ ] Display compatibility match badge on friend cards in \`/friends\` and \`/friends/[id]/library\`.
- [ ] Show shared favorite genres, pacing preferences, and overlapping tropes breakdown.`,
  },
  {
    phase: 2,
    title: "[Phase 2] feat(friends): shared books and taste overlap filters in friend library view",
    labels: ["enhancement", "phase-2"],
    priority: "P1",
    size: "M",
    status: "Backlog",
    body: `### Overview
Enhance the Friend Library view (\`/friends/[id]/library\`) with dedicated filter tabs showing mutual books and reading overlaps.

### Tasks
- [ ] Add "Both Loved" filter tab showing books both readers rated 4 or 5 stars.
- [ ] Add "On Your Want-to-Read (Read by Friend)" filter for instant vetted book recommendations.
- [ ] Add "Rating Contrasts" tab showing books with diverging opinions for friendly discussion.`,
  },
  {
    phase: 2,
    title: "[Phase 2] feat(friends): direct friend-to-friend book recommendation system",
    labels: ["enhancement", "phase-2"],
    priority: "P2",
    size: "M",
    status: "Backlog",
    body: `### Overview
Allow readers to recommend any book directly to a friend with an optional note, creating a personalized reading queue.

### Tasks
- [ ] Add "Recommend to Friend" modal/button on book cards.
- [ ] Create \`book_recommendations\` table in Supabase with RLS policies.
- [ ] Add "Recommended by Friends" shelf filter on the library page with badge notification.`,
  },

  // --- Phase 3: AI Superpowers ---
  {
    phase: 3,
    title: "[Phase 3] feat(ai): 'What Should I Read Next?' Want-to-Read shelf concierge",
    labels: ["enhancement", "phase-3"],
    priority: "P1",
    size: "M",
    status: "Backlog",
    body: `### Overview
Add an AI Shelf Concierge on the *Want to Read* shelf that analyzes the reader's queue against their current mood and Reading DNA to recommend the top 3 books.

### Tasks
- [ ] Add "Ask Librarian What's Next" action button on \`/library?shelf=to-read\`.
- [ ] Provide quick mood picker (e.g., "Fast-paced thriller", "Cozy romance", "Thought-provoking sci-fi").
- [ ] Prompt Gemini 2.5 Flash with the reader's Want-to-Read queue and taste profile.
- [ ] Render 3 recommendation cards with rationale and one-click "Start Reading" action.`,
  },
  {
    phase: 3,
    title: "[Phase 3] feat(library): series grouping, volume progression, and reading order tracking",
    labels: ["enhancement", "phase-3"],
    priority: "P2",
    size: "L",
    status: "Backlog",
    body: `### Overview
Automatically identify book series from metadata, group series titles together in the library, and display volume badges and completion progress.

### Tasks
- [ ] Parse series names and book volume numbers from title strings and Open Library work records.
- [ ] Display series badges on book cards (e.g. "Dune #2", "Hades & Persephone #1").
- [ ] Display series progress indicator (e.g., "3 of 5 read").`,
  },

  // --- Phase 4: Gamification & Reading Insights ---
  {
    phase: 4,
    title: "[Phase 4] feat(goals): annual reading challenge goal setting and visual progress tracker",
    labels: ["enhancement", "phase-4"],
    priority: "P2",
    size: "M",
    status: "Backlog",
    body: `### Overview
Allow readers to set an annual reading goal (e.g., 35 books in 2026) and track progress with interactive visual indicators.

### Tasks
- [ ] Support setting annual book goal in user profile settings.
- [ ] Display circular/linear progress bar on library dashboard showing books completed vs. goal.
- [ ] Calculate pace metric ("On track to finish 4 books ahead of schedule").
- [ ] Add completion celebration animation (confetti).`,
  },
  {
    phase: 4,
    title: "[Phase 4] feat(insights): visual reading stats dashboard (monthly velocity, pages, genre distribution)",
    labels: ["enhancement", "phase-4"],
    priority: "P2",
    size: "L",
    status: "Backlog",
    body: `### Overview
Create a visual statistics dashboard displaying reading habits, pacing velocity, and catalog analytics.

### Tasks
- [ ] Build monthly reading volume bar chart (books read per month).
- [ ] Calculate total pages read with fun equivalent comparisons.
- [ ] Display rating distribution chart and top genres/authors breakdown.`,
  },

  // --- Phase 5: Mobile & Native PWA Polish ---
  {
    phase: 5,
    title: "[Phase 5] feat(mobile): camera barcode scanner for instant physical book ISBN lookup",
    labels: ["enhancement", "phase-5"],
    priority: "P2",
    size: "M",
    status: "Backlog",
    body: `### Overview
Enable mobile readers to scan physical book barcodes in bookstores or libraries to immediately look up book details and add to their shelf.

### Tasks
- [ ] Add "Scan Barcode" button in the Add Book modal using device camera.
- [ ] Integrate lightweight barcode scanning library (e.g. \`@zxing/browser\` or BarcodeDetector API).
- [ ] Auto-populate ISBN and trigger instant 3-tier lookup.`,
  },
  {
    phase: 5,
    title: "[Phase 5] feat(mobile): native iOS & Android Web Share API integration",
    labels: ["enhancement", "phase-5"],
    priority: "P2",
    size: "S",
    status: "Backlog",
    body: `### Overview
Integrate \`navigator.share\` to trigger native iOS and Android share sheets for sharing books and Reading DNA cards via iMessage, WhatsApp, and social apps.

### Tasks
- [ ] Add share button on book cards and Reading DNA card.
- [ ] Invoke Web Share API with title, author, URL, and OG preview image.
- [ ] Fall back gracefully to clipboard copy with toast notification on desktop browsers.`,
  },
  {
    phase: 5,
    title: "[Phase 5] feat(mobile): offline library caching via Service Worker & IndexedDB",
    labels: ["enhancement", "phase-5"],
    priority: "P2",
    size: "L",
    status: "Backlog",
    body: `### Overview
Enable offline reading shelf access so readers can view their shelves without cellular connection on flights or subways.

### Tasks
- [ ] Configure Workbox / Next.js service worker caching for library API data.
- [ ] Cache user library records in client IndexedDB.
- [ ] Provide offline indicator banner when connection is unavailable.`,
  },
];

async function main() {
  console.log(`Starting issue creation and project dashboard setup for ${ISSUES.length} items...`);

  for (const item of ISSUES) {
    try {
      console.log(`\nCreating: ${item.title}`);
      const labelsArg = item.labels.map((l) => `--label "${l}"`).join(" ");

      // Create issue
      const createCmd = `${GH_EXE} issue create --repo "${REPO}" --title "${item.title.replace(/"/g, '\\"')}" --body "${item.body.replace(/"/g, '\\"')}" ${labelsArg}`;
      const issueUrl = execSync(createCmd, { encoding: "utf-8" }).trim();
      console.log(`  Issue URL: ${issueUrl}`);

      // Add issue to Project 1
      const addCmd = `${GH_EXE} project item-add ${PROJECT_NUMBER} --owner "${OWNER}" --url "${issueUrl}" --format json`;
      const addOutput = execSync(addCmd, { encoding: "utf-8" });
      const itemData = JSON.parse(addOutput);
      const itemId = itemData.id;
      console.log(`  Project Item ID: ${itemId}`);

      // Set Status
      const statusOptionId = STATUS_OPTIONS[item.status];
      if (statusOptionId) {
        const editStatusCmd = `${GH_EXE} project item-edit --id "${itemId}" --project-id "${PROJECT_ID}" --field-id "${STATUS_FIELD_ID}" --single-select-option-id "${statusOptionId}"`;
        execSync(editStatusCmd, { encoding: "utf-8" });
        console.log(`  Status set to: ${item.status}`);
      }

      // Set Priority
      const priorityOptionId = PRIORITY_OPTIONS[item.priority];
      if (priorityOptionId) {
        const editPriorityCmd = `${GH_EXE} project item-edit --id "${itemId}" --project-id "${PROJECT_ID}" --field-id "${PRIORITY_FIELD_ID}" --single-select-option-id "${priorityOptionId}"`;
        execSync(editPriorityCmd, { encoding: "utf-8" });
        console.log(`  Priority set to: ${item.priority}`);
      }

      // Set Size
      const sizeOptionId = SIZE_OPTIONS[item.size];
      if (sizeOptionId) {
        const editSizeCmd = `${GH_EXE} project item-edit --id "${itemId}" --project-id "${PROJECT_ID}" --field-id "${SIZE_FIELD_ID}" --single-select-option-id "${sizeOptionId}"`;
        execSync(editSizeCmd, { encoding: "utf-8" });
        console.log(`  Size set to: ${item.size}`);
      }
    } catch (err) {
      console.error(`Error processing "${item.title}":`, err.message);
    }
  }

  console.log("\nFinished setting up project dashboard items!");
}

main();
