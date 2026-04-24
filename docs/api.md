# API

API реализован через tRPC. Процедуры ниже описывают реальный контракт между клиентом и сервером.

## Общие типы

### RoomStatus

```ts
type RoomStatus = "lobby" | "running" | "finished";
```

### GameMode

```ts
type GameMode = "classic" | "recent-5" | "go-no-go" | "reaction-time" | "stroop";
```

### SubmitResult

```ts
type SubmitResult = {
  stimulusIndex: number;
  isCorrect: boolean;
  expectedMatch: boolean | null;
  speedChanged: boolean;
  currentIntervalMs: number;
  finished: boolean;
  ignored: boolean;
  reason: "duplicate" | "late" | "waiting" | null;
  reactionTime: number | null;
  falseStart: boolean;
};
```

## `game.create`

| Свойство | Значение |
| --- | --- |
| Тип | Mutation |
| Auth | Требуется |

### Input

```ts
{
  n: 2 | 3 | 4;
  mode: GameMode;
  tournament: boolean;
  length: number;
  baseIntervalMs: number;
  goRatio: number;
  botAccuracy: number | null;
}
```

### Validation

| Поле | Правило |
| --- | --- |
| `n` | Только `2`, `3` или `4`. Для не-grid режимов сохраняется как совместимый параметр комнаты. |
| `mode` | Один из поддерживаемых режимов. |
| `length` | От `12` до `120`. |
| `baseIntervalMs` | От `450` до `4000`. |
| `goRatio` | От `0.4` до `0.9`, используется только в Go / No-Go. |
| `botAccuracy` | От `0.1` до `0.99` или `null`. |

### Output

Возвращает публичное состояние комнаты: настройки, текущий стимул, игроков, метрики и последний результат стимула.

## `game.join`

| Свойство | Значение |
| --- | --- |
| Тип | Mutation |
| Auth | Требуется |

### Input

```ts
{
  roundId: string;
}
```

### Validation

- комната должна существовать;
- статус комнаты должен быть `lobby`;
- игроков должно быть меньше 4.

## `game.start`

| Свойство | Значение |
| --- | --- |
| Тип | Mutation |
| Auth | Требуется |

### Input

```ts
{
  roundId: string;
}
```

### Validation

- запускать может только владелец;
- комната должна быть в `lobby`;
- в комнате должно быть 2-4 участника.

## `game.submit`

Основная точка отправки ответа для всех тренажеров.

| Свойство | Значение |
| --- | --- |
| Тип | Mutation |
| Auth | Требуется |

### Input

```ts
{
  roundId: string;
  answer?: string;
}
```

### Поведение по режимам

| Режим | Что отправляет клиент |
| --- | --- |
| `classic` | пустой submit при клике |
| `recent-5` | пустой submit при клике |
| `go-no-go` | пустой submit при клике |
| `reaction-time` | пустой submit при клике |
| `stroop` | `answer` со значением цвета |

### Output

```ts
{
  round: PublicRound;
  result: SubmitResult;
}
```

### Edge cases

| Ситуация | Результат |
| --- | --- |
| duplicate click | `ignored: true`, `reason: "duplicate"` |
| late click | `ignored: true`, `reason: "late"` |
| false start | `falseStart: true`, штраф применяется на сервере |

## `game.submitAnswer`

Алиас для `game.submit` с тем же input и output. Нужен как более явное имя контракта для внешних интеграций.

## `game.list`

Возвращает все активные комнаты. Перед ответом сервер:

- продвигает таймеры;
- завершает просроченные стимулы;
- применяет автоматические miss/omit правила;
- обрабатывает действия ботов;
- обновляет scoreboard.

## `game.myHistory`

Возвращает завершенные игры текущего пользователя.

## `game.tournaments`

Возвращает завершенные турнирные раунды.

## `game.myTournaments`

Возвращает только те турниры, где текущий пользователь участвовал.

## `game.finish`

Ручное завершение раунда владельцем.

## `game.next`

Создание следующего раунда с тем же составом игроков и теми же настройками.

## `game.close`

Закрытие лобби владельцем. Если раунд ещё идет, сервер сначала его завершает.

## `stats.getRating`

Возвращает текущий рейтинг игрока, его ранг и последние изменения из `rating_history`.

### Input

```ts
{
  userId?: string;
}
```

Если `userId` не передан, используется текущий пользователь.

## `stats.getLeaderboard`

Возвращает таблицу лидеров по ELO.

### Input

```ts
{
  limit?: number;
}
```

### Output

```ts
Array<{
  place: number;
  id: string;
  name: string;
  rating: number;
  rank: string;
}>
```

## Rated lobby notes

`game.create` also accepts:

```ts
{
  rated: boolean;
}
```

Rules:

- if `rated === true`, the server applies ELO after the round finishes;
- rated lobbies reject bots;
- `stats.getRating` is used by the dedicated stats page;
- `stats.getLeaderboard` powers the global leaderboard.
