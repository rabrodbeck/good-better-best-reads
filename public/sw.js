/**
 * Service Worker for GoodBetterBestReads PWA (Issue #45)
 * Version: gbbr-pwa-v8
 * 
 * Comprehensive Offline Support:
 * 1. Network-first with cache fallback for /api/library, /api/insights, /api/goals.
 * 2. Stale-while-revalidate for covers, icons, and static assets.
 * 3. Self-contained Offline Library Shell for HTML navigations when offline:
 *    Renders cached shelves, search, and filters directly from localStorage with ZERO external chunk dependencies!
 * 4. Automatic purge of older cache versions (v1 through v7).
 */

const CACHE_NAME = "gbbr-pwa-v8";

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
];

// Install: precache essential icons and manifest
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("SW precache error:", err))
  );
});

// Activate: delete all stale caches (v1 through v6) immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log("Purging old cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event listener
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and Supabase auth callbacks
  if (event.request.method !== "GET" || url.pathname.startsWith("/auth/")) {
    return;
  }

  // Skip Next.js Turbopack / Webpack development HMR websocket & hot-update endpoints
  if (
    url.pathname.includes("/_next/webpack-hmr") ||
    url.pathname.includes("/__nextjs") ||
    url.pathname.endsWith(".hot-update.json") ||
    url.pathname.endsWith(".hot-update.js")
  ) {
    return;
  }

  // 1. API Caching Strategy: Network-First with Cache Fallback
  if (
    url.pathname === "/api/library" ||
    url.pathname === "/api/insights" ||
    url.pathname === "/api/goals"
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: "Offline mode", cached: true, books: [] }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        })
    );
    return;
  }

  // 2. Cover Images & Icons: Cache-First / Stale-While-Revalidate
  const isImageOrCover =
    event.request.destination === "image" ||
    url.pathname.startsWith("/_next/image") ||
    url.hostname.includes("covers.openlibrary.org") ||
    url.hostname.includes("media-amazon.com") ||
    url.hostname.includes("books.google.com");

  if (isImageOrCover) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          if (!self.navigator.onLine) {
            return cachedResponse;
          }
          // Background revalidation when online
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" viewBox="0 0 100 150"><rect width="100" height="150" fill="#27272a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#71717a" font-size="12">Offline</text></svg>',
              { headers: { "Content-Type": "image/svg+xml" } }
            );
          });
      })
    );
    return;
  }

  // 3. Static Assets: CSS, JS bundles, Web Fonts, Webmanifest
  const isStaticAsset =
    event.request.destination === "style" ||
    event.request.destination === "script" ||
    event.request.destination === "font" ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname === "/manifest.webmanifest";

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            return new Response("", { status: 503, statusText: "Offline Asset Unavailable" });
          });
      })
    );
    return;
  }

  // 4. HTML Page Navigations: Network-First with Self-Contained Offline Shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(async () => {
          return new Response(OFFLINE_HTML_SHELL, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
            status: 200,
          });
        })
    );
    return;
  }
});

