# ScoreHub — Техническая спецификация MKN2

> Стек: **Backend** — .NET 8 / ASP.NET Core / EF Core / SQLite (dev) / PostgreSQL (prod)  
> **Frontend** — Next.js 14+ / TypeScript / shadcn/ui  
> Уведомления — **SignalR** (real-time) + хранимые Notification-записи в БД  
> Все параметры курса настраиваются через **Админ-панель преподавателя**; ни одно значение не зашито в код.

---

## 1. Роли

| Роль | Что может |
|---|---|
| `Student` | Смотрит свои занятия, команды, задачи. Нажимает кнопки «Позвать ассистента» и «Готов сдать» (лекция), «Решил задачу X» (КТ). |
| `Assistant` | Видит очереди своих команд/задач. Принимает задачи, выставляет баллы и коэф. |
| `Teacher` | Видит весь поток. Создаёт курс, модули, занятия, задачи, команды, назначает ассистентов. Видит и принимает что угодно. |
| `Admin` | Всё то же что Teacher + назначение ролей пользователям. |

---

## 2. Доменная модель — что уже есть и что добавить

### 2.1 Существующие сущности (сохраняем как есть)

```
Course → Module[] → Activity[] → TaskSet[] → TaskItem[]
                               → Team[] → TeamMember[]
                                        → TeamAssistant[]
                                        → TeamHelpRequest[]
                               TaskItem → TaskAssistant[]
Activity ← TaskSubmission[]
User, Notification
```

ActivityType: `Lecture = 1`, `ControlPoint = 2`, `HomeworkSession = 3`

### 2.2 Новые сущности / поля

#### 2.2.1 `Activity` — добавить поля

```csharp
// Конфигурация лекции (заполняется только для Type == Lecture)
public decimal LectureBasePoints { get; set; } = 5.0m;  // "5 баллов за занятие"
public decimal MiniTestMaxBonus { get; set; } = 0.5m;   // "до 0.5 бонусных баллов"
public int MiniTestDurationSeconds { get; set; } = 300; // 5 минут
public string? PreLectureVideoUrl { get; set; }         // ссылка на видео до лекции
public bool MiniTestPublished { get; set; } = false;    // преподаватель публикует → таймер стартует

// Конфигурация КТ (заполняется только для Type == ControlPoint)
// Таблица KtMultiplier хранится в Course.KtMultiplierMap (JSON)
```

#### 2.2.2 `MiniTestQuestion` (новая таблица)

```csharp
public sealed class MiniTestQuestion
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;

    public int Order { get; set; }
    public string Text { get; set; } = null!;
    public string[] Options { get; set; } = [];    // JSON array
    public int CorrectOptionIndex { get; set; }
}
```

#### 2.2.3 `MiniTestAnswer` (новая таблица)

```csharp
public sealed class MiniTestAnswer
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }
    public Guid StudentId { get; set; }
    public Guid QuestionId { get; set; }
    public int SelectedOptionIndex { get; set; }
    public DateTimeOffset AnsweredAt { get; set; }
    public decimal BonusAwarded { get; set; }   // вычисляется при закрытии теста
}
```

#### 2.2.4 `StudentActivityScore` (новая таблица — итог по студенту за занятие)

```csharp
public sealed class StudentActivityScore
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }
    public Guid StudentId { get; set; }

    // Лекция
    public decimal GroupPoints { get; set; }        // баллы команды (пропорционально задачам)
    public decimal GroupCoefficient { get; set; } = 1.0m; // 0.8–1.2, выставляет ассистент
    public decimal MiniTestBonus { get; set; }      // 0..0.5
    // Если студент отсутствовал — GroupCoefficient = 0.8 (по умолчанию)

    // ДЗ
    public decimal HomeworkPoints { get; set; }     // сумма по принятым задачам
    public decimal HomeworkTimeCoefficient { get; set; } = 1.0m; // 1.0, 0.75, или 0.5

    // КТ
    public decimal KtMultiplier { get; set; } = 1.0m; // из таблицы multiplier_map

    // Итог модуля (рассчитывается после КТ)
    public decimal ModuleScore { get; set; }
    // ModuleScore = (GroupPoints * GroupCoeff + MiniTestBonus + HomeworkPoints * HWTimeCoeff) * KtMultiplier

    public DateTimeOffset UpdatedAt { get; set; }
}
```

