"use client";

import Image from "next/image";
import { BookOpen, Calendar, FileText, CheckCircle2 } from "lucide-react";
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
  return (
    <Card className="my-3 overflow-hidden border-primary/20 bg-card/60 backdrop-blur-xs transition-all hover:border-primary/40">
      <CardContent className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Cover Image or Fallback */}
        <div className="relative h-44 w-30 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/60 shadow-xs flex items-center justify-center">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`Cover of ${title}`}
              fill
              className="object-cover"
              sizes="120px"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-2 text-center text-muted-foreground">
              <BookOpen className="size-6 mb-1 opacity-50" />
              <span className="text-[10px] font-medium leading-tight line-clamp-2">
                {title}
              </span>
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