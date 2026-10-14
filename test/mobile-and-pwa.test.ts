import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanScannedBarcode,
  validateIsbn10,
  validateIsbn13,
  isValidIsbn,
  convertIsbn10To13,
  extractIsbnFromBarcodeText,
} from "@/lib/barcode";
import {
  shareContent,
  shareBook,
  shareReadingDna,
  shareLibrary,
} from "@/lib/share";
import {
  saveOfflineLibrary,
  getOfflineLibrary,
  clearOfflineLibrary,
  isDeviceOffline,
} from "@/lib/offline-storage";

describe("Phase 5: Mobile & Native PWA Polish", () => {
  describe("Barcode & ISBN Parsing Engine (Issue #43)", () => {
    it("cleans hyphens and extraneous whitespace from scanned barcodes", () => {
      expect(cleanScannedBarcode(" 978-0-441-01359-3 ")).toBe("9780441013593");
      expect(cleanScannedBarcode("0-441-01359-7")).toBe("0441013597");
      expect(cleanScannedBarcode("")).toBe("");
    });

    it("validates 10-digit ISBN numbers with numeric and X checksums", () => {
      // Valid ISBN-10s
      expect(validateIsbn10("0441013597")).toBe(true);
      expect(validateIsbn10("0-441-01359-7")).toBe(true);
      expect(validateIsbn10("080442957X")).toBe(true); // 'X' check digit (10)
      expect(validateIsbn10("0-8044-2957-X")).toBe(true);

      // Invalid ISBN-10s
      expect(validateIsbn10("0441013598")).toBe(false); // wrong check digit
      expect(validateIsbn10("12345")).toBe(false); // wrong length
      expect(validateIsbn10("080442957Y")).toBe(false); // invalid character
    });

    it("validates 13-digit EAN/ISBN numbers using mod 10 alternating weights", () => {
      // Valid ISBN-13s
      expect(validateIsbn13("9780441013593")).toBe(true);
      expect(validateIsbn13("978-0-441-01359-3")).toBe(true);
      expect(validateIsbn13("9780143127741")).toBe(true);
      expect(validateIsbn13("9780385547345")).toBe(true);

      // Invalid ISBN-13s
      expect(validateIsbn13("9780441013594")).toBe(false); // wrong check digit
      expect(validateIsbn13("97804410135")).toBe(false); // too short
      expect(validateIsbn13("978044101359300")).toBe(false); // too long
    });

    it("evaluates general isValidIsbn across both formats", () => {
      expect(isValidIsbn("9780441013593")).toBe(true);
      expect(isValidIsbn("0441013597")).toBe(true);
      expect(isValidIsbn("invalid-isbn")).toBe(false);
      expect(isValidIsbn("1234567890")).toBe(false);
    });

    it("converts 10-digit ISBN into equivalent 13-digit EAN barcode format", () => {
      expect(convertIsbn10To13("0441013597")).toBe("9780441013593");
      expect(convertIsbn10To13("080442957X")).toBe("9780804429573");
      expect(convertIsbn10To13("invalid")).toBeNull();
    });

    it("extracts ISBN when embedded in raw barcode scanner scan text", () => {
      expect(extractIsbnFromBarcodeText("ISBN 978-0-441-01359-3 Book")).toBe("9780441013593");
      expect(extractIsbnFromBarcodeText("BARCODE: 0-441-01359-7 EAN")).toBe("0441013597");
      expect(extractIsbnFromBarcodeText("9780143127741")).toBe("9780143127741");
      expect(extractIsbnFromBarcodeText("978163893599551800")).toBe("9781638935995"); // EAN-13 + EAN-5 addon
      expect(extractIsbnFromBarcodeText("NO_BARCODE_HERE")).toBeNull();
    });
  });

  describe("Native Web Share API Integration (Issue #44)", () => {
    const originalNavigator = global.navigator;

    beforeEach(() => {
      // Mock navigator.clipboard
      Object.defineProperty(global, "navigator", {
        value: {
          share: vi.fn(),
          clipboard: {
            writeText: vi.fn().mockResolvedValue(undefined),
          },
        },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it("uses native navigator.share when available", async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      (global.navigator as any).share = shareMock;

      const result = await shareContent({
        title: "Dune by Frank Herbert",
        text: "Check out Dune!",
        url: "/library?book=123",
      });

      expect(shareMock).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.method).toBe("native");
    });

    it("handles user dismissing native share sheet without reporting failure", async () => {
      const abortError = new Error("User cancelled");
      abortError.name = "AbortError";
      const shareMock = vi.fn().mockRejectedValue(abortError);
      (global.navigator as any).share = shareMock;

      const result = await shareContent({
        title: "Dune",
        text: "Check out Dune!",
        url: "/library?book=123",
      });

      expect(result.success).toBe(false);
      expect(result.method).toBe("none");
      expect(result.message).toContain("cancelled");
    });

    it("falls back to clipboard copy when navigator.share is unavailable", async () => {
      // Remove share method to simulate desktop browser without Web Share API
      delete (global.navigator as any).share;

      const result = await shareBook({
        title: "Project Hail Mary",
        author: "Andy Weir",
        book_id: "book-phm",
      });

      expect(global.navigator.clipboard.writeText).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.method).toBe("clipboard");
      expect(result.message).toContain("copied to clipboard");
    });

    it("generates correct Reading DNA share payload", async () => {
      delete (global.navigator as any).share;

      const result = await shareReadingDna({
        archetype_name: "The Cosmic Voyager",
        user_id: "usr-42",
      });

      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/dna?user=usr-42")
      );
      expect(result.success).toBe(true);
    });
  });

  describe("Offline Library Caching & Storage Engine (Issue #45)", () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      const storageMock = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        }),
      };

      Object.defineProperty(global, "window", {
        value: { localStorage: storageMock },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, "localStorage", {
        value: storageMock,
        writable: true,
        configurable: true,
      });
    });

    it("saves and retrieves library books and stats from offline storage", () => {
      const mockBooks = [
        { id: "1", title: "Dune", author: "Frank Herbert", shelf: "read" },
        { id: "2", title: "Neuromancer", author: "William Gibson", shelf: "to-read" },
      ];
      const mockStats = { total: 2, read: 1 };

      const saved = saveOfflineLibrary(mockBooks, mockStats);
      expect(saved).toBe(true);

      const cached = getOfflineLibrary();
      expect(cached).not.toBeNull();
      expect(cached?.books.length).toBe(2);
      expect(cached?.books[0].title).toBe("Dune");
      expect(cached?.stats.total).toBe(2);
      expect(cached?.timestamp).toBeGreaterThan(0);
    });

    it("returns null when offline cache is empty or corrupted", () => {
      expect(getOfflineLibrary()).toBeNull();

      localStorage.setItem("gbbr_offline_library_v1", "invalid-json{");
      expect(getOfflineLibrary()).toBeNull();
    });

    it("clears offline storage cache on demand", () => {
      saveOfflineLibrary([{ id: "1", title: "Dune" }]);
      expect(getOfflineLibrary()).not.toBeNull();

      clearOfflineLibrary();
      expect(getOfflineLibrary()).toBeNull();
    });

    it("reports device offline status accurately", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });
      expect(isDeviceOffline()).toBe(true);

      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });
      expect(isDeviceOffline()).toBe(false);
    });
  });
});