#### 2.2.5 `Course` — добавить поля

```csharp
// JSON-сериализованная таблица КТ-мультипликаторов (настраивается в админ-панели)
// Пример: [{"tasks_solved":0,"multiplier":0.5},{"tasks_solved":1,"multiplier":0.7},...]
public string KtMultiplierMapJson { get; set; } = DefaultKtMap;

// JSON-сериализованная таблица финальных оценок
// Пример: [{"min":233,"mark":"5+"},{"min":215,"mark":"5"},...]
public string FinalGradingTableJson { get; set; } = DefaultGradingTable;
```

#### 2.2.6 `HomeworkSubmission` (новая таблица — отдельно от TaskSubmission)

```csharp
public sealed class HomeworkSubmission
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }         // HomeworkSession
    public Guid TaskItemId { get; set; }

    // Группа сдающих (1-3 студента)
    public List<HomeworkSubmissionMember> Members { get; set; } = new();

    public string DocumentUrl { get; set; } = null!;  // ссылка на гугл-документ
    public DateTimeOffset SubmittedAt { get; set; }

    public SubmissionStatus Status { get; set; } = SubmissionStatus.Draft;

    public Guid? ReviewerId { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public int? Result01 { get; set; }           // 0 или 1

    // Временной коэф применяется при подсчёте Score:
    // 1.0 — сдано до КТ модуля
    // 0.75 — в течение 7 дней после занятия (для задач из групповых пар)
    // 0.5  — позже 7 дней
    public decimal TimeCoefficient { get; set; } = 1.0m;
}

public sealed class HomeworkSubmissionMember
{
    public Guid HomeworkSubmissionId { get; set; }
    public Guid UserId { get; set; }
}
```

#### 2.2.7 `TeamGroupScore` (итог за лекцию для всей команды)

```csharp
public sealed class TeamGroupScore
{
    public Guid Id { get; set; }
    public Guid TeamId { get; set; }
    public Guid ActivityId { get; set; }

    public int TasksAccepted { get; set; }      // сколько задач принято
    public int TasksTotal { get; set; }         // всего задач на занятии
    public decimal BasePoints { get; set; }     // = LectureBasePoints * (TasksAccepted/TasksTotal)
    public decimal GroupCoefficient { get; set; } = 1.0m; // финальный коэф 0.8–1.2 (Teacher/Admin выставляет после пары)
    // Каждый член команды получает BasePoints * GroupCoefficient
    // Отсутствующие (IsAbsent = true) → их PersonalCoefficient = 0.8 переопределяет GroupCoefficient

    public DateTimeOffset UpdatedAt { get; set; }
}
```

---

## 3. Сценарий: Лекция (Lecture)

### 3.1 Подготовка до пары (Teacher/Admin в админ-панели)

1. Создать занятие типа `Lecture` в нужном модуле (дата, время начала/конца).
2. Прикрепить ссылку на видео (`PreLectureVideoUrl`) — видна студентам заранее.
3. Создать TaskSet, добавить задачи (TaskItem). Каждая задача: код, название, условие. Баллы задачи не нужны для лекции — стоимость всего TaskSet = `LectureBasePoints` (по умолчанию 5.0).
4. Создать команды на это занятие (`POST /api/teaching/activities/{id}/teams`), задать состав (`PUT /api/teaching/teams/{id}/members`) и закрепить ассистентов (`PUT /api/teaching/teams/{id}/assistant-links`).
5. Создать вопросы мини-теста (`POST /api/teaching/activities/{id}/mini-test/questions`). Можно добавить несколько вопросов — результат student-теста = процент верных × `MiniTestMaxBonus`.
6. Всё это можно сделать заблаговременно — студенты видят только то, что явно «опубликовано».

### 3.2 Начало пары

