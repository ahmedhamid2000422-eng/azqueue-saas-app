import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Contact from "./pages/Contact";
import ModeSelect from "./pages/ModeSelect";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Product from "./pages/Product";
import Resources from "./pages/Resources";
import ResourceArticle from "./pages/ResourceArticle";
import Support from "./pages/Support";
import Company from "./pages/Company";
import Industries from "./pages/Industries";
import PersonalFlow from "./pages/PersonalFlow";
import IslamicMode from "./pages/IslamicMode";
import ManagerMode from "./pages/ManagerMode";
import CustomerCheckIn from "./pages/CustomerCheckIn";
import PickupKiosk from "./pages/PickupKiosk";
import SmsPolicy from "./pages/SmsPolicy";
import BusinessHome, { businessForHost } from "./pages/BusinessHome";
import CustomerTicket from "./pages/CustomerTicket";
import TvDisplay from "./pages/TvDisplay";
import BookingPage from "./pages/BookingPage";
import SurveyPage from "./pages/SurveyPage";
import MarketSurveyPage from "./pages/MarketSurveyPage";
import AdminDashboard from "./pages/AdminDashboard";
import Legal from "./pages/Legal";
import BusinessLegal from "./pages/BusinessLegal";
import Checkin from "./pages/Checkin";
import Display from "./pages/Display";
import ResetPassword from "./pages/ResetPassword";
import ConfirmAttendance from "./pages/ConfirmAttendance";
import BusinessDashboard from "./modes/business/Dashboard";
import PersonalDashboard from "./modes/personal/Dashboard";
import StaffDashboard from "./modes/staff/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  /* Read once per render from the address bar. A customer domain points at
     the same Vercel deployment, so the hostname is the only thing that
     distinguishes them. */
  const hostSite = businessForHost(
    typeof window !== "undefined" ? window.location.hostname : ""
  );

  return (
    <ErrorBoundary>
    <Routes>
      {/* On a customer's own domain the root is THEIR page, not AzQueue's.
          Everything else — /q/:slug, /b/:slug/privacy, /t/:id — resolves
          identically on both hosts, so links keep working either way. */}
      <Route path="/"        element={hostSite ? <BusinessHome site={hostSite} /> : <Landing />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/login"   element={<Login />} />
      <Route path="/signup"  element={<Signup />} />
      <Route path="/select"  element={<ModeSelect />} />
      <Route path="/product" element={<Product />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/resources/:slug" element={<ResourceArticle />} />
      <Route path="/support" element={<Support />} />
      <Route path="/company" element={<Company />} />
      <Route path="/industries" element={<Industries />} />
      <Route path="/personal-flow" element={<PersonalFlow />} />
      <Route path="/islamic-mode" element={<IslamicMode />} />
      <Route path="/manager-mode" element={<ManagerMode />} />

      {/* Public customer-side flow — no auth */}
      <Route path="/q/:slug"           element={<CustomerCheckIn />} />
      <Route path="/q/:slug/pickup"    element={<PickupKiosk />} />
      <Route path="/t/:ticketId"       element={<CustomerTicket />} />
      <Route path="/display/:slug"     element={<TvDisplay />} />
      <Route path="/b/:slug"           element={<BookingPage />} />
      <Route path="/b/:slug/privacy"   element={<BusinessLegal />} />
      <Route path="/b/:slug/terms"     element={<BusinessLegal />} />
      <Route path="/survey/:slug"      element={<SurveyPage />} />
      <Route path="/survey"            element={<SurveyPage />} />
      <Route path="/market-survey"     element={<MarketSurveyPage />} />
      <Route path="/confirm/:bookingId" element={<ConfirmAttendance />} />
      <Route path="/reset-password"    element={<ResetPassword />} />
      <Route path="/checkin/:branchId" element={<Checkin />} />
      <Route path="/display-tv/:branchId" element={<Display />} />
      {/* Both paths render the same page. /sms/privacy is what the consent
          checkbox has always linked to — it was never a route, so a carrier
          reviewer following it found nothing. /sms is the shorter address to
          hand to a reviewer. */}
      <Route path="/sms"               element={<SmsPolicy />} />
      <Route path="/sms/privacy"       element={<SmsPolicy />} />
      <Route path="/legal/:doc"        element={<Legal />} />
      <Route path="/legal"             element={<Legal />} />

      {/* Platform admin (your operator dashboard) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/business/*"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <BusinessDashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />

      <Route
        path="/personal/*"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <PersonalDashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />

      <Route
        path="/staff/*"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <StaffDashboard />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </ErrorBoundary>
  );
}
