"use client";

import * as React from "react";
import {
  Download,
  FileSpreadsheet,
  FileCode,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalBooks: number;
  onExportSuccess?: (format: "csv" | "json") => void;
}

export function ExportModal({
  open,
  onOpenChange,
  totalBooks,
  onExportSuccess,
}: ExportModalProps) {
  const [downloadingFormat, setDownloadingFormat] = React.useState<"csv" | "json" | null>(null);

  const handleDownload = async (format: "csv" | "json") => {
    setDownloadingFormat(format);
    try {
      const res = await fetch(`/api/library/export?format=${format}`);
      if (!res.ok) throw new Error("Failed to generate export file");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `goodbetterbestreads-library-${dateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onExportSuccess?.(format);
      onOpenChange(false);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-primary/40 text-primary text-[11px] gap-1">
              <Download className="size-3" />
              Data Portability
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {totalBooks} Titles in Library
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Export Your Reading Library
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Download your catalog and ratings at any time. Choose the format that fits your needs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 pt-2">
          {/* CSV Export Option */}
          <div
            onClick={() => !downloadingFormat && handleDownload("csv")}
            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-card/40 hover:bg-card/90 hover:border-primary/50 transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    Standard CSV File
                  </h4>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    Goodreads & StoryGraph
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Export titles, authors, ISBNs, shelf placements, ratings, and read dates. Ready to import directly into Goodreads or StoryGraph.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              disabled={downloadingFormat !== null}
              className="shrink-0 text-xs font-semibold gap-1.5 w-full sm:w-auto"
            >
              {downloadingFormat === "csv" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  <span>Download .csv</span>
                </>
              )}
            </Button>
          </div>

          {/* JSON Export Option */}
          <div
            onClick={() => !downloadingFormat && handleDownload("json")}
            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-card/40 hover:bg-card/90 hover:border-primary/50 transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <FileCode className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    Complete JSON Archive
                  </h4>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-500/30 text-blue-400 bg-blue-500/10">
                    Full Backup + Taste DNA
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Rich JSON backup with your complete book records, review notes, and your holistic AI Reading Taste Archetype & tropes.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              disabled={downloadingFormat !== null}
              className="shrink-0 text-xs font-semibold gap-1.5 w-full sm:w-auto group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            >
              {downloadingFormat === "json" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  <span>Download .json</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span>Instant client-side export</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