**Шаг A — Преподаватель открывает мини-тест:**
- `POST /api/teaching/activities/{id}/mini-test/publish`
- Сервер фиксирует `MiniTestPublished = true`, `MiniTestOpenedAt = now`.
- **SignalR** рассылает событие `MiniTestOpened` всем студентам занятия → в приложении появляется форма теста с таймером обратного отсчёта (`MiniTestDurationSeconds`).
- Пока таймер не истёк: студент отвечает на вопросы и нажимает «Сдать тест» (`POST /api/activities/{id}/mini-test/submit`).
- Ответ после дедлайна — `400 MiniTestClosed`.
- По истечении `MiniTestDurationSeconds` сервер (фоновый job или при следующем запросе) проверяет ответы и записывает `MiniTestAnswer.BonusAwarded`.

**Шаг B — Студенты начинают работу:**
- SignalR событие `ActivityStarted` → студенты видят свой TaskSet и состав команды.

### 3.3 Во время пары — студент (действия)

**Вызвать ассистента:**
```
POST /api/teams/{teamId}/help-requests
Body: { "message": "застряли на задаче 2" }   // message опционален
```
- Достаточно одного члена команды.
- Уведомление получают **все члены команды** + **все закреплённые ассистенты** (SignalR `HelpRequested` + хранимая Notification).

**Отметить задачу готовой к сдаче:**
```
POST /api/teams/{teamId}/tasks/{taskItemId}/ready
```
- Достаточно одного члена команды.
- Уведомление: **все члены команды** + **все ассистенты** (`TeamReadyToDefend`).
- Статус TaskSubmission переходит в `ReadyForReview`, фиксируется `ReadyAt`.

### 3.4 Во время пары — ассистент (действия)

**Посмотреть открытые запросы помощи:**
```
GET /api/activities/{activityId}/help-requests
```
→ список отсортирован по `CreatedAt` (FIFO).

**Закрыть запрос (после консультации):**
```
POST /api/help-requests/{helpRequestId}/resolve
```
→ SignalR `HelpResolved` команде.

**Посмотреть очередь сдач:**
```
GET /api/activities/{activityId}/team-submissions/pending
```
→ список отсортирован по `ReadyAt`.

**Начать приём задачи (указать защитника):**
```
POST /api/submissions/{submissionId}/team-review/start
Body: { "defenderUserId": "guid" }
```
- Ассистент сам выбирает студента из состава команды (любого).
- Статус → `InReview`.
- SignalR `ReviewStarted` всей команде + уведомление защитнику.

**Завершить приём:**
```
POST /api/submissions/{submissionId}/team-review/complete
Body: {
  "accepted": true,
  "result01": 1,
  "defenderCoefficient": 1.1,     // 0.8–1.2, опционально
  "groupCoefficient": 1.0          // 0.8–1.2 для всей команды, опционально
}
```
- Если `accepted = false` → статус `Rejected`, команда может дорешивать и снова нажать «Готов».
- SignalR `TaskAccepted` / `TaskRejected` всей команде.
- Если принято — ассистент **не обязан** сразу выставлять `groupCoefficient`; общий коэф команды за занятие можно выставить в конце пары.

**Выставить итоговый групповой коэффициент (конец пары):**
```
POST /api/activities/{activityId}/teams/{teamId}/group-score
Body: {
  "groupCoefficient": 1.1    // 0.8, 0.9, 1.0, 1.1, 1.2
}
```
- Сервер считает `TasksAccepted / TasksTotal`, вычисляет `BasePoints`, применяет `groupCoefficient`.
- Отсутствующие студенты (IsAbsent = true) получают личный коэф `0.8` вместо группового.
- Для каждого члена команды обновляется `StudentActivityScore.GroupPoints` и `GroupCoefficient`.

### 3.5 Конец пары — автоматический пересчёт

При закрытии Activity (Time > EndsAt) фоновый job:
1. Для каждого TeamGroupScore: `score = BasePoints * GroupCoeff + MiniTestBonus`
2. Записывает в `StudentActivityScore`.

---

## 4. Сценарий: Контрольная точка (ControlPoint)

### 4.1 Подготовка (Teacher/Admin)

1. Создать Activity типа `ControlPoint` (обычно 2 пары подряд, но это одна Activity с диапазоном `StartsAt`→`EndsAt`).
2. Создать TaskSet, добавить задачи (TaskItem) с кодами (например `КТ-1`…`КТ-5`).
3. Для каждой задачи назначить 1–3 ассистентов (`PUT /api/teaching/tasks/{id}/assistants`).
4. Настроить `KtMultiplierMapJson` на курсе (по умолчанию таблица из правил).

