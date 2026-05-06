"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth, setToken, clearToken } from "@/lib/api";

interface User {
  id: string;
  email: string;
  displayName: string;
  role: "Student" | "Assistant" | "Teacher" | "Admin";
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) { setLoading(false); return; }
    auth.me()
      .then((u) => setUser(u as User))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await auth.login(email, password);
    setToken(res.accessToken);
    const me = await auth.me();
    setUser(me as User);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
