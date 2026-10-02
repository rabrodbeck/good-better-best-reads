import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch latest taste profile
        const { data: taste } = await supabase
            .from("taste_profiles")
            .select("user_id, archetype_name, archetype_summary, preferred_pacing, emotional_tone, top_tropes, dealbreakers, updated_at")
            .order("updated_at")
            .limit(1)
            .maybeSingle();

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