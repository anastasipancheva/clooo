"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { User, Mail, Shield, Copy, LogOut } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = {
  Student: "Студент",
  Assistant: "Ассистент",
  Teacher: "Преподаватель",
  Admin: "Администратор",
};
const ROLE_COLOR: Record<string, string> = {
  Student: "bg-[#F3F4F6] text-[#6B7280]",
  Assistant: "bg-[#FEF3C7] text-[#D97706]",
  Teacher: "bg-[#EAF2FF] text-[#005BFF]",
  Admin: "bg-[#EAF2FF] text-[#005BFF]",
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function copyId() {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id).then(() => toast.success("ID скопирован"));
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <div className="max-w-md space-y-5">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Профиль</h1>

      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {/* Avatar header */}
        <div className="bg-[#EAF2FF] px-6 py-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#005BFF] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl font-bold">
              {user.displayName?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div>
            <p className="text-base font-semibold text-[#1A1A1B]">{user.displayName}</p>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_COLOR[user.role] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}>
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </div>
        </div>

        {/* Info rows */}
        <div className="divide-y divide-[#F3F4F6]">
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Mail size={15} className="text-[#9CA3AF] flex-shrink-0" />
            <div>
              <p className="text-xs text-[#9CA3AF]">Email</p>
              <p className="text-sm text-[#1A1A1B]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-3.5">
            <Shield size={15} className="text-[#9CA3AF] flex-shrink-0" />
            <div>
              <p className="text-xs text-[#9CA3AF]">Роль</p>
              <p className="text-sm text-[#1A1A1B]">{ROLE_LABEL[user.role] ?? user.role}</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <User size={15} className="text-[#9CA3AF] flex-shrink-0" />
              <div>
                <p className="text-xs text-[#9CA3AF]">ID пользователя</p>
                <p className="text-xs font-mono text-[#6B7280] break-all">{user.id}</p>
              </div>
            </div>
            <button
              onClick={copyId}
              className="ml-3 w-8 h-8 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#005BFF] hover:bg-[#EAF2FF] transition-colors flex-shrink-0"
              title="Скопировать ID"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 h-10 px-5 rounded-xl border border-[#E5E7EB] text-sm text-[#EF4444] hover:bg-red-50 hover:border-red-200 transition-colors"
      >
        <LogOut size={15} />
        Выйти из аккаунта
      </button>
    </div>
  );
}
