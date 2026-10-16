"use client";

import * as React from "react";
import {
  Camera,
  AlertCircle,
  Upload,
  Keyboard,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractIsbnFromBarcodeText, isValidIsbn } from "@/lib/barcode";
import type { IScannerControls } from "@zxing/browser";

interface BarcodeScannerViewProps {
  onScanSuccess: (isbn: string) => void;
  active?: boolean;
}

export function BarcodeScannerView({
  onScanSuccess,
  active = true,
}: BarcodeScannerViewProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const zxingControlsRef = React.useRef<IScannerControls | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const nativeDetectorStopRef = React.useRef<(() => void) | null>(null);

  const [hasCamera, setHasCamera] = React.useState<boolean>(true);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [barcodeLocked, setBarcodeLocked] = React.useState(false);
  const [hasTorch, setHasTorch] = React.useState(false);
  const [torchOn, setTorchOn] = React.useState(false);
  const [manualIsbn, setManualIsbn] = React.useState("");
  const [manualError, setManualError] = React.useState<string | null>(null);
  const [showManualInput, setShowManualInput] = React.useState(false);

  // Synthesize positive audio feedback chime (880Hz -> 1320Hz)
  const playScanChime = React.useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = React.useCallback(() => {
    if (nativeDetectorStopRef.current) {
      try {
        nativeDetectorStopRef.current();
      } catch {}
      nativeDetectorStopRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {}
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setHasTorch(false);
    setIsScanning(false);
  }, []);

  const toggleTorch = React.useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn("Could not toggle camera torch:", err);
    }
  }, [torchOn]);

  const handleBarcodeDetected = React.useCallback(
    (rawCode: string) => {
      const isbn = extractIsbnFromBarcodeText(rawCode);
      if (isbn) {
        setBarcodeLocked(true);
        playScanChime();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate([40, 30, 40]);
          } catch {}
        }
        stopCamera();
        onScanSuccess(isbn);
      }
    },
    [onScanSuccess, stopCamera, playScanChime]
  );

  // Start camera stream and high-performance native BarcodeDetector / ZXing reader
  const startCamera = React.useCallback(async () => {
    setCameraError(null);
    setManualError(null);
    setBarcodeLocked(false);
    setTorchOn(false);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setHasCamera(false);
      setCameraError("Camera access is not supported by your current browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // rear camera preferred on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Check hardware torch support
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof (videoTrack as any).getCapabilities === "function") {
        try {
          const caps = (videoTrack as any).getCapabilities();
          if (caps && Boolean(caps.torch)) {
            setHasTorch(true);
          }
        } catch {}
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsScanning(true);

      // 1. FAST-PATH: Native iOS 17+ / Android Chrome BarcodeDetector (hardware Apple Vision Engine)
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const nativeDetector = new (window as any).BarcodeDetector({
            formats: ["ean_13", "upc_a", "ean_8"],
          });

          let stopped = false;
          nativeDetectorStopRef.current = () => {
            stopped = true;
          };

          const scanNativeLoop = async () => {
            if (stopped || !videoRef.current) return;
            if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              try {
                const barcodes = await nativeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  for (const bc of barcodes) {
                    const isbn = extractIsbnFromBarcodeText(bc.rawValue);
                    if (isbn) {
                      handleBarcodeDetected(isbn);
                      return;
                    }
                  }
                }
              } catch {}
            }
            if (!stopped) {
              requestAnimationFrame(scanNativeLoop);
            }
          };

          requestAnimationFrame(scanNativeLoop);
          return;
        } catch (nativeErr) {
          console.warn("Native BarcodeDetector fallback to ZXing:", nativeErr);
        }
      }

      // 2. High-Efficiency ZXing Fallback (Restricted strictly to Bookland EAN-13 & retail barcodes)
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.UPC_A,
        BarcodeFormat.EAN_8,
      ]);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 40,
      });

      if (videoRef.current) {
        const controls = await reader.decodeFromVideoElement(
          videoRef.current,
          (result) => {
            if (result) {
              const text = result.getText();
              const isbn = extractIsbnFromBarcodeText(text);
              if (isbn) {
                handleBarcodeDetected(isbn);
              }
            }
          }
        );
        zxingControlsRef.current = controls;
      }
    } catch (err: any) {
      console.warn("Camera start warning:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission was denied. You can allow camera access in your browser settings, upload a photo, or enter the ISBN below."
          : "Could not connect to camera device. You can upload a photo of the barcode or type the ISBN below."
      );
      setIsScanning(false);
    }
  }, [handleBarcodeDetected]);

  // Photo upload detection fallback
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setManualError(null);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ]);

      const reader = new BrowserMultiFormatReader(hints);
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = imageUrl;

      img.onload = async () => {
        try {
          const result = await reader.decodeFromImageElement(img);
          URL.revokeObjectURL(imageUrl);
          if (result) {
            const isbn = extractIsbnFromBarcodeText(result.getText());
            if (isbn) {
              handleBarcodeDetected(isbn);
              return;
            }
          }
          setManualError("No valid book barcode found in this photo. Try typing the ISBN below.");
        } catch {
          URL.revokeObjectURL(imageUrl);
          setManualError("Could not detect barcode in photo. Please ensure it is well lit or enter manually.");
        }
      };
    } catch (err) {
      console.error("Barcode photo detection error:", err);
      setManualError("Failed to parse image. Please type the ISBN manually.");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const cleaned = extractIsbnFromBarcodeText(manualIsbn);
    if (!cleaned || !isValidIsbn(cleaned)) {
      setManualError("Please enter a valid 10-digit or 13-digit ISBN (e.g. 9780441013593)");
      return;
    }
    handleBarcodeDetected(cleaned);
  };

  // Mount/unmount lifecycle
  React.useEffect(() => {
    if (active) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [active, startCamera, stopCamera]);

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      {/* Viewfinder Frame */}
      <div className="relative w-full aspect-4/3 sm:aspect-16/10 rounded-2xl overflow-hidden bg-black/95 shadow-2xl border border-border/40">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Flashlight / Torch Toggle */}
        {hasTorch && isScanning && !cameraError && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`absolute top-3 right-3 z-30 flex size-9 items-center justify-center rounded-full backdrop-blur-md transition-all shadow-md ${
              torchOn
                ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300 scale-105"
                : "bg-black/60 text-white/90 hover:text-white hover:bg-black/80"
            }`}
            title={torchOn ? "Turn off flashlight" : "Turn on flashlight for dark bookstore aisles"}
            aria-label="Toggle flashlight"
          >
            <Zap className={`size-4 ${torchOn ? "fill-amber-950" : ""}`} />
          </button>
        )}

        {/* Viewfinder Target Overlays */}
        {isScanning && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
            <div
              className={`relative w-4/5 h-3/5 max-w-xs border-2 rounded-xl shadow-lg flex items-center justify-center overflow-hidden transition-all duration-200 ${
                barcodeLocked
                  ? "border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.6)] scale-[1.02]"
                  : "border-primary/60"
              }`}
            >
              {/* Corner brackets */}
              <div
                className={`absolute top-0 left-0 size-4 border-t-4 border-l-4 rounded-tl-sm transition-colors ${
                  barcodeLocked ? "border-emerald-400" : "border-primary"
                }`}
              />
              <div
                className={`absolute top-0 right-0 size-4 border-t-4 border-r-4 rounded-tr-sm transition-colors ${
                  barcodeLocked ? "border-emerald-400" : "border-primary"
                }`}
              />
              <div
                className={`absolute bottom-0 left-0 size-4 border-b-4 border-l-4 rounded-bl-sm transition-colors ${
                  barcodeLocked ? "border-emerald-400" : "border-primary"
                }`}
              />
              <div
                className={`absolute bottom-0 right-0 size-4 border-b-4 border-r-4 rounded-br-sm transition-colors ${
                  barcodeLocked ? "border-emerald-400" : "border-primary"
                }`}
              />

              {/* Laser Scan Animation */}
              <div
                className={`w-full h-0.5 animate-pulse transition-all ${
                  barcodeLocked
                    ? "bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_16px_#10b981]"
                    : "bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_#f43f5e]"
                }`}
              />

              <div
                className={`absolute bottom-2 text-center text-[10px] px-2.5 py-0.5 rounded-full font-mono tracking-wider transition-colors ${
                  barcodeLocked
                    ? "text-emerald-300 bg-emerald-950/80 border border-emerald-500/40"
                    : "text-white/90 bg-black/60 backdrop-blur-xs"
                }`}
              >
                {barcodeLocked ? "Barcode Detected ✓" : "Align ISBN barcode"}
              </div>
            </div>
          </div>
        )}

        {/* Camera Error / Permission Fallback */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-card/95 backdrop-blur-md">
            <AlertCircle className="size-10 text-amber-500 mb-3" />
            <h4 className="text-sm font-bold text-foreground">Camera Unavailable</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{cameraError}</p>
            <div className="flex items-center gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={startCamera} className="text-xs gap-1.5">
                <RotateCcw className="size-3.5" />
                <span>Retry Camera</span>
              </Button>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs gap-1.5"
              >
                <Upload className="size-3.5" />
                <span>Upload Photo</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Input for Gallery Photo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Manual Input & Upload Controls */}
      <div className="w-full mt-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
          >
            <Upload className="size-3.5 text-primary" />
            <span>Upload barcode photo</span>
          </button>

          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium"
          >
            <Keyboard className="size-3.5 text-primary" />
            <span>{showManualInput ? "Hide manual entry" : "Type ISBN manually"}</span>
          </button>
        </div>

        {/* Manual ISBN Form */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="flex gap-2 animate-in fade-in duration-200">
            <Input
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              placeholder="e.g. 9780441013593"
              className="h-10 text-xs font-mono"
              autoFocus
            />
            <Button type="submit" size="sm" className="h-10 text-xs px-4 font-semibold">
              Check
            </Button>
          </form>
        )}

        {manualError && (
          <p className="text-xs text-rose-500 font-medium text-center animate-in fade-in">
            {manualError}
          </p>
        )}
      </div>
    </div>
  );
}
