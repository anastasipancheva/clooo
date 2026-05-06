"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#005BFF] mb-4">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#1A1A1B]">ScoreHub</h1>
          <p className="text-sm text-[#6B7280] mt-1">Войдите в систему</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#1A1A1B] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm text-[#1A1A1B] placeholder-[#9CA3AF] outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#1A1A1B] mb-1.5">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm text-[#1A1A1B] placeholder-[#9CA3AF] outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
