# Realtime

Realtime-обновления доставляются через tRPC subscriptions поверх WebSocket.

Цель — синхронизировать клиентов с серверной временной шкалой без polling.

## Connection Flow

1. Клиент авторизуется через better-auth.
2. Клиент открывает WebSocket-соединение.
3. Клиент подписывается на `game.subscribe` с `roomId`.
4. Сервер проверяет доступ.
5. Сервер отправляет актуальный snapshot комнаты.
6. Сервер отправляет события по мере изменения игры.

## Event Envelope

Все realtime-сообщения используют общий envelope:

```json
{
  "event": "game:update",
  "roomId": "room_123",
  "sequence": 42,
  "sentAt": "2026-04-23T10:00:12.000Z",
  "payload": {}
}
```

| Поле | Описание |
| --- | --- |
| `event` | Имя события. |
| `roomId` | Комната, к которой относится событие. |
| `sequence` | Монотонный серверный номер события. |
| `sentAt` | Серверное время отправки. |
| `payload` | Данные конкретного события. |

`sequence` позволяет клиенту игнорировать устаревшие или пришедшие не по порядку сообщения.

## События

## `game:start`

Отправляется, когда владелец запускает игру.

```json
{
  "event": "game:start",
  "roomId": "room_123",
  "sequence": 1,
  "sentAt": "2026-04-23T10:00:00.000Z",
  "payload": {
    "status": "running",
    "startedAt": "2026-04-23T10:00:00.000Z",
    "currentIndex": 0,
    "currentPosition": 4,
    "currentIntervalMs": 1600
  }
}
```

## `game:tick`

Отправляется при смене активного стимула.

```json
{
  "event": "game:tick",
  "roomId": "room_123",
  "sequence": 12,
  "sentAt": "2026-04-23T10:00:17.600Z",
  "payload": {
    "currentIndex": 11,
    "currentPosition": 2,
    "currentIntervalMs": 1440
  }
}
```

## `game:update`

Отправляется при изменении счёта, ошибок, штрафов, состава комнаты или интервала.

```json
{
  "event": "game:update",
  "roomId": "room_123",
  "sequence": 15,
  "sentAt": "2026-04-23T10:00:19.000Z",
  "payload": {
    "currentIntervalMs": 1296,
    "players": [
      {
        "userId": "user_1",
        "displayName": "Alice",
        "correct": 6,
        "errors": 3,
        "penalty": 3
      }
    ]
  }
}
```

## `game:end`

Отправляется при завершении игры.

```json
{
  "event": "game:end",
  "roomId": "room_123",
  "sequence": 60,
  "sentAt": "2026-04-23T10:01:10.000Z",
  "payload": {
    "status": "finished",
    "winnerUserId": "user_1",
    "finishedAt": "2026-04-23T10:01:10.000Z"
  }
}
```

## Синхронизация клиентов

Клиенты должны:

- Считать серверные timestamps авторитетными.
- Применять событие с наибольшим `sequence`.
- После reconnect запрашивать свежий snapshot.
- Отключать ввод ответа, если локальное состояние не `running`.
- Не изменять счёт локально до подтверждения сервера.

## Reconnect

При переподключении:

1. Клиент заново открывает WebSocket.
2. Клиент подписывается на `game.subscribe`.
3. Сервер отправляет актуальный snapshot.
4. Клиент заменяет локальное состояние snapshot-ом.
5. Клиент продолжает отображение по серверному состоянию.

Такой подход не требует проигрывать пропущенные события и предотвращает рассинхронизацию после временной потери сети.

