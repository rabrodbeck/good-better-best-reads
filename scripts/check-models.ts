import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("❌ No API key found in .env.local");
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    console.error("API Error:", data.error);
    return;
  }

  console.log("📐 Available Embedding Models on your Key (supporting embedContent):");
  const embedModels = (data.models || []).filter((m: any) =>
    m.supportedGenerationMethods?.includes("embedContent")
  );
  
  embedModels.forEach((m: any) => {
    console.log(` - ${m.name.replace("models/", "")}`);
  });
}

listModels().catch(console.error);