"use client";
import { useEffect, useState } from "react";
import { notifications, Notification } from "@/lib/api";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const [list, setList] = useState<Notification[]>([]);

  useEffect(() => { notifications.list().then(setList).catch(() => {}); }, []);

  async function markRead(id: string) {
    await notifications.markRead(id).catch(() => {});
    setList((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  }

  const unread = list.filter((n) => !n.readAt);
  const read = list.filter((n) => n.readAt);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#1A1A1B]">Уведомления</h1>
        {unread.length > 0 && (
          <span className="text-xs bg-[#EAF2FF] text-[#005BFF] font-medium px-2.5 py-1 rounded-full">
            {unread.length} новых
          </span>
        )}
      </div>

      {list.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-10 text-center">
          <Bell size={32} className="mx-auto text-[#E5E7EB] mb-3" />
          <p className="text-sm text-[#6B7280]">Нет уведомлений</p>
        </div>
      )}

      {unread.length > 0 && (
        <div className="space-y-2">
          {unread.map((n) => (
            <div key={n.id} className="bg-[#EAF2FF] rounded-xl border border-[#C7DCFF] p-4 flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <p className="text-sm font-semibold text-[#1A1A1B]">{n.title}</p>
                {n.body && <p className="text-xs text-[#6B7280]">{n.body}</p>}
                <p className="text-xs text-[#9CA3AF]">{new Date(n.createdAt).toLocaleString("ru")}</p>
              </div>
              <button
                onClick={() => markRead(n.id)}
                className="flex items-center gap-1.5 text-xs text-[#005BFF] hover:text-[#0050E6] font-medium shrink-0 mt-0.5"
              >
                <CheckCheck size={14} />
                Прочитано
              </button>
            </div>
          ))}
        </div>
      )}

      {read.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">Прочитанные</p>
          {read.map((n) => (
            <div key={n.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <p className="text-sm font-medium text-[#6B7280]">{n.title}</p>
              {n.body && <p className="text-xs text-[#9CA3AF] mt-0.5">{n.body}</p>}
              <p className="text-xs text-[#9CA3AF] mt-1">{new Date(n.createdAt).toLocaleString("ru")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
