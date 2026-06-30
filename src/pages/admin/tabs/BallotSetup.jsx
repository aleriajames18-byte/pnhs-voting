import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { getActiveElection } from "../../../lib/election";

const PHOTO_BUCKET = "candidate-photos";

export default function BallotSetup() {
  const [el, setEl] = useState(null);
  const [positions, setPositions] = useState([]);
  const [parties, setParties] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [msg, setMsg] = useState("");

  const refresh = async (election) => {
    const e = election || el;
    if (!e) return;
    const [{ data: pos }, { data: par }, { data: cand }] = await Promise.all([
      supabase.from("positions").select("*").eq("election_id", e.id).order("display_order"),
      supabase.from("parties").select("*").eq("election_id", e.id).order("name"),
      supabase.from("candidates").select("*, positions(title), parties(name)").order("display_order"),
    ]);
    setPositions(pos || []); setParties(par || []); setCandidates(cand || []);
  };

  useEffect(() => { getActiveElection().then((e) => { setEl(e); refresh(e); }); }, []);

  // ---- Positions ----
  const [np, setNp] = useState({ title: "", scope: "executive", grade_level: 7 });
  const addPosition = async () => {
    if (!el || !np.title) return;
    const payload = {
      election_id: el.id, title: np.title, scope: np.scope,
      grade_level: np.scope === "grade_rep" ? Number(np.grade_level) : null,
      display_order: positions.length + 1,
    };
    const { error } = await supabase.from("positions").insert(payload);
    setMsg(error ? error.message : "Position added.");
    setNp({ title: "", scope: "executive", grade_level: 7 });
    refresh();
  };
  const delPosition = async (id) => {
    if (!confirm("Delete this position and its candidates?")) return;
    await supabase.from("positions").delete().eq("id", id); refresh();
  };

  // ---- Parties ----
  const [npa, setNpa] = useState({ name: "", color: "#002D62" });
  const addParty = async () => {
    if (!el || !npa.name) return;
    const { error } = await supabase.from("parties")
      .insert({ election_id: el.id, name: npa.name, color: npa.color });
    setMsg(error ? error.message : "Party added.");
    setNpa({ name: "", color: "#002D62" }); refresh();
  };
  const delParty = async (id) => { await supabase.from("parties").delete().eq("id", id); refresh(); };

  // ---- Candidates ----
  const [nc, setNc] = useState({ position_id: "", party_id: "", full_name: "" });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const addCandidate = async () => {
    if (!nc.position_id || !nc.full_name) { setMsg("Pick a position and enter a name."); return; }
    setUploading(true); setMsg("");
    let photo_url = null;
    if (file) {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file);
      if (upErr) { setMsg("Photo upload failed: " + upErr.message); setUploading(false); return; }
      photo_url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("candidates").insert({
      position_id: nc.position_id,
      party_id: nc.party_id || null,
      full_name: nc.full_name,
      photo_url,
      display_order: candidates.filter((c) => c.position_id === nc.position_id).length + 1,
    });
    setUploading(false);
    setMsg(error ? error.message : "Candidate added.");
    setNc({ position_id: "", party_id: "", full_name: "" }); setFile(null);
    refresh();
  };
  const delCandidate = async (id) => { await supabase.from("candidates").delete().eq("id", id); refresh(); };

  if (!el) return <div className="card">Create an election first (Election Settings).</div>;

  return (
    <>
      {msg && <div className="notice notice-info">{msg}</div>}

      {/* Positions */}
      <div className="card">
        <div className="card-header"><h3>Positions</h3></div>
        <table className="data"><tbody>
          {positions.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td className="muted">{p.scope === "grade_rep" ? `Grade ${p.grade_level} rep` : "Executive"}</td>
              <td style={{ textAlign: "right" }}>
                <button className="btn btn-danger" style={{ minHeight: 36, padding: ".3rem .7rem" }}
                  onClick={() => delPosition(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody></table>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginTop: ".75rem", alignItems: "end" }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label>Title</label>
            <input value={np.title} onChange={(e) => setNp({ ...np, title: e.target.value })} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Type</label>
            <select value={np.scope} onChange={(e) => setNp({ ...np, scope: e.target.value })}>
              <option value="executive">Executive</option>
              <option value="grade_rep">Grade Rep</option>
            </select>
          </div>
          {np.scope === "grade_rep" && (
            <div style={{ width: 100 }}>
              <label>Grade</label>
              <select value={np.grade_level} onChange={(e) => setNp({ ...np, grade_level: e.target.value })}>
                {[7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={addPosition}>Add</button>
        </div>
      </div>

      {/* Parties */}
      <div className="card">
        <div className="card-header"><h3>Party Lists / Slates</h3></div>
        {parties.map((p) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: ".4rem",
            border: "1px solid var(--line)", borderRadius: 20, padding: ".3rem .7rem", margin: ".25rem" }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: p.color || "#888" }} />
            {p.name}
            <button className="link" style={{ color: "var(--danger)" }} onClick={() => delParty(p.id)}>✕</button>
          </span>
        ))}
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".75rem", alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <label>Party name</label>
            <input value={npa.name} onChange={(e) => setNpa({ ...npa, name: e.target.value })} />
          </div>
          <div>
            <label>Color</label>
            <input type="color" value={npa.color} style={{ padding: 4, width: 56 }}
              onChange={(e) => setNpa({ ...npa, color: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={addParty}>Add</button>
        </div>
      </div>

      {/* Candidates */}
      <div className="card">
        <div className="card-header"><h3>Candidates</h3></div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "end", marginBottom: "1rem" }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label>Full name</label>
            <input value={nc.full_name} onChange={(e) => setNc({ ...nc, full_name: e.target.value })} />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label>Position</label>
            <select value={nc.position_id} onChange={(e) => setNc({ ...nc, position_id: e.target.value })}>
              <option value="">— select —</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label>Party</label>
            <select value={nc.party_id} onChange={(e) => setNc({ ...nc, party_id: e.target.value })}>
              <option value="">Independent</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 150 }}>
            <label>Photo</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <button className="btn btn-primary" disabled={uploading} onClick={addCandidate}>
            {uploading ? "Saving…" : "Add candidate"}
          </button>
        </div>

        <table className="data">
          <thead><tr><th></th><th>Name</th><th>Position</th><th>Party</th><th></th></tr></thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>{c.photo_url
                  ? <img src={c.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                  : "—"}</td>
                <td>{c.full_name}</td>
                <td className="muted">{c.positions?.title}</td>
                <td className="muted">{c.parties?.name || "Independent"}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-danger" style={{ minHeight: 34, padding: ".25rem .6rem" }}
                    onClick={() => delCandidate(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
