import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { normalizeEmail } from "@/lib/friends";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

export async function GET(req: Request) {
  try {
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();

    // 1. Fetch all friendships involving the current user
    const { data: rawFriendships, error: fError } = await admin
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at, updated_at")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .in("status", ["pending", "accepted"]);

    if (fError) {
      console.error("Error fetching friendships:", fError);
      return NextResponse.json({ error: "Failed to fetch friendships" }, { status: 500 });
    }

    const friendships = rawFriendships || [];

    // Collect all other user IDs we need profile info for
    const otherUserIds = new Set<string>();
    for (const f of friendships) {
      const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      otherUserIds.add(otherId);
    }

    // 2. Fetch profiles for all connected users
    const profilesMap = new Map<string, { id: string; display_name: string; avatar_url: string | null; taste_archetype: string | null }>();
    if (otherUserIds.size > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name, avatar_url, taste_archetype")
        .in("id", Array.from(otherUserIds));

      for (const p of profiles || []) {
        profilesMap.set(p.id, p);
      }
    }

    // 3. For accepted friends, fetch their currently-reading book
    const acceptedFriendsList: Array<{
      friendshipId: string;
      friend: { id: string; display_name: string; avatar_url: string | null; taste_archetype: string | null };
      acceptedAt: string;
      currentlyReading: { title: string; author: string; cover_url: string | null } | null;
    }> = [];

    const acceptedRows = friendships.filter((f) => f.status === "accepted");
    const acceptedFriendIds = acceptedRows.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));

    const currentlyReadingMap = new Map<string, { title: string; author: string; cover_url: string | null }>();
    if (acceptedFriendIds.length > 0) {
      const { data: currentBooks } = await admin
        .from("user_books")
        .select(`
          user_id,
          books (
            title,
            author,
            cover_url
          )
        `)
        .in("user_id", acceptedFriendIds)
        .eq("shelf", "currently-reading")
        .limit(100);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const ub of (currentBooks || []) as any[]) {
        if (ub.books && !currentlyReadingMap.has(ub.user_id)) {
          currentlyReadingMap.set(ub.user_id, {
            title: ub.books.title,
            author: ub.books.author,
            cover_url: ub.books.cover_url,
          });
        }
      }
    }

    for (const f of acceptedRows) {
      const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      const profile = profilesMap.get(friendId) || {
        id: friendId,
        display_name: "Reader",
        avatar_url: null,
        taste_archetype: null,
      };

      acceptedFriendsList.push({
        friendshipId: f.id,
        friend: profile,
        acceptedAt: f.updated_at || f.created_at,
        currentlyReading: currentlyReadingMap.get(friendId) || null,
      });
    }

    // 4. Pending Incoming (Someone sent request to current user)
    const pendingIncoming = friendships
      .filter((f) => f.status === "pending" && f.addressee_id === user.id)
      .map((f) => ({
        id: f.id,
        requester: profilesMap.get(f.requester_id) || {
          id: f.requester_id,
          display_name: "Reader",
          avatar_url: null,
          taste_archetype: null,
        },
        createdAt: f.created_at,
      }));

    // 5. Pending Outgoing (Current user sent request to someone)
    const pendingOutgoing = friendships
      .filter((f) => f.status === "pending" && f.requester_id === user.id)
      .map((f) => ({
        id: f.id,
        addressee: profilesMap.get(f.addressee_id) || {
          id: f.addressee_id,
          display_name: "Reader",
          avatar_url: null,
          taste_archetype: null,
        },
        createdAt: f.created_at,
      }));

    // 6. Active Invites sent by user
    const { data: rawInvites } = await admin
      .from("friend_invites")
      .select("id, email, invite_code, status, created_at, expires_at")
      .eq("inviter_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    const origin = new URL(req.url).origin;
    const invites = (rawInvites || []).map((inv) => ({
      ...inv,
      inviteUrl: `${origin}/join/${inv.invite_code}`,
    }));

    return NextResponse.json({
      friends: acceptedFriendsList,
      pendingIncoming,
      pendingOutgoing,
      pendingInvites: invites,
    });
  } catch (error) {
    console.error("GET /api/friends error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const cleanEmail = normalizeEmail(rawEmail);

    if (user.email && cleanEmail === normalizeEmail(user.email)) {
      return NextResponse.json({ error: "You cannot add yourself as a friend." }, { status: 400 });
    }

    const admin = getAdminClient();

    // 1. Look up if user is already registered
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, display_name, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    const origin = new URL(req.url).origin;

    // CASE A: User is already registered
    if (existingProfile) {
      if (existingProfile.id === user.id) {
        return NextResponse.json({ error: "You cannot add yourself as a friend." }, { status: 400 });
      }

      // Check if friendship already exists
      const { data: existingFriendship } = await admin
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${existingProfile.id}),and(requester_id.eq.${existingProfile.id},addressee_id.eq.${user.id})`
        )
        .in("status", ["pending", "accepted"])
        .maybeSingle();

      if (existingFriendship) {
        if (existingFriendship.status === "accepted") {
          return NextResponse.json(
            { error: "You are already friends with this reader." },
            { status: 400 }
          );
        }
        if (existingFriendship.requester_id === user.id) {
          return NextResponse.json(
            { error: "A friend request has already been sent to this reader." },
            { status: 400 }
          );
        }
        // Inbound request already exists: auto-accept!
        await admin
          .from("friendships")
          .update({ status: "accepted", updated_at: new Date().toISOString() })
          .eq("id", existingFriendship.id);

        return NextResponse.json({
          success: true,
          type: "auto_accepted",
          message: `You and ${existingProfile.display_name} are now friends!`,
          recipient: existingProfile,
        });
      }

      // Create new pending friendship
      const { data: newFriendship, error: insertError } = await admin
        .from("friendships")
        .insert({
          requester_id: user.id,
          addressee_id: existingProfile.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error creating friend request:", insertError);
        return NextResponse.json({ error: "Failed to send friend request" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        type: "request_sent",
        message: `Friend request sent to ${existingProfile.display_name}.`,
        friendshipId: newFriendship.id,
        recipient: {
          id: existingProfile.id,
          display_name: existingProfile.display_name,
        },
      });
    }

    // CASE B: Unregistered User (Viral Invite Link - Option B)
    // Check if active pending invite for this email already exists
    const { data: existingInvite } = await admin
      .from("friend_invites")
      .select("id, invite_code, expires_at")
      .eq("inviter_id", user.id)
      .eq("email", cleanEmail)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json({
        success: true,
        type: "invite_created",
        message: `${cleanEmail} isn't on GoodBetterBestReads yet! Share your invite link with them.`,
        inviteCode: existingInvite.invite_code,
        inviteUrl: `${origin}/join/${existingInvite.invite_code}`,
        email: cleanEmail,
      });
    }

    // Generate random 12-byte hex invite token
    const inviteCode = crypto.randomBytes(12).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error: inviteError } = await admin.from("friend_invites").insert({
      inviter_id: user.id,
      email: cleanEmail,
      invite_code: inviteCode,
      status: "pending",
      expires_at: expiresAt,
    });

    if (inviteError) {
      console.error("Error creating friend invite:", inviteError);
      return NextResponse.json({ error: "Failed to generate invite" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      type: "invite_created",
      message: `${cleanEmail} isn't on GoodBetterBestReads yet! Share your invite link with them to connect once they join.`,
      inviteCode,
      inviteUrl: `${origin}/join/${inviteCode}`,
      email: cleanEmail,
    });
  } catch (error) {
    console.error("POST /api/friends error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
