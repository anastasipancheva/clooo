"use client";
import { use, useEffect, useState, useCallback } from "react";
import { kt, KtSlot } from "@/lib/api";
import { useSignalR } from "@/hooks/useSignalR";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface PageProps { params: Promise<{ id: string }> }

export default function KtStudentPage({ params }: PageProps) {
  const { id: activityId } = use(params);
  const [slots, setSlots] = useState<KtSlot[]>([]);

  const reload = useCallback(async () => {
    const data = await kt.myQueue(activityId).catch(() => [] as KtSlot[]);
    setSlots(data);
  }, [activityId]);

  useEffect(() => { reload(); }, [reload]);

  useSignalR(useCallback((payload) => {
    if (payload.type === "KtCalled") {
      toast.success(payload.title, { description: "Подойдите к ассистенту!" });
      reload();
    }
    if (payload.type === "KtAccepted" || payload.type === "KtRejected") {
      toast[payload.type === "KtAccepted" ? "success" : "error"](payload.title);
      reload();
    }
  }, [reload]));

  async function markReady(taskItemId: string) {
    try {
      await kt.markReady(activityId, taskItemId);
      toast.success("Отмечено! Ждите вызова.");
      reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const statusColor = (s: string) => {
    if (s === "Accepted") return "default";
    if (s === "InReview") return "secondary";
    if (s === "Rejected") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Контрольная точка — мои задачи</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Статус задач</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {slots.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Нажмите «Решил задачу», когда будете готовы сдать. Система поставит вас в очередь.
            </p>
          )}
          {slots.map((slot) => (
            <div key={slot.taskItemId} className="flex items-center justify-between py-1">
              <div>
                <span className="font-mono font-medium text-sm">{slot.taskCode}</span>
                {slot.status === "ReadyForReview" && slot.queuePosition > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    позиция в очереди: {slot.queuePosition}
                  </span>
                )}
                {slot.status === "InReview" && (
                  <span className="text-xs text-green-600 ml-2 font-medium">Вас вызвали!</span>
                )}
              </div>
              <Badge variant={statusColor(slot.status)}>{slot.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Отметить решённые задачи</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Введите ID задачи и нажмите «Решил». Порядок, в котором вы отмечаете задачи, определяет очередь.
          </p>
          <TaskReadyForm activityId={activityId} onMarked={reload} />
        </CardContent>
      </Card>
    </div>
  );
}

function TaskReadyForm({ activityId, onMarked }: { activityId: string; onMarked: () => void }) {
  const [taskId, setTaskId] = useState("");

  async function handle() {
    if (!taskId.trim()) return;
    try {
      await kt.markReady(activityId, taskId.trim());
      toast.success("Отмечено!");
      setTaskId("");
      onMarked();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="flex gap-2">
      <input
        className="border rounded px-2 py-1 text-sm flex-1"
        placeholder="Task ID (UUID)"
        value={taskId}
        onChange={(e) => setTaskId(e.target.value)}
      />
      <Button size="sm" onClick={handle}>Решил</Button>
    </div>
  );
}
