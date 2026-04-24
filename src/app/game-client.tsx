"use client";

import {
  Bot,
  HelpCircle,
  History,
  LogIn,
  LogOut,
  Play,
  Plus,
  Radio,
  Send,
  Shield,
  ShieldQuestion,
  Timer,
  TrafficCone,
  Trophy,
  UserPlus,
  WholeWord,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { trpc } from "@/trpc/client";

const authClient = createAuthClient();

type AuthMode = "sign-in" | "sign-up";
type GameMode = "classic" | "recent-5" | "go-no-go" | "reaction-time" | "stroop";
type StroopColor = "red" | "blue" | "green" | "yellow";

type TournamentRound = {
  id: string;
  n: number;
  mode: GameMode;
  tournament?: boolean;
  rated?: boolean;
  length: number;
  baseIntervalMs: number;
  finishedAt: string | null;
  winnerUserId: string | null;
  participated?: boolean;
  players: Array<{
    place: number;
    userId: string;
    displayName: string;
    correct: number;
    errors: number;
    penalty: number;
  }>;
};

type PublicStimulus =
  | { kind: "grid"; position: number; visible: boolean }
  | { kind: "go-no-go"; type: "GO" | "NO_GO"; visible: boolean }
  | { kind: "reaction-time"; delayMs: number; visible: boolean }
  | { kind: "stroop"; word: StroopColor; color: StroopColor; congruent: boolean; visible: boolean }
  | null;

type FeedbackFlash = { position: number; kind: "correct" | "error"; nonce: number } | null;

const STROOP_BUTTONS: Array<{ value: StroopColor; label: string }> = [
  { value: "red", label: "Красный" },
  { value: "blue", label: "Синий" },
  { value: "green", label: "Зеленый" },
  { value: "yellow", label: "Желтый" }
];

export default function GameClient() {
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [feedbackFlash, setFeedbackFlash] = useState<FeedbackFlash>(null);
  const [lastSubmittedPosition, setLastSubmittedPosition] = useState<number | null>(null);

  const [n, setN] = useState<2 | 3 | 4>(2);
  const [mode, setMode] = useState<GameMode>("classic");
  const [baseIntervalMs, setBaseIntervalMs] = useState(1600);
  const [length, setLength] = useState(30);
  const [tournament, setTournament] = useState(false);
  const [rated, setRated] = useState(false);
  const [useBot, setUseBot] = useState(true);
  const [botAccuracy, setBotAccuracy] = useState(75);
  const [goRatio, setGoRatio] = useState(70);

  const utils = trpc.useUtils();
  const rounds = trpc.game.list.useQuery(undefined, {
    enabled: Boolean(session),
    refetchInterval: 500
  });
  const myTournaments = trpc.game.myTournaments.useQuery(undefined, {
    enabled: Boolean(session),
    refetchInterval: 2500
  });
  const resolveLoginIdentifier = trpc.auth.resolveLoginIdentifier.useMutation();

  const createRound = trpc.game.create.useMutation({
    onSuccess: (round) => {
      setActiveRoundId(round.id);
      setMessage("");
      void utils.game.list.invalidate();
      void utils.game.myTournaments.invalidate();
    },
    onError: (error) => setMessage(error.message)
  });
  const joinRound = trpc.game.join.useMutation({
    onSuccess: (round) => {
      setActiveRoundId(round.id);
      void utils.game.list.invalidate();
      void utils.game.myTournaments.invalidate();
    },
    onError: (error) => setMessage(error.message)
  });
  const startRound = trpc.game.start.useMutation({
    onSuccess: () => {
      void utils.game.list.invalidate();
      void utils.game.myTournaments.invalidate();
    },
    onError: (error) => setMessage(error.message)
  });
  const submit = trpc.game.submit.useMutation({
    onSuccess: ({ result }) => {
      if (result.ignored) {
        setMessage(
          result.reason === "duplicate"
            ? "Ответ уже был отправлен."
            : result.reason === "waiting"
              ? "Стимул еще не появился."
              : "Ответ слишком поздний и был проигнорирован."
        );
      } else if (result.falseStart) {
        setMessage("Фальстарт: штраф и ускорение для всех.");
      } else {
        setMessage(result.isCorrect ? "Верно." : "Ошибка: начислен штраф.");
      }

      if (lastSubmittedPosition !== null) {
        setFeedbackFlash({ position: lastSubmittedPosition, kind: result.isCorrect ? "correct" : "error", nonce: Date.now() });
      }
      void utils.game.list.invalidate();
      void utils.game.myTournaments.invalidate();
    },
    onError: (error) => setMessage(error.message)
  });
  const finish = trpc.game.finish.useMutation({
    onSuccess: () => {
      void utils.game.list.invalidate();
      void utils.game.myTournaments.invalidate();
    },
    onError: (error) => setMessage(error.message)
  });
  const nextRound = trpc.game.next.useMutation({
    onSuccess: (round) => {
      setActiveRoundId(round.id);
      setMessage("Создан следующий раунд с теми же участниками.");
      void utils.game.list.invalidate();
      void utils.game.myTournaments.invalidate();
    },
    onError: (error) => setMessage(error.message)
  });
  const closeLobby = trpc.game.close.useMutation({
    onSuccess: () => {
      setActiveRoundId(null);
      setMessage("Лобби закрыто.");
      void utils.game.list.invalidate();
      void utils.game.myTournaments.invalidate();
    },
    onError: (error) => setMessage(error.message)
  });

  const activeRound = useMemo(
    () => rounds.data?.find((round) => round.id === activeRoundId) ?? rounds.data?.[0] ?? null,
    [activeRoundId, rounds.data]
  );
  const currentPlayer = activeRound?.players.find((player) => player.userId === session?.user.id) ?? null;
  const canAnswer = activeRound?.status === "running" && Boolean(currentPlayer);
  const isOwner = activeRound?.ownerId === session?.user.id;
  const currentStimulus = (activeRound?.currentStimulus ?? null) as PublicStimulus;
  const lastResult = activeRound?.lastResult ?? null;
  const showNSelector = mode === "classic" || mode === "recent-5";
  const isGridMode = activeRound?.mode === "classic" || activeRound?.mode === "recent-5";
  const authValidationError = getAuthValidationError({ authMode, email, password, confirmPassword, name });

  useEffect(() => {
    if (activeRound && activeRound.id !== activeRoundId) {
      setActiveRoundId(activeRound.id);
    }
  }, [activeRound, activeRoundId]);

  useEffect(() => {
    if (!feedbackFlash) {
      return;
    }

    const timeout = window.setTimeout(() => setFeedbackFlash(null), 650);
    return () => window.clearTimeout(timeout);
  }, [feedbackFlash]);

  useEffect(() => {
    if (rated && useBot) {
      setUseBot(false);
    }
  }, [rated, useBot]);

  async function handleAuth() {
    setMessage("");
    if (authValidationError) {
      setMessage(authValidationError);
      return;
    }
    const identifier = email.trim();
    const loginEmail =
      authMode === "sign-in" ? (await resolveLoginIdentifier.mutateAsync({ identifier })).email : identifier;
    const result =
      authMode === "sign-in"
        ? await authClient.signIn.email({ email: loginEmail, password })
        : await authClient.signUp.email({ email: loginEmail, password, name });

    if (result.error) {
      setMessage(result.error.message ?? "Ошибка аутентификации");
      return;
    }

    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    await refetchSession();
  }

  async function handleSignOut() {
    await authClient.signOut();
    setActiveRoundId(null);
    setMessage("");
    await refetchSession();
  }

  function handleCreateRound() {
    createRound.mutate({
      n,
      mode,
      tournament,
      rated,
      length: tournament ? Math.max(length, 45) : length,
      baseIntervalMs,
      goRatio: goRatio / 100,
      botAccuracy: rated ? null : useBot ? botAccuracy / 100 : null
    });
  }

  function handleSubmit(answer?: string) {
    if (!activeRound) {
      return;
    }
    if (currentStimulus?.kind === "grid") {
      setLastSubmittedPosition(currentStimulus.position);
    } else {
      setLastSubmittedPosition(null);
    }
    submit.mutate({ roundId: activeRound.id, answer });
  }

  if (!session) {
    return (
      <section className="auth-panel">
        <div className="auth-copy">
          <h2>Вход в матч</h2>
          <p>Войти можно по почте или по никнейму в одном поле. Для проверки матча откройте второе окно инкогнито.</p>
        </div>
        <div className="form-grid">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete={authMode === "sign-in" ? "username" : "email"}
            placeholder={authMode === "sign-in" ? "email или никнейм" : "email"}
          />
          {authMode === "sign-up" && (
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" placeholder="никнейм игрока" />
          )}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
            placeholder="пароль"
            type="password"
          />
          {authMode === "sign-up" && (
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="повторите пароль"
              type="password"
            />
          )}
          {authMode === "sign-up" && <p className="field-hint">Пароль должен содержать не менее 8 символов, никнейм — от 3 символов.</p>}
          <div className="button-row">
            <button className="primary" disabled={Boolean(authValidationError)} onClick={handleAuth}>
              <LogIn size={18} /> {authMode === "sign-in" ? "Войти" : "Создать"}
            </button>
            <button className="secondary" onClick={() => setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in")}>
              {authMode === "sign-in" ? "Регистрация" : "Уже есть аккаунт"}
            </button>
          </div>
          {message && <p className="notice">{message}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="game-layout">
      <aside className="lobby">
        <div className="panel-title">
          <Radio size={18} />
          <h2>Лобби</h2>
        </div>
        <p className="side-note">Вы вошли как {session.user.name || session.user.email}</p>
        <div className="button-row account-actions">
          <Link className="secondary link-button" href="/guide">
            <HelpCircle size={18} /> Руководство
          </Link>
          <Link className="secondary link-button" href="/stats">
            <Shield size={18} /> Rating
          </Link>
          <Link className="secondary link-button" href="/history">
            <History size={18} /> История
          </Link>
          <button className="secondary" onClick={handleSignOut}>
            <LogOut size={18} /> Выйти
          </button>
        </div>

        <div className="settings-panel">
          <label>
            Тренажер
            <select value={mode} onChange={(event) => setMode(event.target.value as GameMode)}>
              <option value="classic">N-back</option>
              <option value="recent-5">Recent-5</option>
              <option value="go-no-go">Go / No-Go</option>
              <option value="reaction-time">Reaction Time</option>
              <option value="stroop">Stroop Test</option>
            </select>
          </label>

          {showNSelector && (
            <label>
              N ходов назад
              <select value={n} onChange={(event) => setN(Number(event.target.value) as 2 | 3 | 4)}>
                <option value={2}>2-back</option>
                <option value={3}>3-back</option>
                <option value={4}>4-back</option>
              </select>
            </label>
          )}

          {mode === "go-no-go" && (
            <label>
              Доля GO стимулов: {goRatio}%
              <input max={90} min={40} onChange={(event) => setGoRatio(Number(event.target.value))} step={5} type="range" value={goRatio} />
            </label>
          )}

          <label>
            Базовая скорость: {baseIntervalMs} мс
            <input
              max={3000}
              min={600}
              onChange={(event) => setBaseIntervalMs(Number(event.target.value))}
              step={100}
              type="range"
              value={baseIntervalMs}
            />
          </label>

          <label>
            Длина раунда
            <input max={90} min={12} onChange={(event) => setLength(Number(event.target.value))} type="number" value={length} />
          </label>

          <label className="check-row">
            <input checked={tournament} onChange={(event) => setTournament(event.target.checked)} type="checkbox" />
            Турнирный режим
          </label>

          <label className="check-row">
            <input checked={useBot} disabled={rated} onChange={(event) => setUseBot(event.target.checked)} type="checkbox" />
            Добавить бота
          </label>

          <label className="check-row">
            <input checked={rated} onChange={(event) => setRated(event.target.checked)} type="checkbox" />
            Rated lobby
          </label>

          {rated && <p className="field-hint">ELO changes after each finished game. Bots are disabled in rated matches.</p>}

          {useBot && (
            <label>
              Точность бота: {botAccuracy}%
              <input
                max={95}
                min={10}
                onChange={(event) => setBotAccuracy(Number(event.target.value))}
                step={5}
                type="range"
                value={botAccuracy}
              />
            </label>
          )}
        </div>

        <button className="primary wide" onClick={handleCreateRound}>
          <Plus size={18} /> Создать лобби
        </button>

        <div className="how-to">
          <div className="panel-title">
            <HelpCircle size={18} />
            <h2>Как играть</h2>
          </div>
          <p>N-back: нажимайте, если текущая клетка совпала с клеткой N ходов назад.</p>
          <p>Go / No-Go: нажимайте только на GO, NO_GO нужно пропускать.</p>
          <p>Reaction Time: ждите сигнала и кликайте как можно быстрее, фальстарт штрафуется.</p>
          <p>Stroop: отвечайте по цвету слова, а не по его тексту.</p>
          <p>Подробное руководство доступно на отдельной странице.</p>
        </div>

        <div className="round-list">
          {rounds.data?.map((round) => (
            <button className={round.id === activeRound?.id ? "round active" : "round"} key={round.id} onClick={() => setActiveRoundId(round.id)}>
              <span>
                {modeLabel(round.mode, round.n)}, {round.players.length}/4
              </span>
              <strong>{round.status}</strong>
            </button>
          ))}
        </div>

        <section className="tournament-panel">
          <div className="panel-title">
            <Trophy size={18} />
            <h2>Мои турниры</h2>
          </div>
          <div className="mini-history">
            {myTournaments.data?.length ? (
              myTournaments.data.slice(0, 3).map((round) => <TournamentMiniCard key={round.id} round={round} currentUserId={session.user.id} />)
            ) : (
              <p>Вы еще не участвовали в завершенных турнирах.</p>
            )}
            <Link className="secondary link-button wide" href="/history">
              <History size={18} /> Открыть историю
            </Link>
            <Link className="secondary link-button wide" href="/stats">
              <Shield size={18} /> Rating
            </Link>
          </div>
        </section>
      </aside>

      <div className="arena">
        {activeRound ? (
          <>
            <div className="arena-head">
              <div>
                <h2>Раунд {activeRound.id.slice(0, 8)}</h2>
                <p>
                  {modeLabel(activeRound.mode, activeRound.n)} · стимул {activeRound.stimulusIndex + 1}/{activeRound.length} · интервал{" "}
                  {activeRound.currentIntervalMs} мс
                </p>
                <p>{activeRound.tournament ? "Турнирный формат." : "Обычный матч."}</p>
                <p>{currentPlayer ? `Вы участвуете как ${currentPlayer.displayName}` : "Вы смотрите раунд, но еще не участвуете"}</p>
              </div>
              <p>{activeRound.rated ? "Rated match: ELO will change after the game." : "Casual match: ELO does not change."}</p>
              <div className="button-row">
                {activeRound.status === "lobby" && !currentPlayer && (
                  <button className="secondary" onClick={() => joinRound.mutate({ roundId: activeRound.id })}>
                    <UserPlus size={18} /> Войти в раунд
                  </button>
                )}
                {activeRound.status === "lobby" && isOwner && (
                  <button className="primary" onClick={() => startRound.mutate({ roundId: activeRound.id })}>
                    <Play size={18} /> Старт
                  </button>
                )}
                {activeRound.status === "running" && isOwner && (
                  <button className="secondary" onClick={() => finish.mutate({ roundId: activeRound.id })}>
                    <Trophy size={18} /> Завершить
                  </button>
                )}
                {activeRound.status === "finished" && isOwner && (
                  <button className="primary" onClick={() => nextRound.mutate({ roundId: activeRound.id })}>
                    <Play size={18} /> Следующий раунд
                  </button>
                )}
                {isOwner && (
                  <button className="secondary" onClick={() => closeLobby.mutate({ roundId: activeRound.id })}>
                    <X size={18} /> Закрыть лобби
                  </button>
                )}
              </div>
            </div>

            {activeRound.status === "lobby" && (
              <div className="status-strip">
                Нужно минимум 2 участника. Сейчас: {activeRound.players.length}/4. Бот считается участником.
              </div>
            )}
            {activeRound.status === "finished" && activeRound.winner && (
              <div className="status-strip">
                Раунд завершен. Победитель:{" "}
                {activeRound.players.find((player) => player.userId === activeRound.winner)?.displayName ?? activeRound.winner}
              </div>
            )}

            <GameArena stimulus={currentStimulus} feedbackFlash={feedbackFlash} currentPosition={activeRound.currentPosition} />

            {activeRound.status === "running" && renderControls(activeRound.mode, currentStimulus, canAnswer, submit.isPending, handleSubmit)}

            {!canAnswer && (
              <p className="notice">
                {activeRound.status === "running" ? "Сначала войдите в раунд." : "Кнопки станут активны после старта раунда."}
              </p>
            )}
            {message && <p className="notice">{message}</p>}

            {lastResult && (
              <div className="status-strip">
                Итог последнего стимула:{" "}
                {lastResult.winners.length
                  ? `лидер ${lastResult.players
                      .filter((player: { userId: string }) => lastResult.winners.includes(player.userId))
                      .map((player: { displayName: string }) => player.displayName)
                      .join(", ")}`
                  : "без победителя"}
              </div>
            )}

            <div className="scoreboard">
              {activeRound.players.map((player) => (
                <div className={player.userId === session.user.id ? "score me" : "score"} key={player.userId}>
                  <strong>
                    {player.isBot && <Bot size={16} />}
                    {player.displayName}
                    {player.userId === session.user.id ? " · вы" : ""}
                    {player.userId === activeRound.ownerId ? " · владелец" : ""}
                  </strong>
                  <span>Очки: {player.correct}</span>
                  <span>Ошибки: {player.errors}</span>
                  <span>Штраф: {player.penalty}</span>
                  <span>Accuracy: {player.metrics.accuracy}%</span>
                  {player.metrics.averageReactionTime !== null && <span>Avg RT: {player.metrics.averageReactionTime} мс</span>}
                  {player.metrics.bestReactionTime !== null && <span>Best RT: {player.metrics.bestReactionTime} мс</span>}
                  {player.metrics.falseStarts > 0 && <span>Фальстарты: {player.metrics.falseStarts}</span>}
                  {player.metrics.falsePositives > 0 && <span>False positives: {player.metrics.falsePositives}</span>}
                  {player.metrics.misses > 0 && <span>Misses: {player.metrics.misses}</span>}
                  {player.metrics.conflictErrors > 0 && <span>Conflict errors: {player.metrics.conflictErrors}</span>}
                </div>
              ))}
            </div>

            <section className="history-panel">
              <h2>История лобби</h2>
              {activeRound.history.length === 0 ? (
                <p className="notice">Завершенных раундов в этом лобби пока нет.</p>
              ) : (
                activeRound.history.map((entry, index) => {
                  const winner = entry.players.find((player: { userId: string }) => player.userId === entry.winnerUserId);
                  return (
                    <div className="history-block" key={entry.roundId}>
                      <div className="history-head">
                        <strong>Раунд {index + 1}</strong>
                        <span>Победитель: {winner?.displayName ?? "нет"}</span>
                      </div>
                      <div className="history-table">
                        <span>Игрок</span>
                        <span>Очки</span>
                        <span>Ошибки</span>
                        <span>Штраф</span>
                        {entry.players.map((player: { userId: string; displayName: string; isBot: boolean; correct: number; errors: number; penalty: number }) => (
                          <FragmentRow key={player.userId} player={player} />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        ) : (
          <div className="empty">Создайте лобби с нужными настройками.</div>
        )}
      </div>
    </section>
  );
}

function GameArena({
  stimulus,
  feedbackFlash,
  currentPosition
}: {
  stimulus: PublicStimulus;
  feedbackFlash: FeedbackFlash;
  currentPosition: number | null;
}) {
  if (!stimulus) {
    return <div className="empty">Ожидание стимула.</div>;
  }

  if (stimulus.kind === "grid") {
    return (
      <div className="grid" aria-label="Сетка стимулов 3 на 3">
        {Array.from({ length: 9 }, (_, index) => (
          <div
            className={[
              "cell",
              index === currentPosition ? "lit" : "",
              feedbackFlash?.position === index ? `flash-${feedbackFlash.kind}` : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={index}
          />
        ))}
      </div>
    );
  }

  if (stimulus.kind === "go-no-go") {
    return (
      <div className={`stimulus-card ${stimulus.type === "GO" ? "go-card" : "nogo-card"}`}>
        <TrafficCone size={28} />
        <strong>{stimulus.type}</strong>
        <span>{stimulus.type === "GO" ? "Нужно нажать" : "Нужно пропустить"}</span>
      </div>
    );
  }

  if (stimulus.kind === "reaction-time") {
    return (
      <div className={`stimulus-card ${stimulus.visible ? "react-card live" : "react-card"}`}>
        <Timer size={28} />
        <strong>{stimulus.visible ? "КЛИКАЙ" : "ЖДИТЕ СИГНАЛА"}</strong>
        <span>{stimulus.visible ? "Сейчас идет окно реакции" : `Случайная задержка до ${stimulus.delayMs} мс`}</span>
      </div>
    );
  }

  return (
    <div className="stimulus-card stroop-card">
      <WholeWord size={28} />
      <strong className={`stroop-word stroop-${stimulus.color}`}>{stimulus.word.toUpperCase()}</strong>
      <span>{stimulus.congruent ? "Конгруэнтный стимул" : "Конфликтный стимул"}</span>
    </div>
  );
}

function renderControls(
  mode: GameMode,
  stimulus: PublicStimulus,
  canAnswer: boolean,
  isPending: boolean,
  onSubmit: (answer?: string) => void
) {
  if (mode === "stroop") {
    return (
      <div className="stroop-buttons">
        {STROOP_BUTTONS.map((button) => (
          <button className="secondary color-button" disabled={!canAnswer || isPending || !stimulus?.visible} key={button.value} onClick={() => onSubmit(button.value)}>
            {button.label}
          </button>
        ))}
      </div>
    );
  }

  const label =
    mode === "reaction-time" ? "Нажать как можно быстрее" : mode === "go-no-go" ? "Нажать" : "Есть совпадение";

  return (
    <button className="match-button" disabled={!canAnswer || isPending || !stimulus?.visible} onClick={() => onSubmit()}>
      <Send size={20} /> {label}
    </button>
  );
}

function modeLabel(mode: GameMode, n: number) {
  switch (mode) {
    case "classic":
      return `${n}-back`;
    case "recent-5":
      return "Recent-5";
    case "go-no-go":
      return "Go / No-Go";
    case "reaction-time":
      return "Reaction Time";
    case "stroop":
      return "Stroop Test";
  }
}

function getAuthValidationError({
  authMode,
  email,
  password,
  confirmPassword,
  name
}: {
  authMode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}) {
  if (!email.trim()) {
    return "Введите email или никнейм.";
  }
  if (!password.trim()) {
    return "Введите пароль.";
  }
  if (authMode === "sign-up") {
    if (name.trim().length < 3) {
      return "Никнейм должен содержать не менее 3 символов.";
    }
    if (password.length < 8) {
      return "Пароль должен содержать не менее 8 символов.";
    }
    if (password !== confirmPassword) {
      return "Пароли не совпадают.";
    }
  }

  return null;
}

export function TournamentMiniCard({ round, currentUserId }: { round: TournamentRound; currentUserId: string }) {
  const me = round.players.find((player) => player.userId === currentUserId);
  const winner = round.players.find((player) => player.userId === round.winnerUserId);

  return (
    <div className="tournament-mini">
      <span>
        {modeLabel(round.mode, round.n)} · {round.finishedAt ? new Date(round.finishedAt).toLocaleDateString("ru-RU") : "завершен"}
      </span>
      <span>Победитель: {winner?.displayName ?? "нет"}</span>
      {me && <span>Ваше место: {me.place}, очки: {me.correct}</span>}
    </div>
  );
}

export function TournamentTable({ round, currentUserId }: { round: TournamentRound; currentUserId: string }) {
  const winner = round.players.find((player) => player.userId === round.winnerUserId);

  return (
    <div className="history-block">
      <div className="history-head">
        <strong>
          {modeLabel(round.mode, round.n)}
          {round.tournament ? " · турнир" : ""}
        </strong>
        <span>Победитель: {winner?.displayName ?? "нет"}</span>
      </div>
      <div className="history-table tournament-table">
        <span>Место</span>
        <span>Игрок</span>
        <span>Очки</span>
        <span>Ошибки</span>
        <span>Штраф</span>
        {round.players.map((player) => (
          <FragmentTournamentRow currentUserId={currentUserId} key={player.userId} player={player} />
        ))}
      </div>
    </div>
  );
}

function FragmentTournamentRow({
  currentUserId,
  player
}: {
  currentUserId: string;
  player: { place: number; userId: string; displayName: string; correct: number; errors: number; penalty: number };
}) {
  return (
    <>
      <span>{player.place}</span>
      <span>
        {player.displayName}
        {player.userId === currentUserId ? " · вы" : ""}
      </span>
      <span>{player.correct}</span>
      <span>{player.errors}</span>
      <span>{player.penalty}</span>
    </>
  );
}

function FragmentRow({
  player
}: {
  player: { userId: string; displayName: string; isBot: boolean; correct: number; errors: number; penalty: number };
}) {
  return (
    <>
      <span>{player.isBot ? `Bot · ${player.displayName}` : player.displayName}</span>
      <span>{player.correct}</span>
      <span>{player.errors}</span>
      <span>{player.penalty}</span>
    </>
  );
}
