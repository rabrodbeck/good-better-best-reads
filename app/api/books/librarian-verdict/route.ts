import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { LibrarianVerdictInputSchema } from "@/types/librarian-verdict";
import { generateLibrarianVerdict } from "@/lib/librarian-verdict";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/books/librarian-verdict
 * Evaluates a candidate book against the authenticated user's Reading DNA and library history.
 */
export async function POST(req: Request) {
  try {
    // 1. Rate limiting (20 requests per minute per IP)
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`librarian-verdict:${ip}`, {
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many taste check requests. Please wait a moment before asking again." },
        { status: 429 }
      );
    }

    // 2. Authentication check
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Request body validation with Zod
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = LibrarianVerdictInputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid book payload for verdict evaluation",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    // 4. Supabase admin client for reading taste profiles & user books
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const admin = createAdminClient(supabaseUrl, supabaseKey);

    // 5. Generate verdict
    const verdict = await generateLibrarianVerdict(user.id, parseResult.data, admin);

    return NextResponse.json(verdict);
  } catch (err: unknown) {
    console.error("Unhandled error in POST /api/books/librarian-verdict:", err);
    return NextResponse.json(
      { error: "Internal server error analyzing book recommendation" },
      { status: 500 }
    );
  }
}
