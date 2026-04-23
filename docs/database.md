# База данных

База хранит данные авторизации, метаданные комнат, участников, ответы и финальные результаты.

## Таблицы

## `user`

Пользователи приложения, управляемые better-auth.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text / uuid | Primary key. |
| `name` | text | Отображаемое имя или никнейм. |
| `email` | text | Уникальный email для входа. |
| `emailVerified` | boolean | Статус подтверждения email. |
| `image` | text nullable | Опциональный аватар. |
| `createdAt` | timestamp | Время создания аккаунта. |
| `updatedAt` | timestamp | Время последнего обновления. |

Зачем нужна: идентичность пользователя требуется для владения комнатами, привязки счёта и личной истории.

## `session`

Активные сессии better-auth.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text / uuid | Primary key. |
| `token` | text | Уникальный session token. |
| `userId` | text / uuid | Ссылка на `user.id`. |
| `expiresAt` | timestamp | Время истечения сессии. |
| `ipAddress` | text nullable | Метаданные для аудита. |
| `userAgent` | text nullable | Метаданные для аудита. |
| `createdAt` | timestamp | Время создания. |
| `updatedAt` | timestamp | Время обновления. |

Зачем нужна: protected API-процедуры опираются на активную сессию.

## `account`

Данные провайдера авторизации.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text / uuid | Primary key. |
| `accountId` | text | Идентификатор аккаунта у провайдера. |
| `providerId` | text | Название провайдера. |
| `userId` | text / uuid | Ссылка на `user.id`. |
| `password` | text nullable | Хэш пароля для email/password auth. |
| `createdAt` | timestamp | Время создания. |
| `updatedAt` | timestamp | Время обновления. |

Зачем нужна: отделяет пользователя от способа авторизации.

## `verification`

Токены верификации better-auth.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text / uuid | Primary key. |
| `identifier` | text | Email или цель проверки. |
| `value` | text | Значение токена. |
| `expiresAt` | timestamp | Время истечения. |
| `createdAt` | timestamp nullable | Время создания. |
| `updatedAt` | timestamp nullable | Время обновления. |

Зачем нужна: поддерживает безопасные auth-flow.

## `rooms`

Состояние комнаты и игры.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `ownerId` | uuid | Ссылка на `user.id`. |
| `n` | integer | Дистанция N-back. |
| `length` | integer | Количество стимулов. |
| `baseIntervalMs` | integer | Начальный интервал. |
| `currentIntervalMs` | integer | Текущий интервал после штрафов. |
| `status` | enum | `lobby`, `running`, `finished`. |
| `sequenceJson` | jsonb | Сгенерированная последовательность стимулов. |
| `startedAt` | timestamp nullable | Время старта. |
| `finishedAt` | timestamp nullable | Время завершения. |
| `winnerUserId` | uuid nullable | Победитель. |
| `createdAt` | timestamp | Время создания. |

Зачем нужна: комната — durable-контейнер одной общей игровой сессии.

## `room_players`

Участники комнаты и их счёт.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `roomId` | uuid | Ссылка на `rooms.id`. |
| `userId` | uuid | Ссылка на `user.id`. |
| `displayName` | text | Имя в таблице результатов. |
| `correct` | integer | Количество верных ответов. |
| `errors` | integer | Количество ошибок. |
| `penalty` | integer | Штрафы. |
| `joinedAt` | timestamp | Время присоединения. |

Зачем нужна: счёт принадлежит пользователю внутри конкретной комнаты, а не глобально.

## `responses`

Отправленные ответы.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `roomId` | uuid | Ссылка на `rooms.id`. |
| `userId` | uuid | Ссылка на `user.id`. |
| `stimulusIndex` | integer | Индекс стимула, на который ответил игрок. |
| `expectedMatch` | boolean | Серверное ожидание совпадения. |
| `isCorrect` | boolean | Корректность ответа. |
| `intervalAfterMs` | integer | Интервал после возможного штрафа. |
| `createdAt` | timestamp | Время ответа. |

Зачем нужна: ответы дают аудитируемость и позволяют строить подробную историю.

## ER-описание

```text
user 1 ── * session
user 1 ── * account
user 1 ── * rooms          через rooms.ownerId
user 1 ── * room_players
user 1 ── * responses

rooms 1 ── * room_players
rooms 1 ── * responses
rooms 1 ── 0..1 user       через rooms.winnerUserId
```

## Правила сохранения

- Настройки комнаты неизменяемы после старта.
- Состав игроков неизменяем после старта.
- Ответы append-only.
- Победитель записывается при переходе комнаты в `finished`.
- Поля счёта в `room_players` обновляются только после серверной проверки ответа.

