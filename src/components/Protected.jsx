import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wrap voter-only routes
export function VoterRoute({ children }) {
  const { loading, session, voter } = useAuth();
  if (loading) return <Loading />;
  if (!session || !voter) return <Navigate to="/" replace />;
  return children;
}

// Wrap admin-only routes
export function AdminRoute({ children }) {
  const { loading, session, isAdmin } = useAuth();
  if (loading) return <Loading />;
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}

function Loading() {
  return <div className="center-screen"><p className="muted">Loading…</p></div>;
}