// Self-contained, zero-dependency offline app shell
const OFFLINE_HTML_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My Shelves (Offline) | GoodBetterBestReads</title>
  <style>
    :root {
      --bg: #09090b;
      --card: #18181b;
      --border: rgba(255, 255, 255, 0.1);
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --primary: #10b981;
      --amber: #f59e0b;
      --font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding-bottom: 40px;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(18, 18, 20, 0.8);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .brand {
      font-weight: 800;
      font-size: 16px;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge-offline {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .container {
      max-width: 1150px;
      margin: 0 auto;
      padding: 24px 20px;
      width: 100%;
    }
    .hero {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.03em;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .search-box {
      flex: 1;
      min-width: 260px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: var(--text);
      font-size: 14px;
      font-family: inherit;
    }
    .search-box:focus {
      outline: none;
      border-color: var(--primary);
    }
    .tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .tab-btn {
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .tab-btn.active {
      background: var(--text);
      color: #000;
      border-color: var(--text);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 16px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.15s;
    }
    .card:hover {
      transform: translateY(-2px);
    }
    .cover-box {
      aspect-ratio: 2 / 3;
      background: linear-gradient(135deg, #27272a 0%, #18181b 100%);
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      text-align: center;
    }
    .cover-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      position: absolute;
      top: 0;
      left: 0;
    }
    .spine-title {
      font-size: 13px;
      font-weight: 800;
      line-height: 1.3;
      color: #fff;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .badge-shelf {
      position: absolute;
      top: 8px;
      left: 8px;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: capitalize;
      z-index: 2;
    }
    .badge-shelf.read { background: #064e3b; color: #a7f3d0; border: 1px solid rgba(52,211,153,0.3); }
    .badge-shelf.to-read { background: #1e3a8a; color: #bfdbfe; border: 1px solid rgba(96,165,250,0.3); }
    .badge-shelf.currently-reading { background: #78350f; color: #fde68a; border: 1px solid rgba(251,191,36,0.3); }
    .card-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-author {
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-rating {
      font-size: 11px;
      color: var(--amber);
      font-weight: 700;
      margin-top: 4px;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
      font-size: 14px;
      grid-column: 1 / -1;
    }
    .btn-retry {
      background: var(--primary);
      color: #022c22;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
        <path d="M6 6h10"/>
        <path d="M6 10h10"/>
      </svg>
      <span>GoodBetterBestReads</span>
    </div>
    <div class="badge-offline">
      <span style="width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>
      <span>Offline Cache</span>
    </div>
  </header>

  <div class="container">
    <div class="hero">
      <h1>My Reading Shelves</h1>
      <p style="color: var(--text-muted); font-size: 13px;">
        Viewing <span id="total-count" style="font-weight: 700; color: #fff;">0</span> cached books stored on this device.
      </p>
    </div>

    <div class="controls">
      <input type="text" id="search-input" class="search-box" placeholder="Search title or author..." />
      <div class="tabs">
        <button class="tab-btn active" data-shelf="all">All</button>
        <button class="tab-btn" data-shelf="read">Read</button>
        <button class="tab-btn" data-shelf="to-read">Want to Read</button>
        <button class="tab-btn" data-shelf="currently-reading">Reading Now</button>
      </div>
    </div>

    <div id="books-grid" class="grid">
      <div class="empty-state">Loading cached shelves...</div>
    </div>
  </div>

  <script>
    (function() {
      var allBooks = [];
      var activeShelf = "all";
      var searchQuery = "";

      try {
        var raw = localStorage.getItem("gbbr_offline_library_v1");
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.books)) {
            allBooks = parsed.books;
          }
        }
      } catch (err) {
        console.warn("Could not read localStorage offline cache:", err);
      }

      var countEl = document.getElementById("total-count");
      var gridEl = document.getElementById("books-grid");
      var searchInput = document.getElementById("search-input");
      var tabs = document.querySelectorAll(".tab-btn");

      function render() {
        var filtered = allBooks.filter(function(b) {
          if (activeShelf !== "all" && b.shelf !== activeShelf) {
            return false;
          }
          if (searchQuery) {
            var q = searchQuery.toLowerCase();
            var titleMatch = (b.title || "").toLowerCase().indexOf(q) !== -1;
            var authorMatch = (b.author || "").toLowerCase().indexOf(q) !== -1;
            if (!titleMatch && !authorMatch) return false;
          }
          return true;
        });

        if (countEl) countEl.innerText = filtered.length;

        if (filtered.length === 0) {
          gridEl.innerHTML = '<div class="empty-state">No books found matching this filter in your offline cache.</div>';
          return;
        }

        var html = filtered.map(function(b) {
          var shelfClass = b.shelf === "read" ? "read" : (b.shelf === "to-read" ? "to-read" : "currently-reading");
          var shelfLabel = b.shelf === "read" ? "Read" : (b.shelf === "to-read" ? "Want to Read" : "Reading");
          var ratingStr = b.rating ? ("★".repeat(b.rating) + " " + b.rating + ".0") : "";
          var coverHtml = b.cover_url
            ? '<img src="' + b.cover_url + '" alt="" onerror="this.style.display=\\'none\\'" />'
            : '';

          return '<div class="card">' +
            '<div class="cover-box">' +
              coverHtml +
              '<span class="badge-shelf ' + shelfClass + '">' + shelfLabel + '</span>' +
              '<div class="spine-title">' + (b.title || "Untitled") + '</div>' +
            '</div>' +
            '<div class="card-body">' +
              '<div class="card-title" title="' + (b.title || "") + '">' + (b.title || "Untitled") + '</div>' +
              '<div class="card-author">' + (b.author || "Unknown") + '</div>' +
              (ratingStr ? '<div class="card-rating">' + ratingStr + '</div>' : '') +
            '</div>' +
          '</div>';
        }).join("");

        gridEl.innerHTML = html;
      }

      if (searchInput) {
        searchInput.addEventListener("input", function(e) {
          searchQuery = e.target.value.trim();
          render();
        });
      }

      tabs.forEach(function(btn) {
        btn.addEventListener("click", function() {
          tabs.forEach(function(t) { t.classList.remove("active"); });
          btn.classList.add("active");
          activeShelf = btn.getAttribute("data-shelf") || "all";
          render();
        });
      });

      render();
    })();
  </script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// 5. Web Push & Reader Alerts (Phase 6, Issue #56)
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "TBRScout Alert",
    body: "You have a new reading notification.",
    icon: "/icon",
    badge: "/icon",
    data: { url: "/library" },
  };

  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data.text();
  }

  const title = payload.title || "TBRScout";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon",
    badge: payload.badge || "/icon",
    tag: payload.tag || "tbrscout-alert",
    renotify: true,
    data: payload.data || { url: "/library" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/library";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

