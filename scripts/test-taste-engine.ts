import * as fs from "fs";
import * as path from "path";
import { loadEnvConfig } from "@next/env";
import { parseGoodreadsCsv } from "../services/parser/goodreads-normalizer";
import { analyzeTasteProfile } from "../services/taste/taste-analyzer";

// Automatically loads .env.local without external packages
loadEnvConfig(process.cwd());

async function run() {
  console.log("🧠 Testing Gemini Taste Profiler with Real Goodreads Data...\n");

  const csvPath = path.resolve(process.cwd(), "test/fixtures/goodreads_library_export_ryan.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const { books, stats } = parseGoodreadsCsv(csvContent);

  console.log(`Loaded ${books.length} books (${stats.readCount} read, ${stats.fiveStarCount} 5-stars).`);
  console.log("Connecting to Gemini 2.5 Flash (analyzing taste profile)...\n");

  const startTime = Date.now();
  const profile = await analyzeTasteProfile(books);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("==================================================================");
  console.log(`✨ READER ARCHETYPE: ${profile.archetype_name.toUpperCase()}`);
  console.log("==================================================================");
  console.log(`⏱️  Generated in: ${duration}s via Gemini 1.5 Flash\n`);
  
  console.log("📖 TASTE SUMMARY:");
  console.log(profile.archetype_summary);
  console.log("\n------------------------------------------------------------------");
  console.log(`⚡ PREFERRED PACING: ${profile.preferred_pacing}`);
  console.log(`🎭 EMOTIONAL TONE:   ${profile.emotional_tone}`);
  console.log("\n🎯 TOP TROPES:");
  profile.top_tropes.forEach((t) => console.log(`  • ${t}`));

  console.log("\n🛑 DEALBREAKERS (What to avoid):");
  profile.dealbreakers.forEach((d) => console.log(`  • ${d}`));
  console.log("==================================================================\n");
}

run().catch((err) => {
  console.error("❌ Taste Engine Error:", err);
});