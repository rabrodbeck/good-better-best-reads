import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { calculateTasteOverlap } from "@/lib/friends";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawTargetId } = await params;
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();

    // 1. Resolve friendship and target user ID
    // rawTargetId can be a friendship ID or a user ID
    const { data: friendship, error: fError } = await admin
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(
        `id.eq.${rawTargetId},and(requester_id.eq.${user.id},addressee_id.eq.${rawTargetId}),and(requester_id.eq.${rawTargetId},addressee_id.eq.${user.id})`
      )
      .eq("status", "accepted")
      .maybeSingle();

    if (fError || !friendship) {
      return NextResponse.json(
        { error: "You must be friends with this reader to compare reading tastes." },
        { status: 403 }
      );
    }

    const friendId =
      friendship.requester_id === user.id
        ? friendship.addressee_id
        : friendship.requester_id;

    // 2. Fetch both profiles
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, avatar_url, taste_archetype")
      .in("id", [user.id, friendId]);

    const myProfile = profiles?.find((p) => p.id === user.id);
    const friendProfile = profiles?.find((p) => p.id === friendId);

    // 3. Fetch both taste profiles
    const { data: tasteProfiles } = await admin
      .from("taste_profiles")
      .select("user_id, archetype_name, archetype_summary, preferred_pacing, emotional_tone, top_tropes, dealbreakers")
      .in("user_id", [user.id, friendId]);

    const myTaste = tasteProfiles?.find((t) => t.user_id === user.id) || null;
    const friendTaste = tasteProfiles?.find((t) => t.user_id === friendId) || null;

    // 4. Fetch books for both users
    const [myBooksRes, friendBooksRes] = await Promise.all([
      admin
        .from("user_books")
        .select(`
          id,
          book_id,
          shelf,
          rating,
          books (
            id,
            title,
            author,
            cover_url
          )
        `)
        .eq("user_id", user.id),
      admin
        .from("user_books")
        .select(`
          id,
          book_id,
          shelf,
          rating,
          books (
            id,
            title,
            author,
            cover_url
          )
        `)
        .eq("user_id", friendId),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const myBooks = (myBooksRes.data || []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const friendBooks = (friendBooksRes.data || []) as any[];

    // 5. Compute deterministic overlap
    const overlap = calculateTasteOverlap(myTaste, friendTaste, myBooks, friendBooks);

    return NextResponse.json({
      friend: {
        id: friendId,
        displayName: friendProfile?.display_name || "Friend",
        avatarUrl: friendProfile?.avatar_url || null,
        tasteArchetype: friendProfile?.taste_archetype || friendTaste?.archetype_name || "Reader",
      },
      me: {
        id: user.id,
        displayName: myProfile?.display_name || "You",
        avatarUrl: myProfile?.avatar_url || null,
        tasteArchetype: myProfile?.taste_archetype || myTaste?.archetype_name || "Reader",
      },
      overlap,
    });
  } catch (error) {
    console.error("GET /api/friends/[id]/compare error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
