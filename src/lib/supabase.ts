import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Warn the developer but provide a safe stub so the UI can render without crashing.
  console.warn("Supabase environment variables are not set. Add them to .env");
}

// Export a real client only when variables are present; otherwise export a safe stub
export const supabase: SupabaseClient | any = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : {
      // minimal stub used only to prevent runtime exceptions in the UI when no config
      from: () => ({
        select: async () => ({
          data: null,
          error: new Error("Supabase not configured"),
        }),
        insert: async () => ({
          data: null,
          error: new Error("Supabase not configured"),
        }),
        update: async () => ({
          data: null,
          error: new Error("Supabase not configured"),
        }),
        delete: async () => ({
          data: null,
          error: new Error("Supabase not configured"),
        }),
      }),
      channel: () => ({
        on: () => ({ subscribe: async () => ({}) }),
        unsubscribe: async () => ({}),
      }),
    };
