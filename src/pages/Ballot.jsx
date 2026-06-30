import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const ABSTAIN = "__abstain__";

export default function Ballot() {
  const { voter, refreshVoter } = useAuth();
  const [election, setElection] = useState(null);
  const [positions, setPositions] = useState([]);
  const [candidatesByPos, setCandidatesByPos] = useState({});
  const [selections, setSelections] = useState({});   // position_id -> candidate_id | ABSTAIN
  const [stage, setStage] = useState("loading");        // loading|vote|review|done
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // ---- Load election + eligible ballot ----
  useEffect(() => {
    (async () => {
      const { data: el } = await supabase
        .from("elections").select("*").eq("is_active", true).maybeSingle();
      setElection(el);
      if (!el || !voter) { setStage("vote"); return; }

      const { data: pos } = await supabase
        .from("positions").select("*")
        .eq("election_id", el.id)
        .order("display_order");

      // Conditional ballot: executives for everyone + own grade rep only
      const eligible = (pos || []).filter(
        (p) => p.scope === "executive" ||
               (p.scope === "grade_rep" && p.grade_level === voter.grade_level)
      );
      setPositions(eligible);

      const ids = eligible.map((p) => p.id);
      if (ids.length) {
        const { data: cands } = await supabase
          .from("candidates").select("*, parties(name,color)")
          .in("position_id", ids)
          .order("display_order");
        const grouped = {};
        for (const c of cands || []) (grouped[c.position_id] ||= []).push(c);
        setCandidatesByPos(grouped);
      }
      setStage("vote");
    })();
  }, [voter]);

  const windowState = useMemo(() => {
    if (!election) return "none";
    const now = Date.now();
    if (now < new Date(election.starts_at).getTime()) return "not_started";
    if (now > new Date(election.ends_at).getTime()) return "closed";
    return "open";
  }, [election]);

  const allAnswered = positions.length > 0 &&
    positions.every((p) => selections[p.id] !== undefined);

  const choose = (posId, value) =>
    setSelections((s) => ({ ...s, [posId]: value }));

  const submit = async () => {
    setBusy(true); setErr("");
    const payload = positions.map((p) => ({
      position_id: p.id,
      candidate_id: selections[p.id] === ABSTAIN ? null : selections[p.id],
    }));
    const { error } = await supabase.rpc("cast_ballot", { p_selections: payload });
    setBusy(false);
    if (error) {
      const m = error.message || "";
      if (m.includes("ALREADY_VOTED")) { await refreshVoter(); return; }
      if (m.includes("VOTING_CLOSED")) { setErr("Voting has closed. Your ballot was not recorded."); return; }
      if (m.includes("VOTING_NOT_STARTED")) { setErr("Voting has not started yet."); return; }
      setErr("Something went wrong submitting your ballot. Please try again.");
      return;
    }
    await refreshVoter();
    setStage("done");
  };

  // ---------------- States ----------------
  if (stage === "loading") return <Center><p className="muted">Loading your ballot…</p></Center>;

  // Already voted (firm lock)
  if (voter?.has_voted && stage !== "done") {
    return (
      <Center>
        <div className="card big-state" style={{ maxWidth: 480 }}>
          <div className="mark">🔒</div>
          <h2>You have already cast your vote.</h2>
          <p className="muted">Your ballot is final and has been securely recorded.
            If you believe this is an error, please contact the election committee.</p>
        </div>
      </Center>
    );
  }

  if (stage === "done") {
    return (
      <Center>
        <div className="card big-state" style={{ maxWidth: 480 }}>
          <div className="mark" style={{ color: "var(--success)" }}>✓</div>
          <h2>Thank you for voting!</h2>
          <p className="muted">Your ballot has been recorded. Results will be published by
            the election committee after voting closes.</p>
        </div>
      </Center>
    );
  }

  if (windowState === "none")
    return <Center><Info title="No active election" body="There is no election open at this time." /></Center>;
  if (windowState === "not_started")
    return <Center><Info title="Voting has not started"
      body={`Polls open ${fmt(election.starts_at)}. Please come back then.`} /></Center>;
  if (windowState === "closed")
    return <Center><Info title="Voting has closed"
      body="The voting window is over. Thank you for your interest." /></Center>;

  // ---------------- Review ----------------
  if (stage === "review") {
    return (
      <div className="container">
        <h2>Review your ballot</h2>
        <div className="notice notice-info">
          Please review carefully. <strong>Once submitted, your votes are final and cannot be changed.</strong>
        </div>
        {err && <div className="notice notice-error">{err}</div>}
        {positions.map((p) => {
          const sel = selections[p.id];
          const cand = sel === ABSTAIN ? null : (candidatesByPos[p.id] || []).find((c) => c.id === sel);
          return (
            <div className="card" key={p.id} style={{ padding: ".8rem 1rem" }}>
              <div className="muted" style={{ fontSize: ".85rem" }}>{p.title}</div>
              <div style={{ fontWeight: 600 }}>
                {cand ? cand.full_name : <em className="muted">Abstain</em>}
                {cand?.parties?.name && <span className="cand-party"> — {cand.parties.name}</span>}
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: ".75rem", marginTop: "1rem" }}>
          <button className="btn btn-outline" onClick={() => setStage("vote")} disabled={busy}>
            ← Go back & edit
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Submit final ballot"}
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Vote ----------------
  return (
    <div className="container">
      <div className="card-header">
        <h2>{election?.title}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {voter && `Grade ${voter.grade_level} — ${voter.section}`} · Choose one option per position.
          You may select <strong>Abstain</strong> for any office.
        </p>
      </div>
      {err && <div className="notice notice-error">{err}</div>}

      {positions.map((p) => {
        const cands = candidatesByPos[p.id] || [];
        return (
          <div className="position-block" key={p.id}>
            <h3 className="position-title">{p.title}</h3>
            {cands.map((c) => (
              <label key={c.id}
                className={"candidate-option" + (selections[p.id] === c.id ? " selected" : "")}>
                <input type="radio" name={p.id}
                  checked={selections[p.id] === c.id}
                  onChange={() => choose(p.id, c.id)} />
                {c.photo_url
                  ? <img src={c.photo_url} alt="" />
                  : <img alt="" src={placeholder(c.full_name)} />}
                <span>
                  <span className="cand-name">{c.full_name}</span>
                  {c.parties?.name && <span className="cand-party"> · {c.parties.name}</span>}
                </span>
              </label>
            ))}
            <label className={"candidate-option abstain" + (selections[p.id] === ABSTAIN ? " selected" : "")}>
              <input type="radio" name={p.id}
                checked={selections[p.id] === ABSTAIN}
                onChange={() => choose(p.id, ABSTAIN)} />
              <span className="cand-name">None / Abstain</span>
            </label>
          </div>
        );
      })}

      <button className="btn btn-primary btn-block" style={{ marginTop: ".5rem" }}
        disabled={!allAnswered} onClick={() => { setErr(""); setStage("review"); }}>
        {allAnswered ? "Review my ballot →" : "Answer every position to continue"}
      </button>
    </div>
  );
}

const Center = ({ children }) => <div className="center-screen">{children}</div>;
const Info = ({ title, body }) => (
  <div className="card big-state" style={{ maxWidth: 480 }}>
    <div className="mark">🗳️</div><h2>{title}</h2><p className="muted">{body}</p>
  </div>
);
const fmt = (d) => new Date(d).toLocaleString();
const placeholder = (name) =>
  `data:image/svg+xml;utf8,` + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#eaf0fa"/><text x="50%" y="55%" font-size="22" fill="#002D62" text-anchor="middle" dominant-baseline="middle" font-family="Georgia">${(name || "?")[0]}</text></svg>`
  );
