import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { getActiveElection } from "../../../lib/election";

export default function Overview() {
  const [el, setEl] = useState(null);
  const [stats, setStats] = useState({ registered: 0, voted: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const e = await getActiveElection();
    setEl(e);
    const { data: turnout } = await supabase.rpc("turnout_stats");
    const registered = (turnout || []).reduce((a, r) => a + Number(r.registered), 0);
    const voted = (turnout || []).reduce((a, r) => a + Number(r.voted), 0);
    setStats({ registered, voted });
  };
  useEffect(() => { load(); }, []);

  const togglePublish = async (val) => {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("publish_results", { p_publish: val });
    setBusy(false);
    if (error) setMsg("Could not update. " + error.message);
    else { setMsg(val ? "Results are now PUBLIC." : "Results hidden from public."); load(); }
  };

  if (!el) return <div className="card">No active election. Create one under Election Settings.</div>;

  const now = Date.now();
  const status = now < new Date(el.starts_at).getTime() ? "Not started"
    : now > new Date(el.ends_at).getTime() ? "Closed" : "OPEN";
  const pct = stats.registered ? Math.round((stats.voted / stats.registered) * 100) : 0;

  return (
    <>
      <div className="card">
        <div className="card-header"><h3>{el.title}</h3></div>
        <p><strong>Status:</strong> {status}</p>
        <p className="muted">Opens {new Date(el.starts_at).toLocaleString()} · Closes {new Date(el.ends_at).toLocaleString()}</p>
      </div>

      <div className="grid-2">
        <div className="stat"><div className="num">{stats.registered}</div><div className="lbl">Registered voters</div></div>
        <div className="stat"><div className="num">{stats.voted}</div><div className="lbl">Ballots cast ({pct}%)</div></div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header"><h3>Publish Results</h3></div>
        <p className="muted">Results stay private until you publish them. Publishing makes the
          public results page visible to everyone at once.</p>
        {msg && <div className="notice notice-info">{msg}</div>}
        <p><strong>Currently:</strong> {el.results_published ? "PUBLISHED (public)" : "Hidden"}</p>
        {el.results_published
          ? <button className="btn btn-outline" disabled={busy} onClick={() => togglePublish(false)}>Hide results</button>
          : <button className="btn btn-gold" disabled={busy} onClick={() => togglePublish(true)}>Publish results now</button>}
      </div>
    </>
  );
}
