import * as fs from "fs";
import * as path from "path";
import { loadEnvConfig } from "@next/env";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { parseGoodreadsCsv } from "../services/parser/goodreads-normalizer";
import { TasteProfile } from "../services/taste/schemas";
import { buildLibrarianSystemPrompt } from "../services/librarian/prompt";
import { lookupBookCoverTool } from "../services/librarian/tools";

loadEnvConfig(process.cwd());

async function run() {
  console.log("📚 Initializing Personal Librarian Conversational Test...\n");

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("❌ No API key found in .env.local");
    process.exit(1);
  }

  // 1. Load reader's already-read books from their real export
  const csvPath = path.resolve(process.cwd(), "test/fixtures/goodreads_library_export_ryan.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const { books } = parseGoodreadsCsv(csvContent);
  const readTitles = books.filter((b) => b.shelf === "read").map((b) => b.cleanTitle);

  // 2. The extracted profile from Phase 2
  const profile: TasteProfile = {
    archetype_name: "The Dark & Clever Thrill-Seeker",
    preferred_pacing: "Relentless & Propulsive",
    emotional_tone: "Tense, Gritty, & Intellectually Engaging",
    archetype_summary:
      "You thrive on a potent cocktail of psychological tension, high-stakes scenarios, and ingenious problem-solving with morally complex characters.",
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

  const system = buildLibrarianSystemPrompt(profile, readTitles);
  const userQuery = "What should I read next? I want something fast-paced where the protagonist has to outsmart an impossible situation, but absolutely no boring exposition.";

  console.log(`👤 User: "${userQuery}"\n`);
  console.log("🤖 Librarian (streaming response with tool calling)...\n");
  console.log("------------------------------------------------------------------");

  const google = createGoogleGenerativeAI({ apiKey });

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system,
    tools: {
      lookup_book_cover: lookupBookCoverTool,
    },
    prompt: userQuery,
  });

  // Stream text directly to the console in real-time
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  console.log("\n------------------------------------------------------------------");
  console.log("\n✅ Streaming complete!");
}

run().catch(console.error);