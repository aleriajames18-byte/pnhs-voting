import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../../lib/supabaseClient";
import { getActiveElection } from "../../../lib/election";

export default function ResultsExport() {
  const [rows, setRows] = useState([]);
  const [turnout, setTurnout] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    (async () => {
      const e = await getActiveElection();
      setTitle(e?.title || "PNHS Elections");
      const [{ data: res }, { data: tn }] = await Promise.all([
        supabase.rpc("get_results"),
        supabase.rpc("turnout_stats"),
      ]);
      setRows(res || []);
      setTurnout(tn || []);
    })();
  }, []);

  // group for display
  const byPos = {};
  for (const r of rows) {
    (byPos[r.position_title] ||= []).push(r);
  }

  const downloadCSV = () => {
    const lines = [["Position", "Candidate", "Party", "Votes"]];
    for (const r of rows)
      lines.push([r.position_title, r.candidate_name, r.party_name || "Independent", r.votes_count]);
    lines.push([]);
    lines.push(["Grade", "Section", "Registered", "Voted"]);
    for (const t of turnout)
      lines.push([t.grade_level, t.section, t.registered, t.voted]);
    const csv = lines.map((row) => row.map((c) =>
      `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    triggerDownload(new Blob([csv], { type: "text/csv" }), "pnhs-election-results.csv");
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFont("times", "bold"); doc.setFontSize(16);
    doc.text("Polanco National High School", 14, 18);
    doc.setFontSize(12); doc.setFont("times", "normal");
    doc.text(title, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 33);

    autoTable(doc, {
      startY: 40,
      head: [["Position", "Candidate", "Party", "Votes"]],
      body: rows.map((r) => [r.position_title, r.candidate_name, r.party_name || "Independent", r.votes_count]),
      styles: { font: "times", fontSize: 9 },
      headStyles: { fillColor: [0, 45, 98] },
    });
    autoTable(doc, {
      head: [["Grade", "Section", "Registered", "Voted"]],
      body: turnout.map((t) => [t.grade_level, t.section, t.registered, t.voted]),
      styles: { font: "times", fontSize: 9 },
      headStyles: { fillColor: [0, 45, 98] },
    });
    doc.save("pnhs-election-results.pdf");
  };

  return (
    <>
      <div className="card">
        <div className="card-header"><h3>Official Results (admin view)</h3></div>
        <p className="muted">Live tallies, visible to admins only. Use Overview → Publish to release to the public.</p>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <button className="btn btn-outline" onClick={downloadCSV}>⬇ Export CSV</button>
          <button className="btn btn-outline" onClick={downloadPDF}>⬇ Export PDF</button>
        </div>
      </div>

      {Object.entries(byPos).map(([pos, items]) => {
        const total = items.reduce((a, r) => a + Number(r.votes_count), 0);
        const sorted = [...items].sort((a, b) => b.votes_count - a.votes_count);
        return (
          <div className="card" key={pos}>
            <h3 className="position-title">{pos}</h3>
            {sorted.map((r, i) => {
              const pct = total ? Math.round(r.votes_count / total * 100) : 0;
              return (
                <div key={i} style={{ margin: ".5rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: i === 0 && r.votes_count > 0 ? 700 : 400 }}>
                      {i === 0 && r.votes_count > 0 ? "★ " : ""}{r.candidate_name}
                      {r.party_name && <span className="cand-party"> · {r.party_name}</span>}
                    </span>
                    <span className="muted">{r.votes_count} ({pct}%)</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
