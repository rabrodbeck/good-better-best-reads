export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ShelfType = "read" | "currently-reading" | "to-read" | "did-not-finish";

export type NotificationType =
  | "friend_recommendation"
  | "goal_milestone"
  | "monthly_recap"
  | "weekend_nudge"
  | "system";

export interface NotificationPreferences {
  friend_recommendations: boolean;
  goal_milestones: boolean;
  monthly_recaps: boolean;
  weekend_nudges: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  friend_recommendations: true,
  goal_milestones: true,
  monthly_recaps: true,
  weekend_nudges: true,
};

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
          notification_preferences: NotificationPreferences;
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
          notification_preferences?: NotificationPreferences;
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
          notification_preferences?: NotificationPreferences;
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
      book_recommendations: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          book_id: string;
          note: string | null;
          status: "unread" | "read" | "accepted" | "dismissed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          book_id: string;
          note?: string | null;
          status?: "unread" | "read" | "accepted" | "dismissed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          book_id?: string;
          note?: string | null;
          status?: "unread" | "read" | "accepted" | "dismissed";
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          data: Json | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          data?: Json | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string;
          data?: Json | null;
          read?: boolean;
          created_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
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