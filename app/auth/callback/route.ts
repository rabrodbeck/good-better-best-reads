import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Default redirect to library or specified destination
  const next = searchParams.get("next") ?? "/library";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;

      // Auto-provision profile record if it doesn't already exist
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        try {
          const admin = createAdminClient(supabaseUrl, supabaseKey);
          const displayName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "Reader";
          const avatarUrl =
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            null;

          await admin.from("profiles").upsert(
            {
              id: user.id,
              email: user.email,
              display_name: displayName,
              avatar_url: avatarUrl,
            },
            { onConflict: "id" }
          );
        } catch (err) {
          console.error("Error auto-provisioning user profile:", err);
        }
      }

      // Handle forward host for Vercel production deployment vs local dev
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else if (error) {
      console.error("Error exchanging auth code for session:", error.message);
    }
  }

  // Fallback if authentication failed
  return NextResponse.redirect(`${origin}/?auth-error=true`);
}
