const SUPABASE_URL =
  "https://hxwnooejcqjfzsujsaqo.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_8MOxj_DGt_E3PYQuzjvH2A_GWqB5ivF";

window.supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