### 4.2 Первая пара — студент решает индивидуально

- Никаких командных действий.
- Когда студент решил задачу, он нажимает «Решил» → `POST /api/activities/{activityId}/kt/tasks/{taskItemId}/ready`
  - Фиксируется `ReadyAt` (используется для очереди).
  - Уведомление ассистентам, закреплённым за задачей.
  - Студент видит своё место в очереди: `GET /api/activities/{activityId}/kt/my-queue`

### 4.3 Вторая пара — ассистент принимает

**Очередь по задаче:**
```
GET /api/activities/{activityId}/kt/tasks/{taskItemId}/queue
```
→ список упорядочен по `ReadyAt` (кто раньше отметил — тот раньше в очереди).

**Вызвать следующего:**
```
POST /api/activities/{activityId}/kt/tasks/{taskItemId}/call-next
```
- Сервер ищет первого в очереди со статусом `ReadyForReview`, у которого **нет** другой задачи в статусе `InReview` (нельзя вызвать параллельно на две задачи).
- Статус → `InReview`, студенту SignalR `KtCalled` + уведомление «Вас вызвали на задачу КТ-X».

**Завершить приём:**
```
POST /api/activities/{activityId}/kt/submissions/{submissionId}/review/complete
Body: {
  "accepted": true,
  "result01": 1,
  "defenderCoefficient": null   // не используется для КТ, можно опустить
}
```
- Если `accepted = false` → статус `Rejected`. Студент **не может** повторно отметить задачу как готовую (задача провалена на этой КТ — пересдача невозможна если причина неуважительная, правила пункт 6 KT).
  - Исключение: Teacher/Admin может вручную сбросить статус через `PUT /api/teaching/submissions/{id}/reset`.
- SignalR `KtAccepted` / `KtRejected` студенту.

### 4.4 Подсчёт мультипликатора КТ

После закрытия Activity (или вручную Teacher через `POST /api/teaching/activities/{id}/kt/finalize`):
1. Для каждого студента считаем количество `TaskSubmission` с `Status = Accepted` и `StudentId = X`.
2. Ищем мультипликатор в `KtMultiplierMapJson` по `tasks_solved`.
3. Обновляем `StudentActivityScore.KtMultiplier` для студента.
4. Пересчитываем `ModuleScore` для всех занятий модуля перед этой КТ.

**Формула модуля:**
```
ModuleScore = (Sum по лекциям: GroupPoints * GroupCoeff + MiniTestBonus)
            + (Sum по ДЗ: HW_Points * TimeCoeff)
           ) * KtMultiplier
```

---

## 5. Сценарий: Домашние задания (HomeworkSession)

### 5.1 Подготовка (Teacher/Admin)

1. Для каждого модуля создаётся один Activity типа `HomeworkSession` (охватывает весь модуль, `EndsAt` = дата КТ модуля).
2. Создать TaskSet, добавить задачи. Каждая задача имеет `Points` (1 балл по умолчанию, можно другой).
3. Задачи выкладываются в начале модуля (`TaskSet` публикуется: `Published = true`).

### 5.2 Правила сдачи ДЗ

- Студент формирует группу 1–3 человека самостоятельно.
- Обязателен электронный вариант (ссылка на документ). Принимается только при наличии `DocumentUrl`.
- Задачи из **домашнего набора текущего модуля** сдаются до КТ этого модуля (`HomeworkSubmission.SubmittedAt < KT.StartsAt`).
- Задачи из **групповых занятий** можно пересдавать, но с коэффициентом:
  - до 7 дней после пары → `TimeCoefficient = 0.75`
  - позже 7 дней → `TimeCoefficient = 0.5`

### 5.3 Создание сдачи (студент)

