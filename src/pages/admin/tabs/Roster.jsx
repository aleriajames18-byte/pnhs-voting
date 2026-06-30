import { useEffect, useState } from "react";
import Papa from "papaparse";
import { supabase } from "../../../lib/supabaseClient";

const TEMP_PW = import.meta.env.VITE_DEFAULT_TEMP_PASSWORD || "PNHSvote2026";
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-roster`;

export default function Roster() {
  const [voters, setVoters] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("voters")
      .select("lrn,full_name,grade_level,section,has_voted")
      .order("grade_level").order("section").limit(3000);
    setVoters(data || []);
  };
  useEffect(() => { load(); }, []);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const rows = res.data.map((r) => ({
          lrn: r.lrn || r.LRN,
          full_name: r.full_name || r.name || r.Name,
          grade_level: r.grade_level || r.grade || r.Grade,
          section: r.section || r.Section,
        })).filter((r) => r.lrn);
        await runImport(rows);
      },
    });
  };

  const runImport = async (rows) => {
    setBusy(true); setMsg(`Importing ${rows.length} students…`);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rows, temp_password: TEMP_PW }),
      });
      const out = await resp.json();
      if (out.error) setMsg("Error: " + out.error);
      else setMsg(`Imported ${out.created}. Failed ${out.failed}.` +
        (out.failed ? " First issue: " + (out.errors[0]?.reason || "") : ""));
      load();
    } catch (err) {
      setMsg("Request failed: " + err);
    }
    setBusy(false);
  };

  const filtered = voters.filter((v) =>
    !q || v.lrn.includes(q) || (v.full_name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="card">
        <div className="card-header"><h3>Import voter roster (CSV)</h3></div>
        <p className="muted">CSV columns: <code>lrn, full_name, grade_level, section</code>.
          Each student gets an account with the shared temporary password
          (<strong>{TEMP_PW}</strong>).</p>
        {msg && <div className="notice notice-info">{msg}</div>}
        <input type="file" accept=".csv" onChange={onFile} disabled={busy} />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Registered voters ({voters.length})</h3>
        </div>
        <input placeholder="Search by LRN or name…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ marginBottom: ".75rem" }} />
        <div style={{ maxHeight: 420, overflow: "auto" }}>
          <table className="data">
            <thead><tr><th>LRN</th><th>Name</th><th>Grade</th><th>Section</th><th>Voted</th></tr></thead>
            <tbody>
              {filtered.slice(0, 500).map((v) => (
                <tr key={v.lrn}>
                  <td>{v.lrn}</td><td>{v.full_name}</td>
                  <td>{v.grade_level}</td><td>{v.section}</td>
                  <td>{v.has_voted ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 500 && <p className="muted">Showing first 500 of {filtered.length}. Refine your search.</p>}
        </div>
      </div>
    </>
  );
}
