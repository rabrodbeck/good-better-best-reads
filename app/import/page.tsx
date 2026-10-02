"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileCheck,
  Sparkles,
  Database,
  ArrowRight,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type ImportStatus = "idle" | "parsing" | "analyzing" | "saving" | "complete" | "error";

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<ImportStatus>("idle");
  const [progress, setProgress] = React.useState(0);
  const [statusMessage, setStatusMessage] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [importedProfile, setImportedProfile] = React.useState<{
    archetype_name: string;
    archetype_summary: string;
    preferred_pacing: string;
  } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
        setErrorMessage(null);
      } else {
        setErrorMessage("Please drop a valid .csv file from Goodreads or StoryGraph.");
      }
    }
  };

  const handleStartImport = async () => {
    if (!file) return;

    setStatus("parsing");
    setProgress(20);
    setStatusMessage("Parsing books and sanitizing reading history...");
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setStatus("analyzing");
      setProgress(50);
      setStatusMessage("Gemini 2.5 Flash is analyzing your Reading DNA...");

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to process import");
      }

      setStatus("saving");
      setProgress(85);
      setStatusMessage("Generating 768-dim taste vector and syncing catalog to Supabase...");

      // Short aesthetic delay to let the user see the saving progress
      await new Promise((resolve) => setTimeout(resolve, 600));

      setProgress(100);
      setStatus("complete");
      setStatusMessage("Import complete! Your Personal Librarian is initialized.");
      setImportedProfile(data.tasteProfile);
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
    }
  };

  return (
    <div className="container mx-auto flex max-w-3xl flex-col items-center px-4 py-12 sm:py-16">
      {/* Title Header */}
      <div className="text-center mb-8">
        <Badge variant="secondary" className="mb-3 text-xs gap-1.5 py-1 px-3">
          <BookOpen className="size-3.5 text-primary" />
          <span>Zero Cold-Start Taste Extraction</span>
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Import Your Reading History
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-lg">
          Drop your Goodreads or StoryGraph export to instantly extract your Reading DNA and unlock your Personal Librarian.
        </p>
      </div>

      {/* Main Upload Card */}
      <Card className="w-full border-border/60 bg-card/60 backdrop-blur-xs shadow-lg">
        <CardContent className="p-6 sm:p-8">
          {status === "complete" && importedProfile ? (
            /* Success State */
            <div className="flex flex-col items-center text-center py-6 animate-in fade-in-50 zoom-in-95">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 mb-4 border border-emerald-500/20">
                <Sparkles className="size-7" />
              </div>
              <Badge variant="outline" className="mb-2 text-emerald-500 border-emerald-500/30 text-xs">
                Taste DNA Extracted
              </Badge>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {importedProfile.archetype_name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4 font-mono">
                Pacing: {importedProfile.preferred_pacing}
              </p>
              <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
                {importedProfile.archetype_summary}
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={() => router.push("/chat")} size="lg" className="gap-2 font-semibold">
                  <span>Talk to Personal Librarian</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            /* Upload / Ingestion State */
            <div>
              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all cursor-pointer ${
                  file
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/80 hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-4">
                  {file ? (
                    <FileCheck className="size-6 text-primary" />
                  ) : (
                    <UploadCloud className="size-6" />
                  )}
                </div>

                {file ? (
                  <div>
                    <span className="font-semibold text-foreground text-sm">
                      {file.name}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(1)} KB &bull; Click or drag to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold text-foreground text-sm">
                      Click to choose a file or drag and drop
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Goodreads export (.csv) or StoryGraph (.csv)
                    </p>
                  </div>
                )}
              </div>

              {/* Progress Bar (during active ingestion) */}
              {status !== "idle" && status !== "error" && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground font-medium">
                    <span>{statusMessage}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit CTA */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleStartImport}
                  disabled={!file || status === "parsing" || status === "analyzing" || status === "saving"}
                  size="lg"
                  className="w-full sm:w-auto font-semibold gap-2"
                >
                  <Database className="size-4" />
                  <span>
                    {status === "idle" || status === "error"
                      ? "Analyze & Import Library"
                      : "Processing Library..."}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}