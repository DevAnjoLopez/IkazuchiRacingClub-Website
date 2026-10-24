const SUPABASE_URL = "https://rctocypwphmwlmnbxotl.supabase.co"; // Project URL, not the REST API URL.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjdG9jeXB3cGhtd2xtbmJ4b3RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MDY0NTIsImV4cCI6MjEwNzE4MjQ1Mn0.8rzHUdMGUWiuscRvc3M8Xq3oP6kn3FokDAscQSOTAno";

let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
} catch (err) {
  console.error("Supabase isn't configured yet:", err);
}
