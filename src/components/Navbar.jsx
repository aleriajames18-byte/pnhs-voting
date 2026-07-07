import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LOGO = import.meta.env.VITE_SCHOOL_LOGO_URL || ""; // optional override

export default function Navbar() {
  const { session, voter, isAdmin, logout } = useAuth();
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {LOGO ? <img src={LOGO} alt="PNHS logo" /> : (
          <div aria-hidden style={{
            height: 40, width: 40, borderRadius: 6, background: "#fff", color: "#002D62",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: ".8rem",
          }}>PNHS</div>
        )}
        <div className="brand">
          Polanco National High School
          <small>Supreme Secondary Learner Government Elections</small>
        </div>
        <span className="spacer" />
        <Link to="/results">Results</Link>
        {session && <button className="link" onClick={logout}>
          Log out{voter ? ` (${voter.full_name})` : isAdmin ? " (Admin)" : ""}
        </button>}
      </div>
    </nav>
  );
}
