"use client";
import { useEffect, useState } from "react";
import { student, StudentActivity } from "@/lib/api";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function KtIndexPage() {
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    student.activities(2)
      .then(setActivities)
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-[#1A1A1B]">Контрольные точки</h1>

      {loading && (
        <p className="text-sm text-[#9CA3AF]">Загрузка...</p>
      )}

      {!loading && activities.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF]">Нет доступных КТ</p>
          <p className="text-xs text-[#D1D5DB] mt-1">
            Запишитесь на курс, чтобы видеть занятия
          </p>
        </div>
      )}

      {activities.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="divide-y divide-[#F3F4F6]">
            {activities.map((a) => (
              <Link key={a.id} href={`/kt/${a.id}`}>
                <div className="px-5 py-4 hover:bg-[#F9FAFB] transition-colors flex items-center justify-between group">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1B] group-hover:text-[#005BFF] transition-colors">
                      {a.title}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      Модуль {a.moduleNumber} · {fmtDate(a.startsAt)}
                    </p>
                  </div>
                  <ClipboardList size={16} className="text-[#D1D5DB] group-hover:text-[#005BFF] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
