"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Mail,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  Loader2,
  Share2,
} from "lucide-react";

interface AddFriendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFriendAdded?: () => void;
}

export function AddFriendModal({
  open,
  onOpenChange,
  onFriendAdded,
}: AddFriendModalProps) {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successResult, setSuccessResult] = React.useState<{
    type: "request_sent" | "auto_accepted" | "invite_created";
    message: string;
    inviteUrl?: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setEmail("");
      setError(null);
      setSuccessResult(null);
      setCopied(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessResult(null);

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to send friend request");
      }

      setSuccessResult({
        type: data.type,
        message: data.message,
        inviteUrl: data.inviteUrl,
      });

      setEmail("");
      if (onFriendAdded) {
        onFriendAdded();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!successResult?.inviteUrl) return;
    navigator.clipboard.writeText(successResult.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/80">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="size-4" />
            </div>
            <DialogTitle className="text-xl font-bold">Add Reading Buddy</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect with friends to browse their shelves, compare your Reading DNA, and discover mutual book recommendations.
          </DialogDescription>
        </DialogHeader>

        {successResult ? (
          <div className="space-y-4 py-2 animate-in fade-in-50 zoom-in-95">
            {successResult.type === "invite_created" ? (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <Share2 className="size-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Invite Link Generated</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {successResult.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    readOnly
                    value={successResult.inviteUrl || ""}
                    className="h-9 text-xs bg-muted/60 font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyLink}
                    className="h-9 gap-1.5 shrink-0 font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground/80 italic">
                  This invite link remains active for 14 days.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Check className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {successResult.type === "auto_accepted" ? "Connected as Friends!" : "Request Sent!"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{successResult.message}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSuccessResult(null)}
              >
                Add Another
              </Button>
              <Button
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                <span>Friend&apos;s Email</span>
              </label>
              <Input
                type="email"
                required
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-sm"
                disabled={loading}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                If they are already registered, we&apos;ll send an in-app request. If not, we&apos;ll generate an invite link for you to share!
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !email.trim()}
                className="gap-2 font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    <span>Send Request</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
