"use client";
import { use, useEffect, useState, useCallback } from "react";
import { kt, KtQueueEntry } from "@/lib/api";
import { useSignalR } from "@/hooks/useSignalR";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface PageProps { params: Promise<{ id: string }> }

// In real usage task IDs come from the activity's task-sets.
// This page accepts a taskItemId via query param: /assistant/kt/[activityId]?task=<taskItemId>
export default function AssistantKtPage({ params }: PageProps) {
  const { id: activityId } = use(params);
  const [taskItemId, setTaskItemId] = useState("");
  const [queue, setQueue] = useState<KtQueueEntry[]>([]);

  const reload = useCallback(async () => {
    if (!taskItemId) return;
    const data = await kt.queue(activityId, taskItemId).catch(() => [] as KtQueueEntry[]);
    setQueue(data);
  }, [activityId, taskItemId]);

  useEffect(() => { reload(); }, [reload]);

  useSignalR(useCallback((payload) => {
    if (payload.type === "KtTaskReady") { toast.info(payload.title); reload(); }
  }, [reload]));

  async function callNext() {
    try {
      await kt.callNext(activityId, taskItemId);
      toast.success("Студент вызван");
      reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function complete(submissionId: string, accepted: boolean) {
    try {
      await kt.completeReview(activityId, submissionId, accepted, accepted ? 1 : 0);
      toast[accepted ? "success" : "error"](accepted ? "Принято" : "Не принято");
      reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">КТ — панель ассистента</h1>

      <div className="flex gap-2 items-center">
        <input
          className="border rounded px-2 py-1 text-sm flex-1 max-w-xs"
          placeholder="Task Item ID"
          value={taskItemId}
          onChange={(e) => setTaskItemId(e.target.value)}
        />
        <Button size="sm" variant="outline" onClick={reload}>Загрузить очередь</Button>
        <Button size="sm" onClick={callNext} disabled={!taskItemId}>Вызвать следующего</Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Очередь
            {queue.length > 0 && <Badge>{queue.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {queue.length === 0 && <p className="text-sm text-muted-foreground">Очередь пуста</p>}
          {queue.map((entry, i) => (
            <div key={entry.submissionId} className="flex items-center justify-between py-1">
              <div>
                <span className="text-sm font-medium mr-2">#{i + 1}</span>
                <span className="text-sm">{entry.studentEmail}</span>
                {entry.readyAt && (
                  <span className="text-xs text-muted-foreground ml-2">
                    с {new Date(entry.readyAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={entry.status === "InReview" ? "default" : "secondary"}>{entry.status}</Badge>
                {entry.status === "InReview" && (
                  <>
                    <Button size="sm" variant="default" onClick={() => complete(entry.submissionId, true)}>Принять</Button>
                    <Button size="sm" variant="destructive" onClick={() => complete(entry.submissionId, false)}>Не принять</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
