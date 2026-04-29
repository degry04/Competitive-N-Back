# Инструменты разработки

Этот документ описывает инструменты и процессы для поддержания качества кода в проекте Competitive N-Back.

## Установка и настройка

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка Husky (pre-commit хуки)
```bash
npm run setup:husky
```

Хуки автоматически установятся при следующем `npm install` благодаря скрипту `prepare`.

## Доступные скрипты

### Линтинг и форматирование
- `npm run lint` - проверка кода с ESLint
- `npm run lint:fix` - автоматическое исправление проблем ESLint
- `npm run format` - форматирование кода с Prettier
- `npm run format:check` - проверка форматирования без изменений
- `npm run type-check` - проверка типов TypeScript

### Тестирование
- `npm run test` - запуск тестов
- `npm run test:watch` - запуск тестов в watch режиме
- `npm run test:coverage` - запуск тестов с отчетом о покрытии

### База данных
- `npm run db:generate` - генерация миграций Drizzle
- `npm run db:migrate` - применение миграций

### Комплексная проверка
- `npm run qa` - полная проверка качества (типы, линтинг, форматирование, тесты)

## Конфигурации

### ESLint
Конфигурация находится в `eslint.config.js`. Используются:
- Next.js recommended rules
- TypeScript правила
- Правила импортов
- React Hooks правила

### Prettier
Конфигурация в `.prettierrc.json`. Основные настройки:
- 2 пробела для отступов
- 100 символов на строку
- Точки с запятой в конце выражений
- Двойные кавычки для строк

### EditorConfig
Конфигурация в `.editorconfig` для согласованности стиля между редакторами.

## Pre-commit хуки

При коммите автоматически запускается:
1. `lint-staged` - линтинг и форматирование измененных файлов
2. Проверка соответствия правилам ESLint и Prettier

## Рекомендации по разработке

### 1. Перед коммитом
```bash
npm run qa
```

### 2. При работе над новой функцией
1. Создайте ветку от `main`
2. Регулярно запускайте `npm run type-check`
3. Используйте `npm run test:watch` для TDD

### 3. Code Review
Проверяйте:
- Соответствие TypeScript типов
- Отсутствие `any` типов
- Качество тестового покрытия
- Соответствие правилам импортов

## Решение проблем

### ESLint ошибки
```bash
npm run lint:fix
```

### Prettier форматирование
```bash
npm run format
```

### TypeScript ошибки
```bash
npm run type-check
```

### Husky не работает
```bash
chmod +x .husky/*
npm run setup:husky
```

## Интеграция с IDE

### VS Code
Рекомендуемые расширения:
- ESLint
- Prettier - Code formatter
- Error Lens

Настройки для автоформатирования при сохранении:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}