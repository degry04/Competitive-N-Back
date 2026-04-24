# Competitive N-Back

Соревновательный набор когнитивных тренажёров для 2–4 игроков. Сервер генерирует стимулы, проверяет ответы, подсчитывает метрики и применяет штрафы, которые могут ускорять раунд для всех участников.

## Доступные тренажёры

- `N-back`
- `Recent-5`
- `Go / No-Go`
- `Reaction Time`
- `Stroop Test`

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
- `docs/deployment.md` — развёртывание  
- `docs/roadmap.md` — планы развития проекта  

## Технологический стек

- Next.js + TypeScript  
- tRPC  
- Drizzle ORM + SQLite/libSQL  
- better-auth  
- Vitest  
- Zod  

## Запуск

## Режим разработки (Development)
```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run dev
```

###Продакшен (Production)
```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run build
npm start
```
##Тесты

```powershell
npm test
```

