/**
 * Database types for the tables the app reads directly.
 * Mirrors supabase/migrations. Regenerate with:
 *   npx supabase gen types typescript --project-id <id> --schema public > src/types/database.ts
 * (Scenarios are intentionally absent: clients have no direct access to them.)
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GameMode = 'classic' | 'endless' | 'review';
type Answer = 'ethical' | 'unethical';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          total_xp: number;
          player_level: number;
          highest_streak: number;
          current_difficulty: number;
          total_answered: number;
          total_correct: number;
          sessions_completed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: { username?: string; avatar_url?: string | null };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          color: string;
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      game_sessions: {
        Row: {
          id: string;
          user_id: string;
          game_mode: GameMode;
          session_status: 'active' | 'completed' | 'abandoned';
          score: number;
          correct_count: number;
          incorrect_count: number;
          current_streak: number;
          highest_streak: number;
          xp_earned: number;
          starting_difficulty: number;
          current_difficulty: number;
          max_difficulty: number;
          ending_difficulty: number | null;
          answers_since_adjustment: number;
          consecutive_incorrect: number;
          planned_length: number | null;
          served_scenario_ids: string[];
          category_results: Json;
          started_at: string;
          completed_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_answers: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          scenario_id: string;
          game_mode: GameMode;
          selected_answer: Answer;
          is_correct: boolean;
          points_earned: number;
          xp_earned: number;
          response_ms: number;
          difficulty_at_answer: number;
          answered_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_topic_stats: {
        Row: {
          user_id: string;
          category_id: string;
          total_answered: number;
          correct_count: number;
          incorrect_count: number;
          last_practiced_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_review_items: {
        Row: {
          user_id: string;
          scenario_id: string;
          last_selected_answer: Answer;
          times_missed: number;
          last_missed_at: string;
          review_status: 'pending' | 'reviewed';
          reviewed_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      scenario_reports: {
        Row: {
          id: string;
          user_id: string;
          scenario_id: string;
          reason: 'incorrect_answer' | 'ambiguous' | 'unclear' | 'offensive' | 'other';
          description: string | null;
          review_status: 'open' | 'resolved' | 'dismissed';
          created_at: string;
        };
        Insert: {
          user_id: string;
          scenario_id: string;
          reason: 'incorrect_answer' | 'ambiguous' | 'unclear' | 'offensive' | 'other';
          description?: string | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_review_items: {
        Args: Record<PropertyKey, never>;
        Returns: {
          scenario_id: string;
          category_id: string;
          scenario_text: string;
          difficulty_score: number;
          correct_answer: Answer;
          explanation: string;
          ethical_principles: string[];
          recommended_action: string | null;
          learning_objective: string | null;
          last_selected_answer: Answer;
          times_missed: number;
          last_missed_at: string;
          review_status: 'pending' | 'reviewed';
          reviewed_at: string | null;
        }[];
      };
      mark_review_item_reviewed: {
        Args: { p_scenario_id: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
