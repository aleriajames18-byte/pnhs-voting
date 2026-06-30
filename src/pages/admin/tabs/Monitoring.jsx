import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function Monitoring() {
  const [rows, setRows] = useState([]);
  const load = async () => {
    const { data } = await supabase.rpc("turnout_stats");
    setRows(data || []);
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // refresh live every 15s
    return () => clearInterval(t);
  }, []);

  const totalReg = rows.reduce((a, r) => a + Number(r.registered), 0);
  const totalVoted = rows.reduce((a, r) => a + Number(r.voted), 0);

  // group by grade
  const byGrade = {};
  for (const r of rows) {
    (byGrade[r.grade_level] ||= { reg: 0, voted: 0, sections: [] });
    byGrade[r.grade_level].reg += Number(r.registered);
    byGrade[r.grade_level].voted += Number(r.voted);
    byGrade[r.grade_level].sections.push(r);
  }

  const Bar = ({ voted, reg }) => {
    const pct = reg ? Math.round((voted / reg) * 100) : 0;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem" }}>
          <span>{voted}/{reg}</span><span className="muted">{pct}%</span>
        </div>
        <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
      </div>
    );
  };

  return (
    <>
      <div className="grid-2">
        <div className="stat"><div className="num">{totalVoted}</div><div className="lbl">Total ballots cast</div></div>
        <div className="stat"><div className="num">{totalReg ? Math.round(totalVoted / totalReg * 100) : 0}%</div><div className="lbl">Overall turnout</div></div>
      </div>
      <p className="muted" style={{ marginTop: ".5rem" }}>Auto-refreshes every 15 seconds. Candidate tallies are not shown here.</p>

      {Object.keys(byGrade).sort((a, b) => a - b).map((g) => (
        <div className="card" key={g}>
          <div className="card-header">
            <h3>Grade {g}</h3>
          </div>
          <Bar voted={byGrade[g].voted} reg={byGrade[g].reg} />
          <table className="data" style={{ marginTop: ".75rem" }}>
            <thead><tr><th>Section</th><th>Turnout</th></tr></thead>
            <tbody>
              {byGrade[g].sections.sort((a, b) => a.section.localeCompare(b.section)).map((s) => (
                <tr key={s.section}>
                  <td>{s.section}</td>
                  <td style={{ width: "60%" }}><Bar voted={Number(s.voted)} reg={Number(s.registered)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {rows.length === 0 && <div className="card">No voters loaded yet.</div>}
    </>
  );
}
