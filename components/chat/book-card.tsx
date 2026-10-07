"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOff, Calendar, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BookCardProps {
  title: string;
  author: string;
  coverUrl?: string | null;
  publishedYear?: number | null;
  pageCount?: number | null;
  rationale?: string;
}

export function BookCard({
  title,
  author,
  coverUrl,
  publishedYear,
  pageCount,
  rationale,
}: BookCardProps) {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [coverUrl]);

  const optimizedCoverUrl = React.useMemo(() => {
    if (!coverUrl) return null;
    return coverUrl.replace(/-M\.jpg(\?.*)?$/, "-L.jpg$1");
  }, [coverUrl]);

  // Speculative ISBN fallbacks bypass Next.js image proxy to prevent 404 upstream error logs
  const isSpeculativeIsbn = optimizedCoverUrl?.includes("/b/isbn/") ?? false;

  return (
    <Card className="my-3 overflow-hidden border-primary/20 bg-card/60 backdrop-blur-xs transition-all hover:border-primary/40">
      <CardContent className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Cover Image or Fallback */}
        <div className="relative h-44 w-30 shrink-0 overflow-hidden rounded-lg bg-muted/60 border border-border/60 shadow-xs flex items-center justify-center">
          {optimizedCoverUrl && !imgError ? (
            <Image
              src={optimizedCoverUrl}
              alt={`Cover of ${title}`}
              fill
              className="object-cover"
              sizes="120px"
              unoptimized={isSpeculativeIsbn}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="relative p-2.5 text-center flex flex-col items-center justify-between h-full w-full bg-gradient-to-br from-card via-muted/50 to-card/90 select-none overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-r from-border/80 via-primary/30 to-transparent pointer-events-none" />
              <div className="w-full pt-1">
                <span className="text-[8px] font-mono tracking-widest text-muted-foreground/60 uppercase">
                  GoodBetterBest
                </span>
              </div>
              <div className="my-auto px-1">
                <span className="text-[11px] font-bold text-foreground leading-tight line-clamp-2">
                  {title}
                </span>
                <div className="w-4 h-px bg-primary/40 mx-auto my-1.5" />
                <span className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">
                  {author}
                </span>
              </div>
              <div className="w-full pb-0.5 flex items-center justify-center">
                <ImageOff className="size-3 text-muted-foreground/40" />
              </div>
            </div>
          )}
        </div>

        {/* Book Information */}
        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] gap-1 py-0">
                <CheckCircle2 className="size-3" />
                Librarian Pick
              </Badge>
              {publishedYear && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3" /> {publishedYear}
                </span>
              )}
              {pageCount && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="size-3" /> {pageCount} pages
                </span>
              )}
            </div>

            <h4 className="text-base font-bold text-foreground leading-snug line-clamp-2">
              {title}
            </h4>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              by {author}
            </p>

            {rationale && (
              <p className="text-xs text-muted-foreground/90 mt-2.5 bg-muted/40 p-2.5 rounded-lg border border-border/40 italic">
                &ldquo;{rationale}&rdquo;
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}