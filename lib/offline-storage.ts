/**
 * Offline Storage & Cache Hydration Engine (Issue #45)
 * Caches library books and stats in browser storage for instant offline access.
 */

const OFFLINE_LIBRARY_KEY = "gbbr_offline_library_v1";

export interface CachedLibraryPayload<T = any> {
  books: T[];
  stats: any | null;
  timestamp: number;
}

export function isDeviceOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return !navigator.onLine;
}

export function saveOfflineLibrary<T = any>(books: T[], stats?: any): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const payload: CachedLibraryPayload<T> = {
      books,
      stats: stats || null,
      timestamp: Date.now(),
    };
    localStorage.setItem(OFFLINE_LIBRARY_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn("Could not save offline library cache (storage full?):", err);
    return false;
  }
}

export function getOfflineLibrary<T = any>(): CachedLibraryPayload<T> | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(OFFLINE_LIBRARY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLibraryPayload<T>;
    if (!parsed || !Array.isArray(parsed.books)) return null;
    return parsed;
  } catch (err) {
    console.warn("Could not read offline library cache:", err);
    return null;
  }
}

export function clearOfflineLibrary(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(OFFLINE_LIBRARY_KEY);
  } catch {}
}
