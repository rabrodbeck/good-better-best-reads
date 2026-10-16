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

  const [hasCamera, setHasCamera] = React.useState<boolean>(true);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [manualIsbn, setManualIsbn] = React.useState("");
  const [manualError, setManualError] = React.useState<string | null>(null);
  const [showManualInput, setShowManualInput] = React.useState(false);

  // Stop camera tracks cleanly
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
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(120);
          } catch {}
        }
        stopCamera();
        onScanSuccess(isbn);
      }
    },
    [onScanSuccess, stopCamera]
  );

  // Start camera stream and ZXing reader
  const startCamera = React.useCallback(async () => {
    setCameraError(null);
    setManualError(null);

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsScanning(true);

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

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 80,
      });

      if (videoRef.current) {
        const controls = await reader.decodeFromVideoElement(
          videoRef.current,
          (result, error) => {
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

        {/* Viewfinder Target Overlays */}
        {isScanning && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
            <div className="relative w-4/5 h-3/5 max-w-xs border-2 border-primary/60 rounded-xl shadow-lg flex items-center justify-center overflow-hidden">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 size-4 border-t-4 border-l-4 border-primary rounded-tl-sm" />
              <div className="absolute top-0 right-0 size-4 border-t-4 border-r-4 border-primary rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 size-4 border-b-4 border-l-4 border-primary rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 size-4 border-b-4 border-r-4 border-primary rounded-br-sm" />

              {/* Laser Scan Animation */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_#f43f5e] animate-pulse" />

              <div className="absolute bottom-2 text-center text-[10px] text-white/90 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full font-mono tracking-wider">
                Align ISBN barcode
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
