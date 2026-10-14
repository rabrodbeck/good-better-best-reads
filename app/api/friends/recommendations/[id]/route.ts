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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recommendationId } = await params;
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const validActions = ["accept", "dismiss", "read"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept', 'dismiss', or 'read'" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Verify recommendation exists and user is recipient
    const { data: rec, error: recError } = await admin
      .from("book_recommendations")
      .select("id, recipient_id, book_id, status")
      .eq("id", recommendationId)
      .maybeSingle();

    if (recError || !rec) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    if (rec.recipient_id !== user.id) {
      return NextResponse.json(
        { error: "Only the recipient can update recommendation status" },
        { status: 403 }
      );
    }

    const newStatus =
      action === "accept" ? "accepted" : action === "dismiss" ? "dismissed" : "read";

    const { data: updated, error: updateError } = await admin
      .from("book_recommendations")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recommendationId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If accepted: automatically add to the user's "to-read" shelf if not already there!
    if (action === "accept" && rec.book_id) {
      const { data: existingUserBook } = await admin
        .from("user_books")
        .select("id, shelf")
        .eq("user_id", user.id)
        .eq("book_id", rec.book_id)
        .maybeSingle();

      if (!existingUserBook) {
        await admin.from("user_books").insert({
          user_id: user.id,
          book_id: rec.book_id,
          shelf: "to-read",
          user_shelves: ["to-read"],
          updated_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      recommendation: updated,
    });
  } catch (error: any) {
    console.error("Recommendation PATCH error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update recommendation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recommendationId } = await params;
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();

    // Verify user is sender or recipient
    const { data: rec, error: recError } = await admin
      .from("book_recommendations")
      .select("id, sender_id, recipient_id")
      .eq("id", recommendationId)
      .maybeSingle();

    if (recError || !rec) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    if (rec.sender_id !== user.id && rec.recipient_id !== user.id) {
      return NextResponse.json(
        { error: "You do not have permission to delete this recommendation" },
        { status: 403 }
      );
    }

    await admin.from("book_recommendations").delete().eq("id", recommendationId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Recommendation DELETE error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete recommendation" },
      { status: 500 }
    );
  }
}
