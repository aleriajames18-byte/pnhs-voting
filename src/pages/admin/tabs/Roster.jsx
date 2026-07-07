import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { supabase } from "../../../lib/supabaseClient";

const TEMP_PW = import.meta.env.VITE_DEFAULT_TEMP_PASSWORD || "PNHSvote2026";
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-roster`;
const PAGE = 100; // rows shown per page

export default function Roster() {
  const [voters, setVoters] = useState([]);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Fetch ALL voters in batches of 1000 (gets past Supabase's default row cap)
  const load = async () => {
    let all = [];
    let from = 0;
    const size = 1000;
    while (true) {
      const { data, error } = await supabase.from("voters")
        .select("lrn,full_name,grade_level,section,has_voted")
        .order("grade_level").order("section").order("full_name")
        .range(from, from + size - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < size) break;
      from += size;
    }
    setVoters(all);
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

  // Distinct grades/sections for the filter dropdowns
  const grades = useMemo(
    () => [...new Set(voters.map((v) => v.grade_level))].sort((a, b) => a - b),
    [voters]);
  const sections = useMemo(
    () => [...new Set(voters
      .filter((v) => !grade || String(v.grade_level) === grade)
      .map((v) => v.section))].sort(),
    [voters, grade]);

  const filtered = useMemo(() => voters.filter((v) =>
    (!q || v.lrn.includes(q) || (v.full_name || "").toLowerCase().includes(q.toLowerCase())) &&
    (!grade || String(v.grade_level) === grade) &&
    (!section || v.section === section)
  ), [voters, q, grade, section]);

  // reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [q, grade, section]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

  const downloadCSV = () => {
    const lines = [["lrn", "full_name", "grade_level", "section", "voted"]];
    for (const v of filtered)
      lines.push([v.lrn, v.full_name, v.grade_level, v.section, v.has_voted ? "yes" : "no"]);
    const csv = lines.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "voter-roster.csv"; a.click();
    URL.revokeObjectURL(url);
  };

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
          <h3>Registered voters — {voters.length} total</h3>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: ".75rem" }}>
          <input placeholder="Search by LRN or name…" value={q}
            onChange={(e) => setQ(e.target.value)} style={{ flex: 2, minWidth: 180 }} />
          <select value={grade} onChange={(e) => { setGrade(e.target.value); setSection(""); }}
            style={{ flex: 1, minWidth: 120 }}>
            <option value="">All grades</option>
            {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
          <select value={section} onChange={(e) => setSection(e.target.value)}
            style={{ flex: 1, minWidth: 120 }}>
            <option value="">All sections</option>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-outline" onClick={downloadCSV}
            style={{ minHeight: 44 }}>⬇ Export list</button>
        </div>

        <p className="muted" style={{ fontSize: ".85rem" }}>
          Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE + 1}
          –{Math.min(page * PAGE, filtered.length)} of {filtered.length} matching.
        </p>

        <div style={{ maxHeight: 520, overflow: "auto" }}>
          <table className="data">
            <thead><tr><th>#</th><th>LRN</th><th>Name</th><th>Grade</th><th>Section</th><th>Voted</th></tr></thead>
            <tbody>
              {pageRows.map((v, i) => (
                <tr key={v.lrn}>
                  <td className="muted">{(page - 1) * PAGE + i + 1}</td>
                  <td>{v.lrn}</td><td>{v.full_name}</td>
                  <td>{v.grade_level}</td><td>{v.section}</td>
                  <td>{v.has_voted ? "✓" : "—"}</td>
                </tr>
              ))}
              {pageRows.length === 0 && <tr><td colSpan="6" className="muted">No matching students.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", gap: ".5rem", alignItems: "center", marginTop: ".75rem", flexWrap: "wrap" }}>
            <button className="btn btn-outline" style={{ minHeight: 40 }}
              disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span className="muted">Page {page} of {pages}</span>
            <button className="btn btn-outline" style={{ minHeight: 40 }}
              disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        )}
      </div>
    </>
  );
}
