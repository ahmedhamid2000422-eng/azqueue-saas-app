import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import StaffQueue from "./StaffQueue";
import StaffWaiting from "./StaffWaiting";
import StaffInsights from "./StaffInsights";
import StaffSettings from "./StaffSettings";
import { useStaffMembership } from "../../hooks/useStaffMembership";

/**
 * StaffDashboard — routing shell for staff members.
 *
 * Accessible pages:
 *   · Queue    — serve customers (the original single-page flow)
 *   · Waiting  — see who's in the queue right now
 *   · Insights — branch-level metrics (no per-staff comparisons)
 *   · Settings — profile, password, notifications, station
 *
 * Manager-only features (staff management, branches, billing)
 * are NOT exposed here — those live in the business owner Dashboard.
 */

const NAV = [
  { label: "Queue",    path: "" },
  { label: "Waiting",  path: "/waiting" },
  { label: "Insights", path: "/insights" },
  { label: "Settings", path: "/settings" },
];

export default function StaffDashboard() {
  const { primary } = useStaffMembership();
  return (
    <div className="flex min-h-screen">
      <Sidebar
        mode="staff"
        items={NAV}
        footerName={primary?.display_name ?? "Staff"}
        footerRole={primary?.branches?.name ?? "Staff mode"}
      />
      <main className="flex-1 flex flex-col">
        <div className="flex-1">
          <Routes>
            <Route index element={<StaffQueue />} />
            <Route path="waiting"  element={<StaffWaiting />} />
            <Route path="insights" element={<StaffInsights />} />
            <Route path="settings" element={<StaffSettings />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
