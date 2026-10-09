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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { error: "Invalid action. Use 'accept' or 'decline'." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Look up friendship row by id
    const { data: friendship, error: findError } = await admin
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .eq("id", id)
      .maybeSingle();

    if (findError || !friendship) {
      return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
    }

    // Security Check: Only the addressee (recipient) can accept or decline!
    if (friendship.addressee_id !== user.id) {
      return NextResponse.json(
        { error: "Only the recipient can respond to this friend request." },
        { status: 403 }
      );
    }

    if (friendship.status !== "pending") {
      return NextResponse.json(
        { error: `This friend request is already ${friendship.status}.` },
        { status: 400 }
      );
    }

    const newStatus = action === "accept" ? "accepted" : "declined";

    const { error: updateError } = await admin
      .from("friendships")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating friend request status:", updateError);
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: action === "accept" ? "Friend request accepted!" : "Friend request declined.",
    });
  } catch (error) {
    console.error("PATCH /api/friends/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();

    // Look up friendship by id or friend's user id
    const { data: friendship, error: findError } = await admin
      .from("friendships")
      .select("id, requester_id, addressee_id")
      .or(`id.eq.${id},and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
      .maybeSingle();

    if (findError || !friendship) {
      return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
    }

    // Must be either requester or addressee to unfriend or cancel
    if (friendship.requester_id !== user.id && friendship.addressee_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: deleteError } = await admin
      .from("friendships")
      .delete()
      .eq("id", friendship.id);

    if (deleteError) {
      console.error("Error deleting friendship:", deleteError);
      return NextResponse.json({ error: "Failed to remove friendship" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Friendship removed successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/friends/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
