"use client";
import { useState } from "react";
import { homework } from "@/lib/api";
import { toast } from "sonner";
import { Send } from "lucide-react";

export default function HomeworkPage() {
  const [activityId, setActivityId] = useState("");
  const [taskItemId, setTaskItemId] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [members, setMembers] = useState("");

  async function submit() {
    const memberIds = members.split(",").map((s) => s.trim()).filter(Boolean);
    if (!activityId || !taskItemId || !docUrl || memberIds.length === 0) {
      toast.error("Заполните все поля");
      return;
    }
    try {
      await homework.submit({ activityId, taskItemId, documentUrl: docUrl, memberUserIds: memberIds });
      toast.success("Сдача создана!");
      setDocUrl(""); setMembers("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const inputClass = "w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-sm text-[#1A1A1B] placeholder-[#9CA3AF] outline-none focus:border-[#005BFF] focus:ring-2 focus:ring-[#005BFF]/10 transition";

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Домашние задания</h1>

      <div className="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] px-5 py-4">
        <p className="text-sm text-[#005BFF] font-medium mb-1">Как сдать?</p>
        <p className="text-xs text-[#4B72B0] leading-relaxed">
          Сформируйте группу 1–3 студента, оформите решение в Google Docs и отправьте ссылку.
          Включите себя в список участников (через запятую).
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
        <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Отправить решение</p>
        <div>
          <label className="block text-xs font-medium text-[#1A1A1B] mb-1.5">ID занятия</label>
          <input className={inputClass} placeholder="Activity ID" value={activityId} onChange={(e) => setActivityId(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#1A1A1B] mb-1.5">ID задания</label>
          <input className={inputClass} placeholder="Task Item ID" value={taskItemId} onChange={(e) => setTaskItemId(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#1A1A1B] mb-1.5">Ссылка на Google Doc</label>
          <input className={inputClass} placeholder="https://docs.google.com/..." value={docUrl} onChange={(e) => setDocUrl(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#1A1A1B] mb-1.5">User ID участников</label>
          <input className={inputClass} placeholder="id1, id2, id3" value={members} onChange={(e) => setMembers(e.target.value)} />
          <p className="text-xs text-[#9CA3AF] mt-1">Ваш User ID можно найти в профиле</p>
        </div>
        <button
          onClick={submit}
          className="h-10 px-5 rounded-lg bg-[#005BFF] text-white text-sm font-medium hover:bg-[#0050E6] transition-colors flex items-center gap-2"
        >
          <Send size={14} />
          Отправить
        </button>
      </div>
    </div>
  );
}
