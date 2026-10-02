import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

async function run() {
  console.log("🔌 Testing Live Supabase Connection...\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || url.includes("placeholder")) {
    console.error("❌ Missing or placeholder NEXT_PUBLIC_SUPABASE_URL in .env.local");
    process.exit(1);
  }

  if (!anonKey || anonKey.includes("placeholder")) {
    console.error("❌ Missing or placeholder NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  console.log(`Connecting to: ${url}...`);

  // Test 1: Query the books catalog
  const { data: books, error: booksError } = await supabase
    .from("books")
    .select("id")
    .limit(1);

  if (booksError) {
    console.error("❌ Failed to query 'books' table:", booksError.message);
    console.error("💡 Did you run the SQL migration in Supabase SQL Editor?");
    process.exit(1);
  }

  const { count } = await supabase
    .from("books")
    .select("*", { count: "exact", head: true });

  console.log(`✅ 'books' table exists and is accessible. Total stored books: ${count}`);

  // Test 2: Query the taste_profiles table
  const { data: taste, error: tasteError } = await supabase
    .from("taste_profiles")
    .select("id")
    .limit(1);

  if (tasteError) {
    console.error("❌ Failed to query 'taste_profiles' table:", tasteError.message);
    process.exit(1);
  }

  console.log("✅ 'taste_profiles' table exists and is accessible.");
  console.log("==================================================================");
  console.log("🎉 LIVE SUPABASE CONNECTION & SCHEMA VERIFIED SUCCESSFULLY!");
  console.log("==================================================================\n");
}

run().catch(console.error);