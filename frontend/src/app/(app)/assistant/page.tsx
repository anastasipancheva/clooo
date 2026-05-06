"use client";
import Link from "next/link";
import { BookOpen, ClipboardCheck } from "lucide-react";

export default function AssistantIndexPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Панель ассистента</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="w-9 h-9 rounded-lg bg-[#EAF2FF] flex items-center justify-center mb-3">
            <BookOpen size={18} className="text-[#005BFF]" />
          </div>
          <h2 className="text-sm font-semibold text-[#1A1A1B] mb-1">Лекция / пара</h2>
          <p className="text-xs text-[#6B7280] mb-4">Перейдите по ссылке от преподавателя:</p>
          <code className="text-xs bg-[#F3F4F6] text-[#6B7280] px-2 py-1 rounded-md">/assistant/session/[id]</code>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="w-9 h-9 rounded-lg bg-[#EAF2FF] flex items-center justify-center mb-3">
            <ClipboardCheck size={18} className="text-[#005BFF]" />
          </div>
          <h2 className="text-sm font-semibold text-[#1A1A1B] mb-1">Контрольная точка</h2>
          <p className="text-xs text-[#6B7280] mb-4">Перейдите по ссылке от преподавателя:</p>
          <code className="text-xs bg-[#F3F4F6] text-[#6B7280] px-2 py-1 rounded-md">/assistant/kt/[id]</code>
        </div>
      </div>

      <div className="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] px-5 py-4">
        <p className="text-xs text-[#4B72B0] leading-relaxed">
          Ссылки на конкретные пары и КТ выдаёт преподаватель перед занятием.
          ID занятия можно найти в расписании или в сообщении от системы.
        </p>
      </div>
    </div>
  );
}
