import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔍 Looking up users in Supabase...");

  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr || !users) {
    console.error("Failed to list users:", userErr);
    process.exit(1);
  }

  const dummyUser = users.users.find(
    (u) => u.email === "ryan@goodbetterbestreads.local"
  );
  const googleUser = users.users.find((u) => u.email === "rbrodbeck@gmail.com");

  if (!dummyUser) {
    console.error("Could not find dummy user (ryan@goodbetterbestreads.local)");
    process.exit(1);
  }

  if (!googleUser) {
    console.error("Could not find Google user (rbrodbeck@gmail.com)");
    process.exit(1);
  }

  console.log(`\nFound Source User: ${dummyUser.email} (${dummyUser.id})`);
  console.log(`Found Target User: ${googleUser.email} (${googleUser.id})`);

  // 1. Transfer user_books
  console.log("\n📦 Migrating user_books...");
  const { data: userBooks, error: ubFetchErr } = await supabase
    .from("user_books")
    .select("id")
    .eq("user_id", dummyUser.id);

  if (ubFetchErr) {
    console.error("Error fetching dummy user books:", ubFetchErr);
  } else {
    const bookCount = userBooks?.length || 0;
    console.log(`Found ${bookCount} books to transfer.`);

    const { error: ubUpdateErr } = await supabase
      .from("user_books")
      .update({ user_id: googleUser.id })
      .eq("user_id", dummyUser.id);

    if (ubUpdateErr) {
      console.error("❌ Failed to transfer user_books:", ubUpdateErr);
    } else {
      console.log(`✅ Successfully transferred ${bookCount} books to ${googleUser.email}!`);
    }
  }

  // 2. Transfer taste_profile
  console.log("\n🧬 Migrating taste profile...");
  const { data: dummyTaste } = await supabase
    .from("taste_profiles")
    .select("*")
    .eq("user_id", dummyUser.id)
    .maybeSingle();

  if (dummyTaste) {
    // Delete any existing empty taste profile on target if present
    await supabase.from("taste_profiles").delete().eq("user_id", googleUser.id);

    // Update the taste profile user_id to target
    const { error: tasteUpdateErr } = await supabase
      .from("taste_profiles")
      .update({ user_id: googleUser.id })
      .eq("user_id", dummyUser.id);

    if (tasteUpdateErr) {
      console.error("❌ Failed to transfer taste profile:", tasteUpdateErr);
    } else {
      console.log(
        `✅ Successfully transferred taste profile "${dummyTaste.archetype_name}" to ${googleUser.email}!`
      );
    }

    // Update target profile's taste_archetype
    await supabase
      .from("profiles")
      .update({
        taste_archetype: dummyTaste.archetype_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", googleUser.id);
  } else {
    console.log("ℹ️ No taste profile found on dummy user.");
  }

  // 3. Remove the old dummy user
  console.log("\n🧹 Removing old dummy developer account...");
  const { error: deleteErr } = await supabase.auth.admin.deleteUser(dummyUser.id);
  if (deleteErr) {
    console.error("Warning: could not delete dummy auth user:", deleteErr);
  } else {
    console.log(`✅ Deleted dummy user ${dummyUser.email}.`);
  }

  // 4. Verify Final State
  console.log("\n🎉 Migration Complete! Verifying new counts for your Google account:");
  const { count: finalBooks } = await supabase
    .from("user_books")
    .select("*", { count: "exact", head: true })
    .eq("user_id", googleUser.id);

  const { data: finalTaste } = await supabase
    .from("taste_profiles")
    .select("archetype_name")
    .eq("user_id", googleUser.id)
    .maybeSingle();

  console.log(` - Books in your library: ${finalBooks || 0}`);
  console.log(` - Active Taste Archetype: ${finalTaste?.archetype_name || "None"}\n`);
}

main().catch(console.error);
