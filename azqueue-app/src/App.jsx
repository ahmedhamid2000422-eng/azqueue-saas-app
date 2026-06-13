import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import ModeSelect from "./pages/ModeSelect";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Product from "./pages/Product";
import Resources from "./pages/Resources";
import ResourceArticle from "./pages/ResourceArticle";
import CaseStudy from "./pages/CaseStudy";
import Support from "./pages/Support";
import Company from "./pages/Company";
import Industries from "./pages/Industries";
import PersonalFlow from "./pages/PersonalFlow";
import IslamicMode from "./pages/IslamicMode";
import ManagerMode from "./pages/ManagerMode";
import CustomerCheckIn from "./pages/CustomerCheckIn";
import CustomerTicket from "./pages/CustomerTicket";
import TvDisplay from "./pages/TvDisplay";
import BookingPage from "./pages/BookingPage";
import SurveyPage from "./pages/SurveyPage";
import AdminDashboard from "./pages/AdminDashboard";
import Legal from "./pages/Legal";
import Checkin from "./pages/Checkin";
import Display from "./pages/Display";
import ResetPassword from "./pages/ResetPassword";
import ConfirmAttendance from "./pages/ConfirmAttendance";
import BusinessDashboard from "./modes/business/Dashboard";
import PersonalDashboard from "./modes/personal/Dashboard";
import StaffDashboard from "./modes/staff/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/"        element={<Landing />} />
      <Route path="/login"   element={<Login />} />
      <Route path="/signup"  element={<Signup />} />
      <Route path="/select"  element={<ModeSelect />} />
      <Route path="/product" element={<Product />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/resources/:slug" element={<ResourceArticle />} />
      <Route path="/case-studies/:slug" element={<CaseStudy />} />
      <Route path="/support" element={<Support />} />
      <Route path="/company" element={<Company />} />
      <Route path="/industries" element={<Industries />} />
      <Route path="/personal-flow" element={<PersonalFlow />} />
      <Route path="/islamic-mode" element={<IslamicMode />} />
      <Route path="/manager-mode" element={<ManagerMode />} />

      {/* Public customer-side flow — no auth */}
      <Route path="/q/:slug"           element={<CustomerCheckIn />} />
      <Route path="/t/:ticketId"       element={<CustomerTicket />} />
      <Route path="/display/:slug"     element={<TvDisplay />} />
      <Route path="/b/:slug"           element={<BookingPage />} />
      <Route path="/survey/:slug"      element={<SurveyPage />} />
      <Route path="/confirm/:bookingId" element={<ConfirmAttendance />} />
      <Route path="/reset-password"    element={<ResetPassword />} />
      <Route path="/checkin/:branchId" element={<Checkin />} />
      <Route path="/display-tv/:branchId" element={<Display />} />
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
            <BusinessDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/personal/*"
        element={
          <ProtectedRoute>
            <PersonalDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/staff/*"
        element={
          <ProtectedRoute>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
