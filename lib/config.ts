// Supabase mode turns on when both public env vars are set; otherwise CareRide runs on the demo store.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isSupabaseMode = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
