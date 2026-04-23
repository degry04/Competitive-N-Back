# API

API реализован через tRPC. Имена процедур рассматриваются как контракт между frontend и backend.

Все protected-процедуры требуют активную сессию better-auth.

## Общие типы

### RoomStatus

```ts
type RoomStatus = "lobby" | "running" | "finished";
```

### GameMode

```ts
type GameMode = "classic";
```

### PublicRoom

```ts
type PublicRoom = {
  id: string;
  ownerId: string;
  status: RoomStatus;
  n: 2 | 3 | 4;
  length: number;
  baseIntervalMs: number;
  currentIntervalMs: number;
  currentIndex: number;
  currentPosition: number | null;
  players: PublicPlayer[];
  winnerUserId: string | null;
};
```

### PublicPlayer

```ts
type PublicPlayer = {
  userId: string;
  displayName: string;
  correct: number;
  errors: number;
  penalty: number;
};
```

## `room.create`

| Свойство | Значение |
| --- | --- |
| Тип | Mutation |
| Auth | Требуется |

### Input

```ts
{
  n: 2 | 3 | 4;
  length: number;
  baseIntervalMs: number;
}
```

### Validation

| Поле | Правило |
| --- | --- |
| `n` | Только `2`, `3` или `4`. |
| `length` | Должно быть больше `n`. Рекомендуемый диапазон: `12-120`. |
| `baseIntervalMs` | Не меньше `450`. |

### Output

```ts
PublicRoom
```

### Ошибки

| Код | Причина |
| --- | --- |
| `UNAUTHORIZED` | Пользователь не авторизован. |
| `BAD_REQUEST` | Некорректные настройки комнаты. |

### Пример

```json
{
  "n": 2,
  "length": 30,
  "baseIntervalMs": 1600
}
```

## `room.join`

| Свойство | Значение |
| --- | --- |
| Тип | Mutation |
| Auth | Требуется |

### Input

```ts
{
  roomId: string;
}
```

### Validation

| Правило | Причина |
| --- | --- |
| Комната существует | Нельзя присоединиться к удалённой или несуществующей комнате. |
| Статус комнаты `lobby` | В запущенную игру нельзя добавлять игроков. |
| Игроков меньше 4 | Соблюдается лимит multiplayer-сессии. |

### Output

```ts
PublicRoom
```

### Ошибки

| Код | Причина |
| --- | --- |
| `UNAUTHORIZED` | Пользователь не авторизован. |
| `NOT_FOUND` | Комната не найдена. |
| `BAD_REQUEST` | Комната заполнена или уже запущена. |

## `room.start`

| Свойство | Значение |
| --- | --- |
| Тип | Mutation |
| Auth | Требуется |

### Input

```ts
{
  roomId: string;
}
```

### Validation

| Правило | Причина |
| --- | --- |
| Вызывающий пользователь — владелец | Только создатель комнаты управляет стартом. |
| Комната в статусе `lobby` | Защита от повторного запуска. |
| Игроков 2-4 | Сессия должна быть соревновательной. |

### Output

```ts
PublicRoom
```

### Ошибки

| Код | Причина |
| --- | --- |
| `FORBIDDEN` | Пользователь не владелец комнаты. |
| `BAD_REQUEST` | Комната не готова или не находится в lobby. |
| `NOT_FOUND` | Комната не найдена. |

## `game.submitAnswer`

| Свойство | Значение |
| --- | --- |
| Тип | Mutation |
| Auth | Требуется |

### Input

```ts
{
  roomId: string;
}
```

Клиент не отправляет `stimulusIndex` или `isMatch`. Сервер сам определяет активный стимул по авторитетному времени.

### Output

```ts
{
  room: PublicRoom;
  result: {
    stimulusIndex: number;
    expectedMatch: boolean;
    isCorrect: boolean;
    speedChanged: boolean;
    currentIntervalMs: number;
    finished: boolean;
  };
}
```

### Validation

| Правило | Причина |
| --- | --- |
| Игра запущена | Ответы допустимы только во время активной игры. |
| Пользователь является игроком комнаты | Наблюдатели не влияют на счёт. |
| Один ответ на игрока на стимул | Защита от спама и накрутки счёта. |

### Ошибки

| Код | Причина |
| --- | --- |
| `UNAUTHORIZED` | Пользователь не авторизован. |
| `NOT_FOUND` | Комната не найдена. |
| `BAD_REQUEST` | Игра не запущена или ответ повторный. |

## `game.subscribe`

| Свойство | Значение |
| --- | --- |
| Тип | Subscription |
| Auth | Требуется |

### Input

```ts
{
  roomId: string;
}
```

### Output

```ts
{
  event: "game:start" | "game:tick" | "game:update" | "game:end";
  roomId: string;
  sequence: number;
  sentAt: string;
  payload: unknown;
}
```

### Payload событий

#### `game:start`

```json
{
  "status": "running",
  "startedAt": "2026-04-23T10:00:00.000Z",
  "currentIntervalMs": 1600
}
```

#### `game:tick`

```json
{
  "currentIndex": 8,
  "currentPosition": 4,
  "currentIntervalMs": 1440
}
```

#### `game:update`

```json
{
  "players": [
    {
      "userId": "user_1",
      "displayName": "Alice",
      "correct": 5,
      "errors": 1,
      "penalty": 1
    }
  ]
}
```

#### `game:end`

```json
{
  "winnerUserId": "user_1",
  "finishedAt": "2026-04-23T10:01:10.000Z"
}
```

### Ошибки

| Код | Причина |
| --- | --- |
| `UNAUTHORIZED` | Пользователь не авторизован. |
| `NOT_FOUND` | Комната не найдена. |

