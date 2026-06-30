import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { getActiveElection } from "../../../lib/election";

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time
const toLocalInput = (iso) => {
  const d = new Date(iso); const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function Settings() {
  const [el, setEl] = useState(null);
  const [form, setForm] = useState({ title: "", starts_at: "", ends_at: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getActiveElection().then((e) => {
      setEl(e);
      if (e) setForm({
        title: e.title,
        starts_at: toLocalInput(e.starts_at),
        ends_at: toLocalInput(e.ends_at),
      });
    });
  }, []);

  const save = async () => {
    setBusy(true); setMsg("");
    const payload = {
      title: form.title,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
    };
    let error;
    if (el) ({ error } = await supabase.from("elections").update(payload).eq("id", el.id));
    else ({ error } = await supabase.from("elections").insert({ ...payload, is_active: true }));
    setBusy(false);
    setMsg(error ? "Error: " + error.message : "Saved.");
    if (!error) getActiveElection().then(setEl);
  };

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-header"><h3>Election Settings</h3></div>
      {msg && <div className="notice notice-info">{msg}</div>}
      <label>Election title</label>
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <label>Voting opens</label>
      <input type="datetime-local" value={form.starts_at}
        onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
      <label>Voting closes</label>
      <input type="datetime-local" value={form.ends_at}
        onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
      <button className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
