# Competitive N-Back

Соревновательный набор когнитивных тренажеров для 2-4 игроков. Сервер генерирует стимулы, валидирует ответы, считает метрики и применяет штрафы, которые могут ускорять раунд для всех участников.

## Доступные тренажеры

- `N-back`
- `Recent-5`
- `Go / No-Go`
- `Reaction Time`
- `Stroop Test`

## Документация

Все подробные материалы лежат в папке `docs/`:

- `docs/README.md` — обзор проекта
- `docs/architecture.md` — архитектура
- `docs/game-design.md` — правила и игровые режимы
- `docs/api.md` — tRPC API
- `docs/database.md` — схема БД
- `docs/realtime.md` — realtime-модель
- `docs/security.md` — безопасность
- `docs/testing.md` — тестирование
- `docs/deployment.md` — развёртывание
- `docs/roadmap.md` — развитие проекта

## Стек

- Next.js + TypeScript
- tRPC
- Drizzle ORM + SQLite/libSQL
- better-auth
- Vitest
- Zod

## Запуск

### Development

PowerShell:

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run dev
```
```bash
npm run build 
npm start
```

### Production

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run build
npm start
```

## Тесты

```powershell
npm test
```

## Rated Lobbies

- Rated lobby is created from the main lobby form.
- ELO changes only after a finished rated match.
- Bots are disabled for rated matches.
- Rating, rank, and rating history are displayed on the separate `/stats` page.
