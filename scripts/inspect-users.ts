import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: users } = await supabase.auth.admin.listUsers();
  console.log("Auth Users:");
  users?.users.forEach((u) =>
    console.log(` - ID: ${u.id} | Email: ${u.email} | Provider: ${u.app_metadata.provider || "email"}`)
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email");
  console.log("\nProfiles:");
  profiles?.forEach((p) =>
    console.log(` - ID: ${p.id} | Name: ${p.display_name} | Email: ${p.email}`)
  );

  const { data: userBooks } = await supabase.from("user_books").select("user_id");
  const counts: Record<string, number> = {};
  userBooks?.forEach((ub) => {
    counts[ub.user_id] = (counts[ub.user_id] || 0) + 1;
  });
  console.log("\nUser Books by User ID:", counts);

  const { data: taste } = await supabase.from("taste_profiles").select("user_id, archetype_name");
  console.log("\nTaste Profiles by User ID:");
  taste?.forEach((t) => console.log(` - User ID: ${t.user_id} | Archetype: ${t.archetype_name}`));
}

main().catch(console.error);
