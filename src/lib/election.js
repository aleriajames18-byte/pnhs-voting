import { supabase } from "./supabaseClient";

export async function getActiveElection() {
  const { data } = await supabase
    .from("elections").select("*").eq("is_active", true).maybeSingle();
  return data;
}
