import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { status } = useAuth();

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  if (status === "guest") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
