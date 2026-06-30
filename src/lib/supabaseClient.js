import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Surfaced clearly during setup rather than failing silently.
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.");
}

export const supabase = createClient(url, anon);

// Students log in with an LRN; Supabase Auth needs an email, so we map
// the LRN to a synthetic internal address (kept identical to the Edge Function).
export const EMAIL_DOMAIN = "voters.polanconhs.local";
export const lrnToEmail = (lrn) => `${String(lrn).trim()}@${EMAIL_DOMAIN}`;
