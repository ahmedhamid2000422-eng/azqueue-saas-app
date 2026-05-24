import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import IslamicBar from "../../components/IslamicBar";
import DeepWork from "./DeepWork";
import Tasks from "./Tasks";
import Docs from "./Docs";
import AIAssist from "./AIAssist";
import Schedule from "./Schedule";

const NAV = [
  { label: "Deep Work", path: "" },
  { label: "Tasks",     path: "/tasks" },
  { label: "Docs",      path: "/docs" },
  { label: "AI Assist", path: "/ai" },
  { label: "Schedule",  path: "/schedule" },
];

export default function PersonalDashboard() {
  const [islamic] = useState(true);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        mode="personal"
        items={NAV}
        footerName="Ahmed"
        footerRole="Personal flow"
      />
      <main className="flex-1 flex flex-col">
        <IslamicBar enabled={islamic} />
        <div className="flex-1">
          <Routes>
            <Route index element={<DeepWork />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="docs" element={<Docs />} />
            <Route path="ai" element={<AIAssist />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
