import { z } from "zod";

export const TasteProfileSchema = z.object({
  archetype_name: z
    .string()
    .describe(
      "A punchy, evocative 2-4 word reader archetype title (e.g. 'The Atmospheric Speculative Explorer', 'The Gritty High-Stakes Realist', 'The Dark Suspense Enthusiast')"
    ),
  archetype_summary: z
    .string()
    .describe(
      "A compelling, highly personalized ~150-200 word narrative summary capturing their core taste: narrative voice, preferred pacing, emotional tone, character dynamics, and why they love the books they love."
    ),
  preferred_pacing: z
    .string()
    .describe("Their preferred reading tempo (e.g. 'Breakneck & Kinetic', 'Atmospheric Slow-Burn', 'Deliberate & Unfolding')"),
  emotional_tone: z
    .string()
    .describe("Dominant emotional tone (e.g. 'Gritty & Cynical', 'Tense & Paranoid', 'Hopeful & Expansive')"),
  top_tropes: z
    .array(z.string())
    .min(3)
    .max(6)
    .describe("3 to 6 narrative tropes or structural devices this reader consistently enjoys"),
  dealbreakers: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2 to 5 specific elements, cliches, or pacing styles this reader actively dislikes or avoids"),
});

export type TasteProfile = z.infer<typeof TasteProfileSchema>;