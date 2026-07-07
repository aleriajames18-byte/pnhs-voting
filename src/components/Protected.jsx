import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wrap voter-only routes
export function VoterRoute({ children }) {
  const { loading, profileReady, session, voter } = useAuth();
  if (loading || !profileReady) return <Loading />;      // wait for profile before deciding
  if (!session || !voter) return <Navigate to="/" replace />;
  return children;
}

// Wrap admin-only routes
export function AdminRoute({ children }) {
  const { loading, profileReady, session, isAdmin } = useAuth();
  if (loading || !profileReady) return <Loading />;
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}

function Loading() {
  return <div className="center-screen"><p className="muted">Loading…</p></div>;
}
