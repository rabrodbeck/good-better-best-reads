export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ShelfType = "read" | "currently-reading" | "to-read" | "did-not-finish";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          reading_goal: number;
          current_streak: number;
          taste_archetype: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          reading_goal?: number;
          current_streak?: number;
          taste_archetype?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          reading_goal?: number;
          current_streak?: number;
          taste_archetype?: string | null;
          updated_at?: string;
        };
      };
      books: {
        Row: {
          id: string;
          title: string;
          author: string;
          isbn: string | null;
          isbn13: string | null;
          cover_url: string | null;
          description: string | null;
          genres: string[];
          page_count: number | null;
          published_year: number | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          author: string;
          isbn?: string | null;
          isbn13?: string | null;
          cover_url?: string | null;
          description?: string | null;
          genres?: string[];
          page_count?: number | null;
          published_year?: number | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          author?: string;
          isbn?: string | null;
          isbn13?: string | null;
          cover_url?: string | null;
          description?: string | null;
          genres?: string[];
          page_count?: number | null;
          published_year?: number | null;
          embedding?: number[] | null;
        };
      };
      user_books: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          shelf: ShelfType;
          rating: number | null;
          date_read: string | null;
          user_review: string | null;
          user_shelves: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          shelf: ShelfType;
          rating?: number | null;
          date_read?: string | null;
          user_review?: string | null;
          user_shelves?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shelf?: ShelfType;
          rating?: number | null;
          date_read?: string | null;
          user_review?: string | null;
          user_shelves?: string[];
          updated_at?: string;
        };
      };
      taste_profiles: {
        Row: {
          id: string;
          user_id: string;
          archetype_name: string;
          archetype_summary: string;
          preferred_pacing: string | null;
          emotional_tone: string | null;
          taste_vector: number[] | null;
          top_tropes: string[];
          dealbreakers: string[];
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          archetype_name: string;
          archetype_summary: string;
          preferred_pacing?: string | null;
          emotional_tone?: string | null;
          taste_vector?: number[] | null;
          top_tropes?: string[];
          dealbreakers?: string[];
          updated_at?: string;
        };
        Update: {
          id?: string;
          archetype_name?: string;
          archetype_summary?: string;
          preferred_pacing?: string | null;
          emotional_tone?: string | null;
          taste_vector?: number[] | null;
          top_tropes?: string[];
          dealbreakers?: string[];
          updated_at?: string;
        };
      };
    };
    Functions: {
      match_books: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          filter_user_id?: string;
        };
        Returns: {
          id: string;
          title: string;
          author: string;
          cover_url: string | null;
          description: string | null;
          genres: string[];
          similarity: number;
        }[];
      };
    };
  };
}