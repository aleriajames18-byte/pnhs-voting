import { useState } from "react";
import Overview from "./tabs/Overview";
import Settings from "./tabs/Settings";
import Roster from "./tabs/Roster";
import BallotSetup from "./tabs/BallotSetup";
import Monitoring from "./tabs/Monitoring";
import ResultsExport from "./tabs/ResultsExport";
import ResetBallot from "./tabs/ResetBallot";

const TABS = [
  ["overview", "Overview", Overview],
  ["settings", "Election Settings", Settings],
  ["roster", "Voters / Roster", Roster],
  ["ballot", "Ballot Setup", BallotSetup],
  ["monitor", "Turnout", Monitoring],
  ["results", "Results & Export", ResultsExport],
  ["reset", "Reset Ballot", ResetBallot],
];

export default function Dashboard() {
  const [tab, setTab] = useState("overview");
  const Active = TABS.find((t) => t[0] === tab)[2];
  return (
    <div className="container-wide">
      <h1>Admin Dashboard</h1>
      <div className="admin-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      <Active />
    </div>
  );
}
