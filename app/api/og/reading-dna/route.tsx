import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Allow overriding via query parameters, or dynamically fetch live from Supabase
    let archetype = searchParams.get("archetype");
    let pacing = searchParams.get("pacing");
    let tone = searchParams.get("tone");
    const tropesParam = searchParams.get("tropes");
    const dealbreakersParam = searchParams.get("dealbreakers");

    let tropes: string[] = tropesParam ? tropesParam.split(",") : [];
    let dealbreakers: string[] = dealbreakersParam ? dealbreakersParam.split(",") : [];
    let totalBooks = 52;
    let readBooks = 24;

    if (!archetype) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: dbTaste } = await supabase
          .from("taste_profiles")
          .select("archetype_name, archetype_summary, preferred_pacing, emotional_tone, top_tropes, dealbreakers, user_id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dbTaste) {
          archetype = dbTaste.archetype_name;
          pacing = dbTaste.preferred_pacing || "Propulsive & High-Octane";
          tone = dbTaste.emotional_tone || "Tense & Unforgiving";
          tropes = dbTaste.top_tropes || [];
          dealbreakers = dbTaste.dealbreakers || [];

          const { count: total } = await supabase
            .from("user_books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", dbTaste.user_id);

          const { count: read } = await supabase
            .from("user_books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", dbTaste.user_id)
            .eq("shelf", "read");

          if (total) totalBooks = total;
          if (read) readBooks = read;
        }
      }
    }

    // Default fallbacks
    archetype = archetype || "The Gritty High-Stakes Thriller";
    pacing = pacing || "Propulsive & High-Octane";
    tone = tone || "Tense & Unforgiving";
    if (tropes.length === 0) {
      tropes = ["Shocking Twists", "Moral Ambiguity", "High-Stakes Survival", "Fast Pacing"];
    }
    if (dealbreakers.length === 0) {
      dealbreakers = ["Predictable Twists", "Cheesy Romance", "Slow Exposition"];
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#070a12",
            backgroundImage:
              "radial-gradient(circle at 15% 15%, rgba(16, 185, 129, 0.15) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(59, 130, 246, 0.15) 0%, transparent 40%)",
            padding: "48px 56px",
            color: "#ffffff",
            fontFamily: "sans-serif",
            border: "8px solid #111827",
            boxSizing: "border-box",
          }}
        >
          {/* Top Brand Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  backgroundColor: "#10b981",
                  color: "#000000",
                  fontWeight: 900,
                  fontSize: "22px",
                }}
              >
                G
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                  GoodBetterBest<span style={{ color: "#10b981" }}>Reads</span>
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    letterSpacing: "1.5px",
                    color: "#9ca3af",
                    textTransform: "uppercase",
                  }}
                >
                  Verified Reading DNA &bull; 2026
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                borderRadius: "9999px",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#34d399",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Taste Archetype
            </div>
          </div>

          {/* Center Hero: Archetype & Pacing */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#9ca3af",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              Reader Identity
            </span>
            <h1
              style={{
                fontSize: "48px",
                fontWeight: 900,
                letterSpacing: "-1px",
                margin: 0,
                color: "#ffffff",
                lineHeight: 1.1,
              }}
            >
              {archetype}
            </h1>

            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 16px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: "14px",
                  color: "#e2e8f0",
                }}
              >
                <span>⚡</span>
                <span style={{ fontWeight: 600 }}>Pacing:</span> {pacing}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 16px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: "14px",
                  color: "#e2e8f0",
                }}
              >
                <span>🎭</span>
                <span style={{ fontWeight: 600 }}>Tone:</span> {tone}
              </div>
            </div>
          </div>

          {/* Bottom Grid: Tropes, Dealbreakers, and Stats */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              width: "100%",
            }}
          >
            {/* Loved Tropes */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1.2,
                padding: "16px 20px",
                borderRadius: "14px",
                backgroundColor: "rgba(17, 24, 39, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#10b981",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Top Loved Tropes
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {tropes.slice(0, 4).map((t, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      fontSize: "12px",
                      color: "#6ee7b7",
                      fontWeight: 500,
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Dealbreakers */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1.2,
                padding: "16px 20px",
                borderRadius: "14px",
                backgroundColor: "rgba(17, 24, 39, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#f87171",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Strict Dealbreakers
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {dealbreakers.slice(0, 3).map((d, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      fontSize: "12px",
                      color: "#fca5a5",
                      fontWeight: 500,
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Library Stats */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 0.8,
                padding: "16px 20px",
                borderRadius: "14px",
                backgroundColor: "rgba(17, 24, 39, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#60a5fa",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Library Scale
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ fontSize: "28px", fontWeight: 900, color: "#ffffff" }}>
                  {totalBooks}
                </span>
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>cataloged</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "2px" }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "#34d399" }}>
                  {readBooks}
                </span>
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>completed</span>
              </div>
            </div>
          </div>

          {/* Footer Watermark */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              paddingTop: "12px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: "12px",
              color: "#6b7280",
            }}
          >
            <span>AI Taste Vector: 768 Dimensions (Gemini Matryoshka)</span>
            <span style={{ fontWeight: 600, color: "#9ca3af" }}>goodbetterbestreads.com</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error("OG Image Generation Error:", error);
    return new Response("Failed to generate Reading DNA image", { status: 500 });
  }
}
