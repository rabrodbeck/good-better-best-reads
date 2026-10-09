"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Sparkles,
  BookOpen,
  Clock,
  Check,
  X,
  Share2,
  Copy,
  Trash2,
  Loader2,
  BookMarked,
  Inbox,
  Send,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddFriendModal } from "@/components/friends/add-friend-modal";

interface FriendItem {
  friendshipId: string;
  friend: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    taste_archetype: string | null;
  };
  acceptedAt: string;
  currentlyReading: {
    title: string;
    author: string;
    cover_url: string | null;
  } | null;
}

interface PendingIncomingItem {
  id: string;
  requester: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    taste_archetype: string | null;
  };
  createdAt: string;
}

interface PendingOutgoingItem {
  id: string;
  addressee: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    taste_archetype: string | null;
  };
  createdAt: string;
}

interface InviteItem {
  id: string;
  email: string;
  invite_code: string;
  inviteUrl: string;
  created_at: string;
  expires_at: string;
}

export default function FriendsPage() {
  const [friends, setFriends] = React.useState<FriendItem[]>([]);
  const [pendingIncoming, setPendingIncoming] = React.useState<PendingIncomingItem[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = React.useState<PendingOutgoingItem[]>([]);
  const [pendingInvites, setPendingInvites] = React.useState<InviteItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"friends" | "requests" | "invites">("friends");

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const fetchFriendsData = React.useCallback(async () => {
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to load friends");
      const data = await res.json();
      setFriends(data.friends || []);
      setPendingIncoming(data.pendingIncoming || []);
      setPendingOutgoing(data.pendingOutgoing || []);
      setPendingInvites(data.pendingInvites || []);
    } catch (err) {
      console.error("Error loading friends:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchFriendsData();
  }, [fetchFriendsData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRespondRequest = async (requestId: string, action: "accept" | "decline") => {
    setActionLoadingId(requestId);
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      showToast(action === "accept" ? "Friend request accepted!" : "Friend request declined.");
      fetchFriendsData();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveFriendship = async (id: string, isCancel = false) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/friends/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove");

      showToast(isCancel ? "Friend request cancelled." : "Friend removed.");
      fetchFriendsData();
    } catch (err) {
      console.error(err);
      showToast("Action failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyLink = (url: string, code: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    showToast("Invite link copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="secondary" className="gap-1.5 text-xs py-0.5 px-2.5">
              <Users className="size-3 text-blue-400" />
              <span>Social Reading</span>
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Reading Buddies
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg">
            Connect with friends, explore their personal shelves, and compare your 768-dimensional Reading DNA.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="gap-2 font-semibold shadow-sm shrink-0"
        >
          <UserPlus className="size-4" />
          <span>Add Friend</span>
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 mb-6">
        <button
          onClick={() => setActiveTab("friends")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "friends"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Users className="size-3.5" />
          <span>Friends ({friends.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors relative ${
            activeTab === "requests"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Inbox className="size-3.5" />
          <span>Requests</span>
          {pendingIncoming.length > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              {pendingIncoming.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("invites")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "invites"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Share2 className="size-3.5" />
          <span>Active Invites ({pendingInvites.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary mb-3" />
          <span className="text-xs">Loading reading buddies...</span>
        </div>
      ) : activeTab === "friends" ? (
        /* Active Friends Tab */
        friends.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <Users className="size-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No reading buddies yet</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Add friends via email to see what they&apos;re currently reading, browse their shelves, and unlock your shared Taste Blend!
              </p>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                size="sm"
                className="mt-6 gap-2 font-medium"
              >
                <UserPlus className="size-3.5" />
                <span>Invite Your First Friend</span>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {friends.map((item) => {
              const { friend, currentlyReading } = item;
              return (
                <Card
                  key={item.friendshipId}
                  className="border-border/60 bg-card/70 backdrop-blur-xs shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
                >
                  <CardContent className="p-5">
                    {/* Top: Avatar, Name & Archetype */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative size-11 rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-border/50 shrink-0">
                          {friend.avatar_url ? (
                            <Image
                              src={friend.avatar_url}
                              alt={friend.display_name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <span>{friend.display_name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {friend.display_name}
                          </h4>
                          {friend.taste_archetype ? (
                            <Badge variant="outline" className="text-[10px] py-0 px-2 mt-1 truncate max-w-[190px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                              {friend.taste_archetype}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Reader</span>
                          )}
                        </div>
                      </div>

                      <button
                        title="Remove friend"
                        onClick={() => handleRemoveFriendship(item.friendshipId)}
                        disabled={actionLoadingId === item.friendshipId}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    {/* Currently Reading Snippet */}
                    <div className="rounded-xl border border-border/40 bg-muted/30 p-3 mb-4">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1 mb-1.5">
                        <BookMarked className="size-3 text-amber-400" />
                        <span>Reading Now</span>
                      </span>
                      {currentlyReading ? (
                        <div className="flex items-center gap-2.5">
                          {currentlyReading.cover_url && (
                            <div className="relative w-7 h-10 rounded-xs overflow-hidden shrink-0 border border-border/40">
                              <Image
                                src={currentlyReading.cover_url}
                                alt={currentlyReading.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate leading-tight">
                              {currentlyReading.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {currentlyReading.author}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Between books right now
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link href={`/friends/${friend.id}/compare`} className="w-full">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full text-xs gap-1.5 font-medium"
                        >
                          <Sparkles className="size-3 text-amber-300" />
                          <span>Compare</span>
                        </Button>
                      </Link>

                      <Link href={`/friends/${friend.id}/library`} className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs gap-1.5 font-medium"
                        >
                          <BookOpen className="size-3 text-primary" />
                          <span>Shelves</span>
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : activeTab === "requests" ? (
        /* Requests Tab (Incoming & Outgoing) */
        <div className="space-y-8">
          {/* Inbound Requests */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Inbox className="size-4 text-emerald-400" />
              <span>Incoming Requests ({pendingIncoming.length})</span>
            </h3>

            {pendingIncoming.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-card/40 rounded-xl p-4 border border-border/40">
                No incoming friend requests.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingIncoming.map((req) => (
                  <Card key={req.id} className="border-border/60 bg-card/70 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs border border-border/40 shrink-0">
                        {req.requester.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{req.requester.display_name}</h4>
                        {req.requester.taste_archetype && (
                          <span className="text-[10px] text-muted-foreground block truncate max-w-[170px]">
                            {req.requester.taste_archetype}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => handleRespondRequest(req.id, "accept")}
                        disabled={actionLoadingId === req.id}
                        className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 gap-1"
                      >
                        <Check className="size-3" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRespondRequest(req.id, "decline")}
                        disabled={actionLoadingId === req.id}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Outbound Sent Requests */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Send className="size-4 text-muted-foreground" />
              <span>Sent Requests ({pendingOutgoing.length})</span>
            </h3>

            {pendingOutgoing.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-card/40 rounded-xl p-4 border border-border/40">
                No active sent requests.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingOutgoing.map((req) => (
                  <Card key={req.id} className="border-border/60 bg-card/70 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-muted text-muted-foreground font-bold flex items-center justify-center text-xs border border-border/40 shrink-0">
                        {req.addressee.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{req.addressee.display_name}</h4>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-2.5 text-amber-400" />
                          <span>Awaiting response</span>
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFriendship(req.id, true)}
                      disabled={actionLoadingId === req.id}
                      className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Cancel
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Invites Tab (Option B) */
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            These are invitation links you generated for friends who haven&apos;t joined GoodBetterBestReads yet. Once they sign up via your link, you will automatically be connected!
          </p>

          {pendingInvites.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-card/40 py-12 text-center">
              <p className="text-xs text-muted-foreground italic">No active invite links.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingInvites.map((inv) => (
                <Card key={inv.id} className="border-border/60 bg-card/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{inv.email}</h4>
                    <span className="text-[11px] text-muted-foreground block font-mono truncate">
                      Expires: {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(inv.inviteUrl, inv.invite_code)}
                      className="h-8 text-xs gap-1.5 font-medium"
                    >
                      {copiedCode === inv.invite_code ? (
                        <>
                          <Check className="size-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Friend Modal */}
      <AddFriendModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onFriendAdded={fetchFriendsData}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-card/95 backdrop-blur-md px-4 py-3 text-sm text-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="size-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
