import { loadEnvConfig } from "@next/env";
import { generateTasteVector } from "../services/taste/embedding-generator";
import { TasteProfile } from "../services/taste/schemas";

loadEnvConfig(process.cwd());

async function run() {
  console.log("📐 Testing Google Gemini 768-Dim Vector Embedding Generator...\n");

  // Sample taste profile (representing the output from our analyzer)
  const sampleProfile: TasteProfile = {
    archetype_name: "The Dark & Clever Thrill-Seeker",
    preferred_pacing: "Relentless & Propulsive",
    emotional_tone: "Tense, Gritty, & Intellectually Engaging",
    archetype_summary:
      "You are drawn to narratives that grab you by the throat and refuse to let go, thriving on a potent cocktail of psychological tension, high-stakes scenarios, and often a dash of the macabre. Your ideal read is a relentless journey, whether it's navigating claustrophobic terror, unraveling deeply unsettling mysteries, or facing existential threats with ingenuity.",
    top_tropes: [
      "High-stakes survival & ingenious problem-solving",
      "Twisty plots with shocking reveals",
      "Psychological manipulation & unreliable narrators",
    ],
    dealbreakers: [
      "Slow-burn literary fiction devoid of plot momentum",
      "Overly saccharine romance",
      "Predictable narratives with obvious twists",
    ],
  };

  console.log(`Generating embedding for: "${sampleProfile.archetype_name}"...`);
  const startTime = Date.now();
  const vector = await generateTasteVector(sampleProfile);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("==================================================================");
  console.log("✅ VECTOR EMBEDDING GENERATED SUCCESSFULLY!");
  console.log("==================================================================");
  console.log(`⏱️  Duration:          ${duration}s`);
  console.log(`📊 Vector Dimensions: ${vector.length} (Expected: 768 for pgvector)`);
  console.log(`🔍 First 5 values:    [${vector.slice(0, 5).map((v) => v.toFixed(5)).join(", ")}...]`);
  console.log(`🔍 Last 5 values:     [...${vector.slice(-5).map((v) => v.toFixed(5)).join(", ")}]`);
  console.log("==================================================================\n");

  if (vector.length === 768) {
    console.log("🎯 Exact match for our Supabase pgvector column: VECTOR(768)!");
  } else {
    console.warn(`⚠️ Warning: Expected 768 dimensions but got ${vector.length}`);
  }
}

run().catch((err) => {
  console.error("❌ Embedding Error:", err);
});