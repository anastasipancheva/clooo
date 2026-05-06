"use client";
import { use, useEffect, useState, useCallback } from "react";
import { assistantSession, HelpRequest, TeamSubmission } from "@/lib/api";
import { useSignalR } from "@/hooks/useSignalR";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PageProps { params: Promise<{ id: string }> }

export default function AssistantSessionPage({ params }: PageProps) {
  const { id: activityId } = use(params);

  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [submissions, setSubmissions] = useState<TeamSubmission[]>([]);
  const [groupCoeffs, setGroupCoeffs] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const [hr, subs] = await Promise.all([
      assistantSession.openHelp(activityId).catch(() => [] as HelpRequest[]),
      assistantSession.pendingSubmissions(activityId).catch(() => [] as TeamSubmission[]),
    ]);
    setHelpRequests(hr);
    setSubmissions(subs);
  }, [activityId]);

  useEffect(() => { reload(); }, [reload]);

  useSignalR(useCallback((payload) => {
    if (["TeamHelpRequested", "TeamReadyToDefend", "ReviewStarted", "TaskAccepted", "TaskRejected"].includes(payload.type)) {
      toast.info(payload.title, { description: payload.body ?? undefined });
      reload();
    }
  }, [reload]));

  async function resolveHelp(id: string) {
    await assistantSession.resolveHelp(id);
    reload();
  }

  async function startReview(sub: TeamSubmission) {
    const defender = prompt(`Введите userId защитника (из команды ${sub.teamName}):`);
    if (!defender) return;
    try {
      await assistantSession.startReview(sub.submissionId, defender);
      toast.success("Приём начат");
      reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function completeReview(sub: TeamSubmission, accepted: boolean) {
    try {
      await assistantSession.completeReview(sub.submissionId, accepted, accepted ? 1 : 0);
      toast[accepted ? "success" : "error"](accepted ? "Принято" : "Не принято");
      reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function setGroupScore(teamId: string) {
    const coeff = parseFloat(groupCoeffs[teamId] ?? "1");
    if (isNaN(coeff) || coeff < 0.8 || coeff > 1.2) {
      toast.error("Коэф должен быть от 0.8 до 1.2");
      return;
    }
    try {
      await assistantSession.setGroupScore(activityId, teamId, coeff);
      toast.success("Коэффициент выставлен");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const uniqueTeamIds = [...new Set(submissions.map((s) => s.teamId))];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Панель ассистента</h1>

      {/* Help requests */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Вызовы ассистента
            {helpRequests.length > 0 && <Badge variant="destructive">{helpRequests.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {helpRequests.length === 0 && <p className="text-sm text-muted-foreground">Нет вызовов</p>}
          {helpRequests.map((hr) => (
            <div key={hr.id} className="flex items-start justify-between gap-2 py-1">
              <div>
                <p className="text-sm font-medium">{hr.teamName}</p>
                {hr.message && <p className="text-xs text-muted-foreground">{hr.message}</p>}
                <p className="text-xs text-muted-foreground">{new Date(hr.createdAt).toLocaleTimeString()}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => resolveHelp(hr.id)}>Закрыть</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Submission queue */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Очередь сдач
            {submissions.length > 0 && <Badge>{submissions.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {submissions.length === 0 && <p className="text-sm text-muted-foreground">Очередь пуста</p>}
          {submissions.map((sub) => (
            <div key={sub.submissionId} className="flex items-center justify-between gap-2 py-1">
              <div>
                <span className="text-sm font-medium">{sub.teamName}</span>
                <span className="text-xs text-muted-foreground ml-2">— задача {sub.taskCode}</span>
                {sub.readyAt && (
                  <span className="text-xs text-muted-foreground ml-2">
                    с {new Date(sub.readyAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={sub.status === "InReview" ? "default" : "secondary"}>{sub.status}</Badge>
                {sub.status === "ReadyForReview" && (
                  <Button size="sm" onClick={() => startReview(sub)}>Начать</Button>
                )}
                {sub.status === "InReview" && (
                  <>
                    <Button size="sm" variant="default" onClick={() => completeReview(sub, true)}>Принять</Button>
                    <Button size="sm" variant="destructive" onClick={() => completeReview(sub, false)}>Не принять</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Group coefficients */}
      {uniqueTeamIds.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Групповой коэффициент</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {uniqueTeamIds.map((teamId) => {
              const teamName = submissions.find((s) => s.teamId === teamId)?.teamName ?? teamId;
              return (
                <div key={teamId} className="flex items-center gap-2">
                  <span className="text-sm min-w-24">{teamName}</span>
                  <Input
                    className="w-24"
                    type="number"
                    step="0.1"
                    min="0.8"
                    max="1.2"
                    value={groupCoeffs[teamId] ?? "1.0"}
                    onChange={(e) => setGroupCoeffs((p) => ({ ...p, [teamId]: e.target.value }))}
                  />
                  <Button size="sm" variant="outline" onClick={() => setGroupScore(teamId)}>Сохранить</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
