# Когнитивная арена

Соревновательный набор когнитивных тренажеров для 2-4 игроков. Сервер генерирует стимулы, проверяет ответы, считает метрики и применяет штрафы, которые могут ускорять раунд для всех участников.

## Доступные тренажеры

- `N-назад`
- `Последние 5`
- `Действуй / не действуй`
- `Скорость реакции`
- `Тест Струпа`

## Документация

Все подробные материалы находятся в папке `docs/`:

- `docs/README.md` — обзор проекта
- `docs/architecture.md` — архитектура
- `docs/game-design.md` — правила и игровые режимы
- `docs/api.md` — API на базе tRPC
- `docs/database.md` — схема базы данных
- `docs/realtime.md` — модель работы в реальном времени
- `docs/security.md` — безопасность
- `docs/testing.md` — тестирование
- `docs/deployment.md` — развертывание
- `docs/roadmap.md` — планы развития проекта

## Технологический стек

- Next.js + TypeScript
- tRPC
- Drizzle ORM + SQLite/libSQL
- better-auth
- Vitest
- Zod

## Режим разработки

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run dev
```

## Продакшен

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
