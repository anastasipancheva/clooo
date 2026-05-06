"use client";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Star, Bell, Users, UserCog, BookOpen, ClipboardList } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isAssistant = role === "Assistant" || role === "Teacher" || role === "Admin";
  const isTeacher = role === "Teacher" || role === "Admin";

  const cards = [
    {
      title: "Мои баллы",
      description: "Итоги по модулям и финальная оценка",
      href: "/scores",
      icon: Star,
      color: "#005BFF",
      show: true,
    },
    {
      title: "Уведомления",
      description: "Вызовы ассистента, результаты сдач, КТ",
      href: "/notifications",
      icon: Bell,
      color: "#7C3AED",
      show: true,
    },
    {
      title: "Домашние задания",
      description: "Сдать решение в Google Docs",
      href: "/homework",
      icon: BookOpen,
      color: "#059669",
      show: true,
    },
    {
      title: "Панель ассистента",
      description: "Очереди вызовов и сдач на паре",
      href: "/assistant",
      icon: Users,
      color: "#D97706",
      show: isAssistant,
    },
    {
      title: "Управление",
      description: "Курсы, занятия, команды, баллы",
      href: "/admin",
      icon: UserCog,
      color: "#DC2626",
      show: isTeacher,
    },
    {
      title: "Контрольные точки",
      description: "Задания для КТ и очередь сдачи",
      href: "/kt",
      icon: ClipboardList,
      color: "#0891B2",
      show: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#EAF2FF] rounded-xl px-6 py-5 border border-[#C7DCFF]">
        <p className="text-sm text-[#005BFF] font-medium mb-0.5">Добро пожаловать</p>
        <h1 className="text-xl font-semibold text-[#1A1A1B]">{user?.displayName}</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {role === "Student" && "Студент"}
          {role === "Assistant" && "Ассистент"}
          {role === "Teacher" && "Преподаватель"}
          {role === "Admin" && "Администратор"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.filter((c) => c.show).map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#005BFF]/30 hover:shadow-sm transition-all cursor-pointer group">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: card.color + "15" }}
              >
                <card.icon size={18} style={{ color: card.color }} />
              </div>
              <h2 className="text-sm font-semibold text-[#1A1A1B] group-hover:text-[#005BFF] transition-colors">
                {card.title}
              </h2>
              <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
