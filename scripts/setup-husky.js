import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// eslint-disable-next-line no-console
console.log('Setting up Husky git hooks...');

// Создаем директорию .husky если её нет
const huskyDir = join(process.cwd(), '.husky');
if (!existsSync(huskyDir)) {
  mkdirSync(huskyDir, { recursive: true });
  // eslint-disable-next-line no-console
  console.log('Created .husky directory');
}

// Создаем pre-commit hook
const preCommitHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
`;

writeFileSync(join(huskyDir, 'pre-commit'), preCommitHook, { mode: 0o755 });

// Создаем commit-msg hook (опционально, для проверки сообщений коммитов)
const commitMsgHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Пример проверки сообщения коммита
# npx commitlint --edit "$1"
`;

writeFileSync(join(huskyDir, 'commit-msg'), commitMsgHook, { mode: 0o755 });

// Создаем файл _/husky.sh если его нет
const huskyShDir = join(huskyDir, '_');
if (!existsSync(huskyShDir)) {
  mkdirSync(huskyShDir, { recursive: true });
}

const huskyShContent = `#!/usr/bin/env sh
if [ -z "$husky_skip_init" ]; then
  debug () {
    if [ "$HUSKY_DEBUG" = "1" ]; then
      echo "husky (debug) - $1"
    fi
  }

  readonly hook_name="\$(basename -- "\$0")"
  debug "starting \$hook_name..."

  if [ "\$HUSKY" = "0" ]; then
    debug "HUSKY env variable is set to 0, skipping hook"
    exit 0
  fi

  if [ -f ~/.huskyrc ]; then
    debug "sourcing ~/.huskyrc"
    . ~/.huskyrc
  fi

  readonly husky_skip_init=1
  export husky_skip_init
  exec "\$0" "\$@"
fi
`;

writeFileSync(join(huskyShDir, 'husky.sh'), huskyShContent, { mode: 0o755 });

// Устанавливаем Husky
try {
  execSync('npx husky init', { stdio: 'inherit' });
  // eslint-disable-next-line no-console
  console.log('Husky initialized successfully');
} catch {
  // eslint-disable-next-line no-console
  console.log('Husky already initialized or error occurred');
}

// eslint-disable-next-line no-console
console.log('Husky setup complete!');
// eslint-disable-next-line no-console
console.log('Run: chmod +x .husky/* to make hooks executable if needed');
