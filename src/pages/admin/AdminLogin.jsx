import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminLogin() {
  const { loginWithEmail, isAdmin, loading, session } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session && isAdmin) nav("/admin", { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const error = await loginWithEmail(email, password);
    setBusy(false);
    if (error) setErr("Invalid email or password.");
    else nav("/admin", { replace: true });
  };

  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
        <h2 className="text-center">Election Committee Sign In</h2>
        {err && <div className="notice notice-error">{err}</div>}
        <form onSubmit={submit}>
          <label htmlFor="em">Admin email</label>
          <input id="em" type="email" autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn btn-primary btn-block" style={{ marginTop: "1rem" }}
            disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
