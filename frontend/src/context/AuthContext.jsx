  import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, clearToken, registerUnauthorizedHandler } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, email, username, created_at }
  const [status, setStatus] = useState("checking"); // checking | authed | guest

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
      setStatus("guest");
    });
  }, []);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setStatus("guest");
        return;
      }
      try {
        const me = await api.get("/api/auth/me");
        setUser(me);
        setStatus("authed");
      } catch {
        setStatus("guest");
      }
    })();
  }, []);

  const login = async (email, password) => {
    const data = await api.post("/api/auth/login", { email, password });
    setToken(data.token);
    setUser({ email: data.email, username: data.username });
    setStatus("authed");
    // fetch full profile (id, created_at) in the background
    api.get("/api/auth/me").then(setUser).catch(() => {});
    return data;
  };

  const register = async (email, username, password) => {
    const data = await api.post("/api/auth/register", { email, username, password });
    setToken(data.token);
    setUser({ email: data.email, username: data.username });
    setStatus("authed");
    api.get("/api/auth/me").then(setUser).catch(() => {});
    return data;
  };

  const updateProfile = async (payload) => {
    const updated = await api.put("/api/auth/profile", payload);
    setUser((u) => ({ ...u, ...updated }));
    return updated;
  };

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
