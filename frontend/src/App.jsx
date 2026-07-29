import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Auth from "./pages/Auth.jsx";
import DashboardLayout from "./pages/DashboardLayout.jsx";
import Applications from "./pages/dashboard/Applications.jsx";
import NewApplication from "./pages/dashboard/NewApplication.jsx";
import Settings from "./pages/dashboard/Settings.jsx";
import Profile from "./pages/dashboard/Profile.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/register" element={<Auth mode="register" />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Applications />} />
        <Route path="new" element={<NewApplication />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
