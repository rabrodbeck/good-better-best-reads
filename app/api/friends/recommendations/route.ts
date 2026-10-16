import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createAndDispatchNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  try {
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();

    // Query received recommendations
    const { data: rawReceived, error: recError } = await admin
      .from("book_recommendations")
      .select(`
        id,
        note,
        status,
        created_at,
        sender:profiles!sender_id (
          id,
          display_name,
          avatar_url,
          taste_archetype
        ),
        book:books (
          id,
          title,
          author,
          cover_url,
          published_year,
          page_count
        )
      `)
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    // If table doesn't exist yet, return empty arrays gracefully
    if (recError) {
      console.warn("Could not query book_recommendations:", recError.message);
      return NextResponse.json({ received: [], sent: [] });
    }

    // Query sent recommendations
    const { data: rawSent } = await admin
      .from("book_recommendations")
      .select(`
        id,
        note,
        status,
        created_at,
        recipient:profiles!recipient_id (
          id,
          display_name,
          avatar_url
        ),
        book:books (
          id,
          title,
          author,
          cover_url
        )
      `)
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      received: rawReceived || [],
      sent: rawSent || [],
    });
  } catch (error: any) {
    console.error("Recommendations GET error:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { recipientId, bookId, note } = body;

    if (!recipientId || !bookId) {
      return NextResponse.json(
        { error: "recipientId and bookId are required" },
        { status: 400 }
      );
    }

    if (recipientId === user.id) {
      return NextResponse.json(
        { error: "You cannot recommend a book to yourself" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Verify mutual accepted friendship
    const { data: friendship, error: fError } = await admin
      .from("friendships")
      .select("id")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${recipientId}),and(requester_id.eq.${recipientId},addressee_id.eq.${user.id})`
      )
      .eq("status", "accepted")
      .maybeSingle();

    if (fError || !friendship) {
      return NextResponse.json(
        { error: "You can only recommend books to accepted friends" },
        { status: 403 }
      );
    }

    // Verify book exists
    const { data: bookRecord, error: bError } = await admin
      .from("books")
      .select("id, title, author, cover_url")
      .eq("id", bookId)
      .maybeSingle();

    if (bError || !bookRecord) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Insert recommendation (or update note if pending unread recommendation already exists)
    const { data: inserted, error: insertError } = await admin
      .from("book_recommendations")
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        book_id: bookId,
        note: note?.trim() || null,
        status: "unread",
      })
      .select(`
        id,
        note,
        status,
        created_at,
        book:books (
          id,
          title,
          author,
          cover_url
        )
      `)
      .single();

    if (insertError) {
      // If duplicate active recommendation exists
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "You have already recommended this book to this friend" },
          { status: 409 }
        );
      }
      console.error("Recommendation insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Dispatch in-app alert and web push notification to recipient
    try {
      const { data: senderProfile } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      const senderName =
        senderProfile?.display_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "A friend";

      const bookTitle = bookRecord.title;
      const notifTitle = `📚 ${senderName} recommended a book!`;
      const trimmedNote = note?.trim();
      const shortNote =
        trimmedNote && trimmedNote.length > 90
          ? `${trimmedNote.slice(0, 87)}...`
          : trimmedNote;

      const notifBody = shortNote
        ? `"${shortNote}" — ${bookTitle}`
        : `"${bookTitle}" by ${bookRecord.author} was added to your recommendations.`;

      await createAndDispatchNotification({
        userId: recipientId,
        type: "friend_recommendation",
        title: notifTitle,
        body: notifBody,
        data: {
          url: "/library?shelf=recommended",
          recommendationId: inserted.id,
          bookId: bookRecord.id,
          bookTitle: bookRecord.title,
          bookAuthor: bookRecord.author,
          coverUrl: bookRecord.cover_url,
          senderId: user.id,
          senderName: senderName,
        },
      });
    } catch (notifErr) {
      console.warn("Could not dispatch friend recommendation notification:", notifErr);
    }

    return NextResponse.json({
      success: true,
      recommendation: inserted,
    });
  } catch (error: any) {
    console.error("Recommendations POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create recommendation" },
      { status: 500 }
    );
  }
}
