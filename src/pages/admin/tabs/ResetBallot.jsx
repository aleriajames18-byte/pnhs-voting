import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function ResetBallot() {
  const [lrn, setLrn] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState(null);   // {type, text}
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  const loadLog = async () => {
    const { data } = await supabase.from("ballot_reset_log")
      .select("voter_lrn,reason,created_at").order("created_at", { ascending: false }).limit(50);
    setLog(data || []);
  };
  useEffect(() => { loadLog(); }, []);

  const doReset = async () => {
    if (!lrn) return;
    if (!confirm(`Reset the ballot for LRN ${lrn}? This permanently deletes their submitted votes and lets them vote again.`)) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("reset_ballot", { p_lrn: lrn.trim(), p_reason: reason || null });
    setBusy(false);
    if (error) {
      const m = error.message.includes("VOTER_NOT_FOUND") ? "No voter found with that LRN." : error.message;
      setMsg({ type: "error", text: m });
    } else {
      setMsg({ type: "success", text: `Ballot reset for LRN ${lrn}. The rightful student may now log in and vote.` });
      setLrn(""); setReason(""); loadLog();
    }
  };

  return (
    <>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header"><h3>Reset Student Ballot</h3></div>
        <p className="muted">For disputes (e.g. an LRN was used without permission). This deletes the
          student's submitted votes, clears their <code>has_voted</code> flag, and records the action
          in the audit log below. It never reveals how anyone voted.</p>
        {msg && <div className={`notice notice-${msg.type === "error" ? "error" : "success"}`}>{msg.text}</div>}
        <label>Student LRN</label>
        <input value={lrn} onChange={(e) => setLrn(e.target.value)} placeholder="e.g. 136750120001" />
        <label>Reason (recorded in audit log)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Student reported unauthorized vote" />
        <button className="btn btn-danger" style={{ marginTop: "1rem" }} disabled={busy} onClick={doReset}>
          {busy ? "Resetting…" : "Reset ballot"}
        </button>
      </div>

      <div className="card">
        <div className="card-header"><h3>Reset audit log</h3></div>
        <table className="data">
          <thead><tr><th>When</th><th>LRN</th><th>Reason</th></tr></thead>
          <tbody>
            {log.map((r, i) => (
              <tr key={i}>
                <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.voter_lrn}</td>
                <td>{r.reason || "—"}</td>
              </tr>
            ))}
            {log.length === 0 && <tr><td colSpan="3" className="muted">No resets yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
