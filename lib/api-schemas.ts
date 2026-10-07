import { z } from "zod";
import { TasteProfileSchema } from "@/services/taste/schemas";

export { TasteProfileSchema };

/**
 * Message schema for chat requests conforming to Vercel AI SDK structure.
 */
export const ChatMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().optional(),
    parts: z.array(z.any()).optional(),
  })
  .passthrough();

/**
 * Request body schema for POST /api/chat.
 */
export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1, "At least one message is required"),
  tasteProfile: TasteProfileSchema.optional(),
  readBooks: z.array(z.string()).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * Request body schema for POST /api/quiz.
 */
export const QuizAnswersSchema = z.object({
  genres: z.array(z.string()).min(1, "Please select at least one preferred genre"),
  pacing: z.string().default("Engaging & Dynamic"),
  tone: z.array(z.string()).default([]),
  tropes: z.array(z.string()).default([]),
  dealbreakers: z.array(z.string()).default([]),
  anchorFavorites: z.string().optional(),
});

export const QuizRequestSchema = z.object({
  answers: QuizAnswersSchema,
  saveToProfile: z.boolean().optional().default(false),
});

export type QuizRequest = z.infer<typeof QuizRequestSchema>;
