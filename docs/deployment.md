# Развёртывание

## Production-требования

| Требование | Версия |
| --- | --- |
| Node.js | 20+ |
| PostgreSQL | 15+ |
| npm | Последняя stable |

## Переменные окружения

| Переменная | Обязательна | Описание |
| --- | --- | --- |
| `DATABASE_URL` | Да | PostgreSQL connection string для Drizzle. |
| `BETTER_AUTH_SECRET` | Да | Секрет better-auth. Должен быть длинным и случайным. |
| `BETTER_AUTH_URL` | Да | Публичный origin приложения. |
| `NEXT_PUBLIC_APP_URL` | Да | Публичный URL приложения для frontend. |

Пример:

```bash
DATABASE_URL="postgresql://app_user:strong_password@db:5432/competitive_nback"
BETTER_AUTH_SECRET="a-long-random-production-secret"
BETTER_AUTH_URL="https://nback.example.com"
NEXT_PUBLIC_APP_URL="https://nback.example.com"
```

## Настройка базы данных

1. Создайте PostgreSQL database.
2. Создайте пользователя БД с правами на миграции и runtime-доступ.
3. Укажите `DATABASE_URL`.
4. Запустите миграции:

```bash
npm run db:migrate
```

## Сборка

```bash
npm install
npm run build
```

Production-сервер требует готовую `.next` сборку. Запуск `next start` без `next build` падает, потому что отсутствует production build ID.

## Запуск

```bash
npm start
```

Порт по умолчанию:

```text
3000
```

Кастомный порт:

```bash
npm start -- --port 8080
```

## Production-процесс

Подходящие process managers:

- systemd;
- Docker;
- PM2;
- managed Node runtime платформы.

Процесс должен поддерживать:

- долгоживущие WebSocket-соединения;
- graceful shutdown;
- передачу переменных окружения;
- restart on failure.

## Reverse Proxy

Если используется Nginx или другой reverse proxy, необходимо прокидывать WebSocket upgrade headers.

Пример Nginx:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Проверки перед релизом

```bash
npm test
npm run build
```

Проверить вручную:

- пользователь может зарегистрироваться и войти;
- комната создаётся;
- несколько клиентов подключаются к одной комнате;
- realtime-обновления приходят;
- ответы обновляют счёт на сервере;
- завершённые игры сохраняются.

