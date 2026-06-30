import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import { VoterRoute, AdminRoute } from "./components/Protected";

import Login from "./pages/Login";
import Ballot from "./pages/Ballot";
import Results from "./pages/Results";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/Dashboard";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/vote" element={<VoterRoute><Ballot /></VoterRoute>} />
        <Route path="/results" element={<Results />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        <Route path="*" element={<Login />} />
      </Routes>
    </>
  );
}
