import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, lrnToEmail } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [voter, setVoter] = useState(null);       // voters row, if a student
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);     // initial boot
  const [profileReady, setProfileReady] = useState(false); // profile resolved for current session

  const loadProfile = useCallback(async (sess) => {
    setProfileReady(false);
    if (!sess?.user) { setVoter(null); setIsAdmin(false); setProfileReady(true); return; }
    const [{ data: v }, { data: admin }] = await Promise.all([
      supabase.from("voters").select("*").eq("id", sess.user.id).maybeSingle(),
      supabase.from("admin_users").select("id").eq("id", sess.user.id).maybeSingle(),
    ]);
    setVoter(v ?? null);
    setIsAdmin(!!admin);
    setProfileReady(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, sess) => {
      setSession(sess);
      await loadProfile(sess);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  // Student login: LRN + password
  const loginWithLrn = async (lrn, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: lrnToEmail(lrn), password,
    });
    return error;
  };

  // Admin login: real email + password
  const loginWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const logout = async () => { await supabase.auth.signOut(); };
  const refreshVoter = async () => { await loadProfile(session); };

  return (
    <AuthContext.Provider value={{
      session, voter, isAdmin, loading, profileReady,
      loginWithLrn, loginWithEmail, logout, refreshVoter,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
