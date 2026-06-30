import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Groups the flat get_results() rows into positions -> candidates
function groupResults(rows) {
  const byPos = new Map();
  for (const r of rows) {
    if (!byPos.has(r.position_id))
      byPos.set(r.position_id, { id: r.position_id, title: r.position_title, scope: r.scope, total: 0, items: [] });
    const p = byPos.get(r.position_id);
    p.items.push({ name: r.candidate_name, party: r.party_name, votes: Number(r.votes_count) });
    p.total += Number(r.votes_count);
  }
  return [...byPos.values()];
}

export default function Results() {
  const [state, setState] = useState("loading"); // loading|published|locked|none
  const [positions, setPositions] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    (async () => {
      const { data: el } = await supabase
        .from("elections").select("title,results_published,is_active")
        .eq("is_active", true).maybeSingle();
      if (!el) { setState("none"); return; }
      setTitle(el.title);
      if (!el.results_published) { setState("locked"); return; }

      const { data, error } = await supabase.rpc("get_results");
      if (error) { setState("locked"); return; }
      const grouped = groupResults(data || []);
      grouped.forEach((p) => p.items.sort((a, b) => b.votes - a.votes));
      setPositions(grouped);
      setState("published");
    })();
  }, []);

  if (state === "loading") return <div className="center-screen"><p className="muted">Loading results…</p></div>;
  if (state === "none")
    return <div className="center-screen"><Card title="No election" body="There is no active election." /></div>;
  if (state === "locked")
    return <div className="center-screen">
      <Card title="Results not yet published"
        body="The election committee has not released the results yet. Please check back later." />
    </div>;

  return (
    <div className="container">
      <h1>Official Results</h1>
      <p className="muted">{title}</p>
      {positions.map((p) => (
        <div className="card" key={p.id}>
          <h3 className="position-title">{p.title}</h3>
          {p.items.map((it, i) => {
            const pct = p.total ? Math.round((it.votes / p.total) * 100) : 0;
            const winner = i === 0 && it.votes > 0;
            return (
              <div key={i} style={{ margin: ".55rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: winner ? 700 : 400 }}>
                    {winner && "★ "}{it.name}
                    {it.party && <span className="cand-party"> · {it.party}</span>}
                  </span>
                  <span className="muted">{it.votes} ({pct}%)</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
              </div>
            );
          })}
          <div className="muted" style={{ fontSize: ".8rem", marginTop: ".4rem" }}>
            Total ballots for this position: {p.total}
          </div>
        </div>
      ))}
    </div>
  );
}

const Card = ({ title, body }) => (
  <div className="card big-state" style={{ maxWidth: 480 }}>
    <div className="mark">📊</div><h2>{title}</h2><p className="muted">{body}</p>
  </div>
);
