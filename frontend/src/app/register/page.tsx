"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, setToken } from "@/lib/api";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Пароль должен быть не менее 8 символов");
      return;
    }
    setLoading(true);
    try {
      const data = await auth.register(email, password, displayName);
      setToken(data.accessToken);
      toast.success("Аккаунт создан! Запишитесь на курс.");
      router.replace("/courses");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Ошибка регистрации");
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
          <p className="text-sm text-[#6B7280] mt-1">Создайте аккаунт</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-[#1A1A1B] mb-1.5">
                Имя
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Иван Иванов"
                className="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm text-[#1A1A1B] placeholder-[#9CA3AF] outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition"
              />
            </div>
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
              <p className="text-xs text-[#9CA3AF] mt-1">Минимум 8 символов</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#6B7280] mt-4">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-[#005BFF] hover:underline font-medium">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