```
POST /api/homework/submissions
Body: {
  "activityId": "guid",
  "taskItemId": "guid",
  "documentUrl": "https://docs.google.com/...",
  "memberUserIds": ["guid1", "guid2"]   // включая себя
}
```
- Сервер проверяет: 1–3 участника, все существуют, `documentUrl` непустой.
- Сервер вычисляет `TimeCoefficient`:
  - Если задача из HomeworkSession и `SubmittedAt < KT.StartsAt` → 1.0
  - Если задача из Lecture: считает разницу с `Activity.EndsAt` → 0.75 или 0.5
- Уведомление Teacher/ведущему ассистенту (кому смотреть очередь сдач на паре с ДЗ).

### 5.4 Очередь на занятии с ДЗ (HomeworkSession)

**Приоритеты в очереди (правило 9 ДЗ):**
1. Дорешивание задач последнего группового занятия
2. Задачи текущего домашнего набора
3. Дорешивание остальных

При равных приоритетах — FIFO по `SubmittedAt`.

```
GET /api/activities/{activityId}/homework-queue
```
→ возвращает список `HomeworkSubmission` с учётом приоритетов.

**Приём (Teacher/Assistant):**
```
POST /api/homework/submissions/{submissionId}/review/start
Body: { "studentToAskId": "guid" }   // любой из группы

POST /api/homework/submissions/{submissionId}/review/complete
Body: { "accepted": true, "result01": 1 }
```
- Если не принято → `Rejected`, группа может пересдать.
- Отводится 8 минут на сдачу; если не успели → `POST .../review/back-to-queue` → перемещаются в конец очереди.

**Таймер 8 минут:**  
Сервер фиксирует `ReviewStartedAt` при `start`. Контроль на стороне клиента (показывает таймер). Ассистент вручную нажимает «Обратно в очередь» или «Принято/Не принято».

---

## 6. Система уведомлений (SignalR + Stored)

### 6.1 SignalR Hub

```
/hubs/notifications
```
- Клиент подключается с JWT-токеном.
- Сервер добавляет пользователя в группу по `userId`.
- При любом `NotifyManyAsync` → `Clients.Group(userId).SendAsync("Notification", payload)`.

### 6.2 Типы уведомлений

| Type | Кому | Когда |
|---|---|---|
| `MiniTestOpened` | Все студенты занятия | Преподаватель открыл тест |
| `MiniTestClosed` | Все студенты занятия | Истекло время теста |
| `TeamHelpRequested` | Все члены команды + ассистенты | Команда вызвала ассистента |
| `HelpResolved` | Все члены команды | Ассистент закрыл запрос |
| `TeamReadyToDefend` | Все члены + ассистенты | Команда отметила готовность сдать задачу |
| `ReviewStarted` | Вся команда | Ассистент начал приём |
| `TaskAccepted` | Вся команда | Задача принята |
| `TaskRejected` | Вся команда | Задача не принята |
| `KtTaskReady` | Ассистенты задачи | Студент отметил готовность по задаче КТ |
| `KtCalled` | Студент | Его вызвали на сдачу задачи КТ |
| `KtAccepted` | Студент | КТ задача принята |
| `KtRejected` | Студент | КТ задача не принята |
| `HomeworkQueueUpdated` | Teacher/Assistants | Новая сдача ДЗ в очереди |

### 6.3 Хранимые уведомления

Каждый `NotifyManyAsync` → создаёт запись `Notification` для каждого получателя.  
`GET /api/notifications` — последние 100, с `ReadAt`.  
`POST /api/notifications/{id}/read` — пометить прочитанным.

---

## 7. Подсчёт итоговых баллов

### 7.1 Промежуточный балл студента за модуль

После каждой КТ (`finalize`):
```
ModuleScore[N] = (
    Σ(лекции) GroupPoints_i * GroupCoeff_i + MiniTestBonus_i
  + Σ(ДЗ) HW_Points_j * TimeCoeff_j
) * KtMultiplier[N]
```

### 7.2 Финальный балл

```
FinalScore = ModuleScore[1] + ModuleScore[2] + ModuleScore[3]
```

### 7.3 Итоговая оценка

