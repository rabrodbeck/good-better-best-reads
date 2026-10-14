"use client";

import * as React from "react";
import {
  Camera,
  X,
  AlertCircle,
  ScanLine,
  Upload,
  Keyboard,
  CheckCircle2,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractIsbnFromBarcodeText, isValidIsbn } from "@/lib/barcode";
import type { IScannerControls } from "@zxing/browser";

interface BarcodeScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (isbn: string) => void;
}

export function BarcodeScannerModal({
  open,
  onOpenChange,
  onScanSuccess,
}: BarcodeScannerModalProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const zxingControlsRef = React.useRef<IScannerControls | null>(null);

  const [hasCamera, setHasCamera] = React.useState<boolean>(true);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [manualIsbn, setManualIsbn] = React.useState("");
  const [manualError, setManualError] = React.useState<string | null>(null);

  // Stop camera tracks and scanner loop cleanly
  const stopCamera = React.useCallback(() => {
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
    setIsScanning(false);
  }, []);

  const handleBarcodeDetected = React.useCallback(
    (rawCode: string) => {
      const isbn = extractIsbnFromBarcodeText(rawCode);
      if (isbn) {
        // Haptic feedback if supported
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(100);
          } catch {}
        }
        stopCamera();
        onOpenChange(false);
        onScanSuccess(isbn);
      }
    },
    [onOpenChange, onScanSuccess, stopCamera]
  );

  // Start video stream and ZXing scanner when modal opens
  const startCamera = React.useCallback(async () => {
    setCameraError(null);
    setManualError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsScanning(true);

      // Dynamically import ZXing to avoid any SSR issues
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
      hints.set(DecodeHintType.TRY_HARDER, true);

      const codeReader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 200,
      });

      if (videoRef.current) {
        const controls = await codeReader.decodeFromVideoElement(
          videoRef.current,
          (result, error, controls) => {
            if (result) {
              const text = result.getText();
              const isbn = extractIsbnFromBarcodeText(text);
              if (isbn) {
                try {
                  controls.stop();
                } catch {}
                handleBarcodeDetected(isbn);
              }
            }
          }
        );
        zxingControlsRef.current = controls;
      }
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      setHasCamera(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError(
          "Camera permission was denied. Please allow camera access in your browser settings or enter the ISBN manually."
        );
      } else {
        setCameraError(
          "Could not connect to camera device. You can upload a photo of the barcode or type the ISBN below."
        );
      }
    }
  }, [handleBarcodeDetected]);

  React.useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  // Fallback: image file upload scanner using ZXing
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      hints.set(DecodeHintType.TRY_HARDER, true);

      const codeReader = new BrowserMultiFormatReader(hints);
      const imgUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = imgUrl;

      img.onload = async () => {
        try {
          const result = await codeReader.decodeFromImageElement(img);
          URL.revokeObjectURL(imgUrl);
          if (result) {
            const isbn = extractIsbnFromBarcodeText(result.getText());
            if (isbn) {
              handleBarcodeDetected(isbn);
              return;
            }
          }
          setManualError("No valid book barcode found in this photo. Try typing the ISBN below.");
        } catch {
          URL.revokeObjectURL(imgUrl);
          setManualError("Could not detect barcode in photo. Please ensure it is well lit or enter manually.");
        }
      };
    } catch (err) {
      console.error("Barcode photo detection error:", err);
      setManualError("Could not process photo. Please enter the ISBN manually.");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualIsbn.replace(/[-\s]/g, "").trim();
    if (!isValidIsbn(clean)) {
      setManualError("Please enter a valid 10 or 13-digit ISBN number.");
      return;
    }
    stopCamera();
    onOpenChange(false);
    onScanSuccess(clean);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <ScanLine className="size-5 text-primary" />
            <span>Scan Book Barcode</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Point your camera at the ISBN barcode on the back cover of any physical book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video Viewport / Reticle */}
          {hasCamera && !cameraError ? (
            <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-black border border-border/60 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted
              />

              {/* Viewfinder Reticle Overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="relative w-4/5 h-3/5 rounded-xl border-2 border-primary/80 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center">
                  {/* Corner Accent notches */}
                  <div className="absolute -top-1 -left-1 size-4 border-t-2 border-l-2 border-primary" />
                  <div className="absolute -top-1 -right-1 size-4 border-t-2 border-r-2 border-primary" />
                  <div className="absolute -bottom-1 -left-1 size-4 border-b-2 border-l-2 border-primary" />
                  <div className="absolute -bottom-1 -right-1 size-4 border-b-2 border-r-2 border-primary" />

                  {/* Animated Scanning Laser Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-[0_0_8px_#34d399]" />
                </div>
              </div>

              {/* Bottom Guidance Pill */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-[11px] font-medium text-white flex items-center gap-1.5 pointer-events-none">
                <Zap className="size-3 text-emerald-400" />
                <span>Center barcode inside the box</span>
              </div>
            </div>
          ) : (
            /* Camera unavailable / error state */
            <div className="p-4 rounded-xl border border-border/60 bg-muted/30 text-center space-y-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 mx-auto">
                <Camera className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Camera Unavailable</p>
                <p className="text-[11px] text-muted-foreground">{cameraError}</p>
              </div>

              {/* Photo Upload Option */}
              <label className="inline-flex items-center gap-2 cursor-pointer bg-card hover:bg-muted border border-border/80 px-3 py-2 rounded-lg text-xs font-medium text-foreground transition-colors">
                <Upload className="size-3.5 text-primary" />
                <span>Upload Barcode Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>
          )}

          {/* Quick Manual Entry Fallback */}
          <div className="pt-2 border-t border-border/40">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Keyboard className="size-3" />
              <span>Or enter 10 or 13-digit ISBN manually:</span>
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                placeholder="e.g. 9781638935995"
                value={manualIsbn}
                onChange={(e) => {
                  setManualIsbn(e.target.value);
                  setManualError(null);
                }}
                className="h-9 text-xs font-mono"
              />
              <Button type="submit" size="sm" className="h-9 px-3 shrink-0 font-semibold text-xs">
                Look Up
              </Button>
            </form>
            {manualError && (
              <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="size-3" />
                <span>{manualError}</span>
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
