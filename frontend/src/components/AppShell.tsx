"use client";
import { ReactNode, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useSignalR, NotificationPayload } from "@/hooks/useSignalR";
import { toast } from "sonner";
import { Bell, LogOut, LayoutDashboard, Star, UserCog, Users, BookOpen } from "lucide-react";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  const handleNotification = useCallback((payload: NotificationPayload) => {
    setUnread((n) => n + 1);
    toast.info(payload.title, { description: payload.body });
  }, []);

  useSignalR(handleNotification);

  const role = user?.role ?? "";
  const isTeacher = role === "Teacher" || role === "Admin";
  const isAssistant = role === "Assistant";
  const isStudent = role === "Student";
  const homeHref = isTeacher ? "/admin" : "/";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  // Role-specific nav: Teacher/Admin only see Управление
  // Student sees Главная, Баллы, Курсы
  // Assistant sees Главная, Ассистент
  const navItems = [
    { href: "/", label: "Главная", icon: LayoutDashboard, show: isStudent || isAssistant },
    { href: "/scores", label: "Баллы", icon: Star, show: isStudent },
    { href: "/courses", label: "Курсы", icon: BookOpen, show: isStudent },
    { href: "/assistant", label: "Ассистент", icon: Users, show: isAssistant },
    { href: "/admin", label: "Управление", icon: UserCog, show: isTeacher },
    { href: "/assistant", label: "Сессия", icon: Users, show: isTeacher },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFB]">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-8">
            <Link href={homeHref} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#005BFF] flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span className="font-semibold text-[#1A1A1B] text-sm tracking-wide">ScoreHub</span>
            </Link>
            <nav className="flex gap-1">
              {navItems.filter((i) => i.show).map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#EAF2FF] text-[#005BFF]"
                        : "text-[#6B7280] hover:text-[#1A1A1B] hover:bg-[#F3F4F6]"
                    }`}
                  >
                    <item.icon size={15} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              onClick={() => setUnread(0)}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] hover:text-[#005BFF] hover:bg-[#EAF2FF] transition-colors"
            >
              <Bell size={17} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#005BFF] text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <div className="h-5 w-px bg-[#E5E7EB]" />
            <Link href="/profile" className="text-sm text-[#1A1A1B] font-medium hover:text-[#005BFF] transition-colors">{user?.displayName}</Link>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