Настраивается через `FinalGradingTableJson` на курсе. Дефолтная таблица:
```json
[
  {"min":233,"mark":"5+"},
  {"min":215,"mark":"5"},
  {"min":200,"mark":"5-"},
  {"min":183,"mark":"4+"},
  {"min":166,"mark":"4"},
  {"min":150,"mark":"4-"},
  {"min":131,"mark":"3+"},
  {"min":113,"mark":"3"},
  {"min":92,"mark":"3-"},
  {"min":75,"mark":"2+"},
  {"min":60,"mark":"2"},
  {"min":0,"mark":"2-"}
]
```

```
GET /api/courses/{courseId}/students/{studentId}/score
→ { finalScore, mark, moduleScores: [{module:1, score:...}, ...] }
```

---

## 8. Алгоритм формирования команд

> Источник: прямой ответ преподавателя курса.

### 8.1 Логика по этапам семестра

| Этап | Алгоритм |
|---|---|
| **Первая лекция** | Чистый рандом — баллов ещё нет |
| **Лекции 2…KT1** | Балансировка по **сырым баллам**: сортируем студентов по `RawScore`, распределяем «змейкой» (draft-style) чтобы среднее по командам было примерно равным |
| **После КТ1 и далее** | Балансировка по **итоговым баллам** (`FinalScore` с учётом KT-мультипликатора), та же змейка |

### 8.2 Что учитывать при авто-формировании

- Студенты, которые **не пришли** (IsAbsent или не подтвердили присутствие) — исключаются из авто-распределения.
- До начала пары студент может попросить обмен (swap с другим студентом из другой команды) — **Teacher вручную** через UI: `PUT /api/teaching/teams/{teamId}/swap-member`.
- Если по факту начала пары команды сильно неравномерны по числу людей — Teacher вручную перемещает студентов.

### 8.3 Ассистенты на пару

- Не все ассистенты присутствуют на каждой паре — для каждого Activity указывается **список активных ассистентов** (`ActivityAssistant`).
- Распределение ассистентов по командам: **рандом** среди активных на этой паре (ручная правка через UI).
- Один ассистент может вести несколько команд одновременно.

### 8.4 Новые сущности для формирования

```csharp
// Ассистент, подтвердивший участие в конкретном занятии
public sealed class ActivityAssistant
{
    public Guid ActivityId { get; set; }
    public Guid AssistantId { get; set; }
}

// Операция обмена студентов между командами (лог для аудита)
public sealed class TeamSwapLog
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }
    public Guid StudentAId { get; set; }   // ушёл из TeamA
    public Guid TeamAId { get; set; }
    public Guid StudentBId { get; set; }   // ушёл из TeamB
    public Guid TeamBId { get; set; }
    public Guid InitiatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

### 8.5 API для формирования команд

```
POST /api/teaching/activities/{id}/teams/auto-generate
Body: {
  "strategy": "random" | "balance_raw" | "balance_final",
  "teamSize": 4,           // желаемый размер команды
  "excludeAbsent": true    // исключить отсутствующих
}
→ Генерирует команды (сухая транзакция: удаляет старые TeamMember, создаёт новые)

POST /api/teaching/activities/{id}/assistants/auto-assign
→ Случайно раздаёт активных ассистентов по командам

