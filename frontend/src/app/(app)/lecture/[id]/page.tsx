"use client";
import { use, useEffect, useState, useCallback } from "react";
import { teams, miniTest, MiniTestDto } from "@/lib/api";
import { useSignalR } from "@/hooks/useSignalR";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface PageProps { params: Promise<{ id: string }> }

export default function LecturePage({ params }: PageProps) {
  const { id: activityId } = use(params);

  const [teamId, setTeamId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<{ id: string; code: string; status: string }[]>([]);
  const [miniTestData, setMiniTestData] = useState<MiniTestDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Fetch mini-test
  const fetchMiniTest = useCallback(async () => {
    try {
      const data = await miniTest.get(activityId);
      setMiniTestData(data);
      setSecondsLeft(data.secondsRemaining);
    } catch {}
  }, [activityId]);

  useEffect(() => { fetchMiniTest(); }, [fetchMiniTest]);

  // Timer for mini-test
  useEffect(() => {
    if (!miniTestData?.isOpen || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [miniTestData?.isOpen, secondsLeft]);

  // SignalR: re-fetch when test opens
  useSignalR(useCallback((payload) => {
    if (payload.type === "MiniTestOpened") fetchMiniTest();
    if (payload.type === "TaskAccepted" || payload.type === "TaskRejected") {
      toast[payload.type === "TaskAccepted" ? "success" : "error"](payload.title);
    }
  }, [fetchMiniTest]));

  async function callAssistant() {
    if (!teamId) return;
    try {
      await teams.requestHelp(teamId);
      toast.success("Ассистент вызван!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function markReady(taskItemId: string) {
    if (!teamId) return;
    try {
      await teams.markReady(teamId, taskItemId);
      toast.success("Ассистент уведомлён о готовности");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function submitTest() {
    const ans = Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({
      questionId,
      selectedOptionIndex,
    }));
    try {
      await miniTest.submit(activityId, ans);
      setTestSubmitted(true);
      toast.success("Тест сдан!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Лекция</h1>

      {/* Mini-test */}
      {miniTestData && !testSubmitted && miniTestData.isOpen && secondsLeft > 0 && (
        <Card className="border-yellow-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Мини-тест</CardTitle>
            <Badge variant="outline" className="text-yellow-600 border-yellow-400">
              {fmt(secondsLeft)}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {miniTestData.questions.map((q) => (
              <div key={q.id} className="space-y-2">
                <p className="font-medium text-sm">{q.order}. {q.text}</p>
                <div className="space-y-1">
                  {q.options.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        value={i}
                        checked={answers[q.id] === i}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button size="sm" onClick={submitTest}>Сдать тест</Button>
          </CardContent>
        </Card>
      )}
      {testSubmitted && (
        <Card className="border-green-400">
          <CardContent className="pt-4 text-green-700 text-sm font-medium">Тест сдан!</CardContent>
        </Card>
      )}

      {/* Team actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Команда</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Чтобы вызвать ассистента на консультацию или отметить задачу готовой, используйте кнопки ниже.
          </p>
          <Button variant="outline" onClick={callAssistant} disabled={!teamId}>
            Позвать ассистента
          </Button>
        </CardContent>
      </Card>

      {/* Tasks */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Задачи</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <span className="text-sm font-mono">{t.code}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={t.status === "Accepted" ? "default" : "secondary"}>{t.status}</Badge>
                  {t.status !== "Accepted" && (
                    <Button size="sm" variant="outline" onClick={() => markReady(t.id)}>
                      Готовы сдать
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Activity ID: {activityId}. Список задач и teamId будут подтянуты через API курса
        (необходим эндпоинт GET /api/activities/{'{id}'}/my-team).
      </p>
    </div>
  );
}
