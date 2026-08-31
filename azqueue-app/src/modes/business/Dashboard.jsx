import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProductTour, { TourInvite, hasSeenTour, isSnoozed, snoozeTour } from "../../components/ProductTour";
import Sidebar from "../../components/Sidebar";
import IslamicBar from "../../components/IslamicBar";
import AiAssistDock from "../../components/AiAssistDock";
import Topbar from "../../components/Topbar";
import { useBranch } from "../../lib/BranchContext";
import Queue from "./Queue";
import Classes from "./Classes";
import Bookings from "./Bookings";
import Schedule from "./Schedule";
import Insights from "./Insights";
import Manager from "./Manager";
import Stations from "./Stations";
import Customers from "./Customers";
import Leads from "./Leads";
import DisplaySetup from "./DisplaySetup";
import Settings from "./Settings";
import Onboarding from "./Onboarding";
import StaffProfile from "./StaffProfile";
import Reviews from "./Reviews";
import OwnerDashboard from "./OwnerDashboard";
import ClientIntelligence from "./ClientIntelligence";

const QUEUE_NAV = [
  { label: "Overview",  path: "/overview" },
  { label: "Queue",    path: "" },
  { label: "Bookings", path: "/bookings" },
  { label: "Schedule", path: "/schedule" },
  { label: "Stations",  path: "/stations",  badge: "OPS" },
  { label: "Customers", path: "/customers", badge: "NEW" },
  { label: "Leads",     path: "/leads",     badge: "WA" },
  { label: "Insights",  path: "/insights" },
  { label: "Reviews",   path: "/reviews" },
  { label: "Intel",    path: "/intelligence", badge: "AI" },
  { label: "Manager",  path: "/manager", badge: "PRO" },
  { label: "Display",  path: "/display" },
  { label: "Settings", path: "/settings" },
];

const GYM_NAV = [
  { label: "Overview",  path: "/overview" },
  { label: "Classes",   path: "" },
  { label: "Bookings",  path: "/bookings" },
  { label: "Schedule",  path: "/schedule" },
  { label: "Students",  path: "/customers", badge: "NEW" },
  { label: "Leads",     path: "/leads",     badge: "WA" },
  { label: "Insights",  path: "/insights" },
  { label: "Manager",   path: "/manager", badge: "PRO" },
  { label: "Display",   path: "/display" },
  { label: "Settings",  path: "/settings" },
];

export default function BusinessDashboard() {
  const [islamic] = useState(true);
  const { branch } = useBranch();
  const isGym = branch?.business_type === "gym";

  /* Tour state. The invite reappears on every fresh sign-in until someone
     actually completes the tour — closing it only snoozes for this visit. */
  const [touring, setTouring] = useState(false);
  const [invite,  setInvite]  = useState(false);

  useEffect(() => {
    if (!branch?.id) return;
    // Small delay so the page has painted — an offer that appears mid-load
    // reads as an error dialog and gets dismissed on reflex.
    const t = setTimeout(() => {
      if (!hasSeenTour() && !isSnoozed()) setInvite(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [branch?.id]);

  /* "Take the tour" in the user menu. An event rather than prop-drilling
     through Topbar, which knows nothing about the tour and shouldn't. */
  useEffect(() => {
    const start = () => { setInvite(false); setTouring(true); };
    window.addEventListener("azq:start-tour", start);
    return () => window.removeEventListener("azq:start-tour", start);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        mode="business"
        items={isGym ? GYM_NAV : QUEUE_NAV}
        footerName="Owner"
        footerRole={isGym ? "Gym mode" : "Business mode"}
      />
      <main className="flex-1 flex flex-col">
        <Topbar />
        <IslamicBar enabled={islamic} />
        <div className="flex-1">
          <Routes>
            <Route index element={isGym ? <Classes /> : <Queue />} />
            <Route path="overview"   element={<OwnerDashboard />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="stations"   element={<Stations />} />
            <Route path="customers"  element={<Customers />} />
            <Route path="leads"      element={<Leads />} />
            <Route path="insights"   element={<Insights />} />
            <Route path="reviews"       element={<Reviews />} />
            <Route path="intelligence" element={<ClientIntelligence />} />
            <Route path="manager"      element={<Manager />} />
            <Route path="display"    element={<DisplaySetup />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="staff/:id"  element={<StaffProfile />} />
            <Route path="settings"   element={<Settings />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </div>
      </main>

      {/* AI Assist lives outside <Routes> on purpose: anything rendered inside
          a route is unmounted the moment you navigate, which would wipe the
          conversation every time you changed page. */}
      <AiAssistDock />

      {/* Guided tour. Also outside <Routes>, because it navigates between
          pages as it runs — anything inside the router would unmount itself
          at the first step. */}
      {invite && (
        <TourInvite
          onStart={() => { setInvite(false); setTouring(true); }}
          onDismiss={() => { setInvite(false); snoozeTour(); }}
        />
      )}
      <ProductTour open={touring} onClose={() => setTouring(false)} />
    </div>
  );
}