PUT /api/teaching/teams/{teamId}/swap-member
Body: { "studentAId": "guid", "studentBId": "guid", "otherTeamId": "guid" }
→ Обменивает двух студентов между командами, пишет TeamSwapLog
```

### 8.6 КТ: ассистенты видят задачи заранее

- Задачи КТ доступны ассистентам **до начала КТ** (роль Assistant видит TaskItem при `Activity.Type == ControlPoint`).
- Преподаватель перед КТ назначает ассистентов на задачи через `PUT /api/teaching/tasks/{id}/assistants` — ассистент сам выбирает задачу(и), которую будет принимать, преподаватель фиксирует.
- Студенты **не видят** задачи КТ до `Activity.StartsAt`.

---

## 9. Админ-панель преподавателя — что должно настраиваться

Все параметры редактируются через UI. Ни одно значение не хардкодится в коде.

### 8.1 Управление курсом

- Создать/редактировать курс: `Code`, `Title`, `AcademicYear`
- Редактировать `KtMultiplierMapJson` (таблица мультипликаторов КТ)
- Редактировать `FinalGradingTableJson` (таблица оценок)
- Управление модулями: создать, редактировать даты

### 8.2 Управление занятиями

- Создать занятие (тип, название, дата/время)
- Редактировать `LectureBasePoints`, `MiniTestMaxBonus`, `MiniTestDurationSeconds`
- Загрузить/изменить ссылку `PreLectureVideoUrl`
- Создать/редактировать/удалить вопросы мини-теста
- Создать/редактировать/удалить задачи (TaskItem): код, условие, баллы

### 9.3 Управление командами

- Создать/переименовать/удалить команды
- Задать состав команды (из списка студентов курса)
- Закрепить ассистентов за командой
- Отметить студента как отсутствующего (`IsAbsent = true`)
- Обменять студентов между командами (до начала пары)

### 8.4 Управление ассистентами

- Назначить ассистентов на задачи КТ
- Просмотреть нагрузку ассистента (сколько команд/задач за ним)

### 8.5 Управление баллами (ручная корректировка)

- Просмотр таблицы баллов всего потока
- Ручное изменение `GroupCoefficient` команды за занятие
- Ручной сброс статуса `TaskSubmission` (для исключительных случаев)
- Просмотр финальных баллов и оценок

---

## 9. Страницы фронтенда

### 9.1 Студент

| Страница | Содержимое |
|---|---|
| `/` (дашборд) | Ближайшее занятие, непрочитанные уведомления, мои баллы по модулям |
| `/lecture/{activityId}` | Видео до пары, задачи команды, кнопки «Позвать ассистента» / «Готов сдать», мини-тест (если открыт) |
| `/kt/{activityId}` | Список задач КТ, кнопки «Решил задачу X», моя позиция в очереди по каждой задаче, статусы |
| `/homework` | Список задач ДЗ по модулям, форма создания сдачи (ссылка + участники) |
| `/scores` | Подробная таблица баллов за каждое занятие, КТ, ДЗ, итог |
| `/notifications` | Список всех уведомлений с пометкой прочитанных |

### 9.2 Ассистент

| Страница | Содержимое |
|---|---|
| `/assistant/session/{activityId}` | Мои команды на этой паре. **Панель вызовов** (HelpRequests по FIFO). **Очередь сдач** (TeamSubmissions по ReadyAt). Кнопки «Начать приём», «Принять», «Отправить дорешивать». |
| `/assistant/kt/{activityId}` | По каждой задаче: очередь студентов, кнопка «Вызвать следующего», кнопка «Принято/Не принято». |
| `/assistant/homework/{activityId}` | Очередь ДЗ с приоритетами, приём, таймер 8 минут. |

### 9.3 Teacher/Admin

| Страница | Содержимое |
|---|---|
| `/admin/courses` | CRUD курсов, настройка KT/грейдинг таблиц |
| `/admin/courses/{id}/modules` | CRUD модулей |
| `/admin/activities/{id}` | Настройка занятия, видео, мини-тест, задачи |
| `/admin/activities/{id}/teams` | Управление командами, состав, ассистенты |
| `/admin/activities/{id}/kt` | Назначение ассистентов на задачи КТ |
| `/admin/users` | Список пользователей, назначение ролей |
| `/admin/scores/{courseId}` | Сводная таблица баллов потока |

---

## 10. API — сводка новых эндпоинтов

### Мини-тест

```
POST   /api/teaching/activities/{id}/mini-test/questions        # добавить вопрос
PUT    /api/teaching/activities/{id}/mini-test/questions/{qId}  # редактировать
DELETE /api/teaching/activities/{id}/mini-test/questions/{qId}  # удалить
POST   /api/teaching/activities/{id}/mini-test/publish          # открыть тест (Teacher)
GET    /api/activities/{id}/mini-test                           # получить вопросы (студент, пока открыт)
POST   /api/activities/{id}/mini-test/submit                    # сдать ответы (студент)
```

### Групповой балл команды

```
POST /api/activities/{activityId}/teams/{teamId}/group-score
Body: { "groupCoefficient": 1.1 }
```

### Финализация КТ

```
POST /api/teaching/activities/{id}/kt/finalize   # пересчитать KtMultiplier и ModuleScore
```

### ДЗ

```
POST   /api/homework/submissions                              # создать сдачу
GET    /api/activities/{activityId}/homework-queue            # очередь для ассистента
POST   /api/homework/submissions/{id}/review/start            # начать приём
POST   /api/homework/submissions/{id}/review/complete         # завершить приём
POST   /api/homework/submissions/{id}/review/back-to-queue    # вернуть в конец очереди
```

### Баллы и оценки

```
GET /api/courses/{courseId}/students/{studentId}/score
GET /api/courses/{courseId}/scores           # вся сводная таблица (Teacher/Admin)
```

### Сброс статуса сдачи

```
PUT /api/teaching/submissions/{id}/reset     # Teacher/Admin: сбросить в Draft
```

---

## 11. Real-time (SignalR)

Hub: `/hubs/notifications`

**Клиент подключается:**
```js
const connection = new HubConnectionBuilder()
  .withUrl("/hubs/notifications", { accessTokenFactory: () => jwt })
  .withAutomaticReconnect()
  .build();

