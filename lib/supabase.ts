import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が設定されていません');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          goal: string;
          target_date: string;
          tasks_data: any;
          gantt_data: any;
          created_at: string;
          updated_at: string;
          last_modified_by: string;
          version: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          goal: string;
          target_date: string;
          tasks_data?: any;
          gantt_data?: any;
          created_at?: string;
          updated_at?: string;
          last_modified_by?: string;
          version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          goal?: string;
          target_date?: string;
          tasks_data?: any;
          gantt_data?: any;
          created_at?: string;
          updated_at?: string;
          last_modified_by?: string;
          version?: number;
        };
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: 'owner' | 'editor' | 'viewer';
          invited_by: string;
          invited_at: string;
          joined_at: string;
          status: 'pending' | 'accepted' | 'declined';
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role: 'owner' | 'editor' | 'viewer';
          invited_by?: string;
          invited_at?: string;
          joined_at?: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: 'owner' | 'editor' | 'viewer';
          invited_by?: string;
          invited_at?: string;
          joined_at?: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
        };
      };
      project_invitations: {
        Row: {
          id: string;
          project_id: string;
          email: string;
          role: 'editor' | 'viewer';
          invited_by: string;
          token: string;
          expires_at: string;
          created_at: string;
          used_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          email: string;
          role: 'editor' | 'viewer';
          invited_by: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
          used_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          email?: string;
          role?: 'editor' | 'viewer';
          invited_by?: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
          used_at?: string;
        };
      };
    };
  };
};