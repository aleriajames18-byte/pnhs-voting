import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { loginWithLrn, session, voter, loading } = useAuth();
  const nav = useNavigate();
  const [lrn, setLrn] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  // Already signed in as a student -> go to ballot (which handles voted/closed states)
  if (!loading && session && voter) { nav("/vote", { replace: true }); }

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const error = await loginWithLrn(lrn, password);
    setBusy(false);
    if (error) {
      setErr("Invalid LRN or password. Please check and try again.");
    } else {
      nav("/vote", { replace: true });
    }
  };

  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
        <div className="text-center" style={{ marginBottom: ".5rem" }}>
          {logoOk ? (
            <img src="/logo.png" alt="Polanco National High School logo"
              onError={() => setLogoOk(false)}
              style={{ margin: "0 auto .6rem", height: 80, width: 80,
                objectFit: "contain", display: "block" }} />
          ) : (
            <div aria-hidden style={{
              margin: "0 auto .6rem", height: 64, width: 64, borderRadius: 10,
              background: "var(--navy)", color: "#fff", display: "flex",
              alignItems: "center", justifyContent: "center", fontWeight: 700,
            }}>PNHS</div>
          )}
          <h2>Student Login</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Enter your Learner Reference Number to cast your ballot.
          </p>
        </div>

        {err && <div className="notice notice-error">{err}</div>}

        <form onSubmit={submit}>
          <label htmlFor="lrn">Learner Reference Number (LRN)</label>
          <input id="lrn" type="text" inputMode="numeric" autoComplete="username"
            value={lrn} onChange={(e) => setLrn(e.target.value)}
            placeholder="e.g. 136750120001" required />

          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Temporary password" required />

          <button className="btn btn-primary btn-block" style={{ marginTop: "1rem" }}
            disabled={busy} type="submit">
            {busy ? "Signing in…" : "Log in to vote"}
          </button>
        </form>

        <p className="text-center muted" style={{ marginTop: "1rem", fontSize: ".85rem" }}>
          Election committee? <Link to="/admin/login">Admin sign in</Link>
        </p>
      </div>
    </div>
  );
}