connection.on("Notification", (payload) => {
  // payload: { type, title, body, createdAt }
  // обновляем UI соответственно типу
});
```

**Важные обновления по типу:**
- `MiniTestOpened` → показать форму теста с таймером
- `KtCalled` → показать алерт «Идите к ассистенту, задача КТ-X»
- `TaskAccepted/Rejected` → обновить статус задачи в UI
- `TeamHelpRequested` → у ассистента звуковой/визуальный сигнал, появляется в списке

---

## 12. Бизнес-правила (чеклист для имплементации)

- [ ] Студент не может вызвать ассистента дважды подряд (пока предыдущий Open)
- [ ] Студент не может отметить задачу «Готов», если она уже `Accepted`
- [ ] Студент не может быть вызван на два КТ-задания одновременно (`InReview` по двум задачам)
- [ ] Очередь КТ: порядок строго по `ReadyAt` (первым отметил — первым вызовут)
- [ ] Задача КТ после `Rejected` не может быть снова отмечена студентом без Teacher/Admin сброса
- [ ] ДЗ: `documentUrl` обязателен, группа 1–3 человека
- [ ] ДЗ: `TimeCoefficient` вычисляется автоматически при создании `HomeworkSubmission`
- [ ] Ассистент может принимать только у команд/задач, за которыми он закреплён (Teacher/Admin — всё)
- [ ] Опоздавшие более 5 минут не попадают в команду (не реализуется системой — это ручное управление через «MarkAbsent»)
- [ ] `GroupCoefficient` для отсутствующего студента (`IsAbsent = true`) всегда `0.8` независимо от коэффициента команды
- [ ] Мини-тест: ответы принимаются только пока `MiniTestPublished = true` и `now < MiniTestOpenedAt + MiniTestDurationSeconds`
- [ ] Все пороговые значения (0.8/1.2 коэф, 5 мин теста, 8 мин ДЗ-приём) — берутся из настроек курса/занятия, не из кода

---

## 13. База данных — новые таблицы (EF Core)

```
MiniTestQuestions  (Id, ActivityId, Order, Text, OptionsJson, CorrectOptionIndex)
MiniTestAnswers    (Id, ActivityId, StudentId, QuestionId, SelectedOptionIndex, AnsweredAt, BonusAwarded)
HomeworkSubmissions (Id, ActivityId, TaskItemId, DocumentUrl, SubmittedAt, Status, ReviewerId, ReviewedAt, Result01, TimeCoefficient)
HomeworkSubmissionMembers (HomeworkSubmissionId, UserId)
TeamGroupScores    (Id, TeamId, ActivityId, TasksAccepted, TasksTotal, BasePoints, GroupCoefficient, UpdatedAt)
StudentActivityScores (Id, ActivityId, StudentId, GroupPoints, GroupCoefficient, MiniTestBonus, HomeworkPoints, HomeworkTimeCoefficient, KtMultiplier, ModuleScore, UpdatedAt)
```

Изменения в существующих:
```
Activity: + PreLectureVideoUrl, LectureBasePoints, MiniTestMaxBonus, MiniTestDurationSeconds, MiniTestPublished, MiniTestOpenedAt
Course:   + KtMultiplierMapJson, FinalGradingTableJson
TeamMember: IsAbsent уже есть ✓
```
