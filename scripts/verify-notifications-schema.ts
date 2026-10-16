import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("🔍 Checking Notifications & Push Subscription schema in Supabase...\n");

  let allPassed = true;

  // 1. Check notifications table
  const { data: notifData, error: notifError } = await supabase
    .from("notifications")
    .select("id")
    .limit(1);

  if (notifError) {
    console.error("❌ 'notifications' table:", notifError.message);
    allPassed = false;
  } else {
    console.log("✅ 'notifications' table exists and is accessible.");
  }

  // 2. Check push_subscriptions table
  const { data: pushData, error: pushError } = await supabase
    .from("push_subscriptions")
    .select("id")
    .limit(1);

  if (pushError) {
    console.error("❌ 'push_subscriptions' table:", pushError.message);
    allPassed = false;
  } else {
    console.log("✅ 'push_subscriptions' table exists and is accessible.");
  }

  // 3. Check notification_preferences on profiles
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, notification_preferences")
    .limit(1);

  if (profileError) {
    console.error("❌ 'profiles.notification_preferences':", profileError.message);
    allPassed = false;
  } else {
    console.log("✅ 'profiles.notification_preferences' column exists.");
    if (profileData && profileData[0]) {
      console.log("   Sample preferences:", JSON.stringify(profileData[0].notification_preferences));
    }
  }

  console.log("\n---------------------------------------------------------");
  if (allPassed) {
    console.log("🎉 ALL SCHEMA CHECKS PASSED SUCCESSFULLY!");
  } else {
    console.log("⚠️ Some checks failed. Please execute the migration in Supabase SQL Editor:");
    console.log("   supabase/migrations/20261016_create_notifications_schema.sql");
  }
  console.log("---------------------------------------------------------\n");

  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
