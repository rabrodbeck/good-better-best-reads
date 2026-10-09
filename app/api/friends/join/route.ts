import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

// GET: Public preview of who invited the user
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: invite, error } = await admin
      .from("friend_invites")
      .select("id, inviter_id, status, expires_at")
      .eq("invite_code", code)
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({ valid: false, error: "Invite link not found." }, { status: 404 });
    }

    if (invite.status !== "pending" || new Date(invite.expires_at) <= new Date()) {
      return NextResponse.json({ valid: false, error: "This invite link has expired or was already used." }, { status: 410 });
    }

    // Fetch inviter public profile
    const { data: inviter } = await admin
      .from("profiles")
      .select("display_name, avatar_url, taste_archetype")
      .eq("id", invite.inviter_id)
      .maybeSingle();

    return NextResponse.json({
      valid: true,
      inviter: {
        displayName: inviter?.display_name || "A Reader",
        avatarUrl: inviter?.avatar_url || null,
        tasteArchetype: inviter?.taste_archetype || null,
      },
    });
  } catch (error) {
    console.error("GET /api/friends/join error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Authenticated user claims the invite code to form mutual friendship
export async function POST(req: Request) {
  try {
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in to accept this invite." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = body.inviteCode;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: invite, error: invError } = await admin
      .from("friend_invites")
      .select("id, inviter_id, status, expires_at")
      .eq("invite_code", code)
      .maybeSingle();

    if (invError || !invite) {
      return NextResponse.json({ error: "Invite link not found." }, { status: 404 });
    }

    if (invite.status !== "pending" || new Date(invite.expires_at) <= new Date()) {
      return NextResponse.json({ error: "This invite link has expired or has already been used." }, { status: 410 });
    }

    if (invite.inviter_id === user.id) {
      return NextResponse.json({ error: "You cannot accept your own invite link." }, { status: 400 });
    }

    // Check if friendship already exists
    const { data: existingFriendship } = await admin
      .from("friendships")
      .select("id, status")
      .or(
        `and(requester_id.eq.${invite.inviter_id},addressee_id.eq.${user.id}),and(requester_id.eq.${user.id},addressee_id.eq.${invite.inviter_id})`
      )
      .maybeSingle();

    if (existingFriendship) {
      await admin
        .from("friendships")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", existingFriendship.id);
    } else {
      await admin.from("friendships").insert({
        requester_id: invite.inviter_id,
        addressee_id: user.id,
        status: "accepted",
      });
    }

    // Mark invite accepted
    await admin
      .from("friend_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    return NextResponse.json({
      success: true,
      message: "You are now connected as reading buddies!",
      inviterId: invite.inviter_id,
    });
  } catch (error) {
    console.error("POST /api/friends/join error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
