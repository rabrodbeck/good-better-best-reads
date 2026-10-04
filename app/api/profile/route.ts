import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createAdminClient(supabaseUrl, supabaseKey);

        let userId: string | undefined;
        try {
            const serverClient = await createServerClient();
            const {
                data: { user },
            } = await serverClient.auth.getUser();
            if (user) {
                userId = user.id;
            }
        } catch {
            // Unauthenticated
        }

        // 1. Fetch taste profile (user-specific if logged in, fallback to latest for preview)
        let tasteQuery = supabase
            .from("taste_profiles")
            .select("user_id, archetype_name, archetype_summary, preferred_pacing, emotional_tone, top_tropes, dealbreakers, updated_at");

        if (userId) {
            tasteQuery = tasteQuery.eq("user_id", userId);
        } else {
            tasteQuery = tasteQuery.order("updated_at", { ascending: false }).limit(1);
        }

        const { data: taste } = await tasteQuery.maybeSingle();

        if (!taste) {
            return NextResponse.json({ profile: null, tasteProfile: null });
        }

        // 2. Fetch user profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("id, display_name, email, taste_archetype")
            .eq("id", taste.user_id)
            .maybeSingle();

        // 3. Fetch shelf counts
        const { count: totalBooks } = await supabase
            .from("user_books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", taste.user_id);

        const { count: readCount } = await supabase
            .from("user_books")
            .select("*", { count: "exact", head: true })
            .eq("shelf", "read");

        return NextResponse.json({
            profile,
            tasteProfile: taste,
            stats: {
                totalBooks: totalBooks || 0,
                readCount: readCount || 0,
            },
        });
    } catch (error) {
        console.error("Profile API Error:", error)
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}