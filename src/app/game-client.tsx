"use client";

import { Bot, HelpCircle, History, LogIn, LogOut, Play, Plus, Radio, Send, Trophy, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { trpc } from "@/trpc/client";

const authClient = createAuthClient();

type AuthMode = "sign-in" | "sign-up";
type GameMode = "classic" | "recent-5";
type TournamentRound = {
  id: string;
  n: number;
  mode: GameMode;
  tournament?: boolean;
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
type FeedbackFlash = { position: number; kind: "correct" | "error"; nonce: number } | null;

export default function GameClient() {
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("player@example.com");
  const [password, setPassword] = useState("password1234");
  const [name, setName] = useState("Player");
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [feedbackFlash, setFeedbackFlash] = useState<FeedbackFlash>(null);
  const [lastSubmittedPosition, setLastSubmittedPosition] = useState<number | null>(null);

  const [n, setN] = useState<2 | 3 | 4>(2);
  const [mode, setMode] = useState<GameMode>("classic");
  const [baseIntervalMs, setBaseIntervalMs] = useState(1600);
  const [length, setLength] = useState(30);
  const [tournament, setTournament] = useState(false);
  const [useBot, setUseBot] = useState(true);
  const [botAccuracy, setBotAccuracy] = useState(75);

  const utils = trpc.useUtils();
  const rounds = trpc.game.list.useQuery(undefined, {
    enabled: Boolean(session),
    refetchInterval: 800
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
      setMessage(result.isCorrect ? "Верно: совпадение найдено" : "Ошибка: штраф и риск ускорения");
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

  async function handleAuth() {
    setMessage("");
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
      length: tournament ? Math.max(length, 45) : length,
      baseIntervalMs,
      botAccuracy: useBot ? botAccuracy / 100 : null
    });
  }

  function handleSubmit() {
    if (!activeRound) {
      return;
    }
    setLastSubmittedPosition(activeRound.currentPosition ?? null);
    submit.mutate({ roundId: activeRound.id });
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
            placeholder={authMode === "sign-in" ? "email или никнейм" : "email"}
          />
          {authMode === "sign-up" && (
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="никнейм игрока" />
          )}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="пароль"
            type="password"
          />
          <div className="button-row">
            <button className="primary" onClick={handleAuth}>
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
          <Link className="secondary link-button" href="/history">
            <History size={18} /> История
          </Link>
          <button className="secondary" onClick={handleSignOut}>
            <LogOut size={18} /> Выйти
          </button>
        </div>

        <div className="settings-panel">
          <label>
            Режим
            <select value={mode} onChange={(event) => setMode(event.target.value as GameMode)}>
              <option value="classic">N-back</option>
              <option value="recent-5">Упрощенный: среди 5 последних</option>
            </select>
          </label>
          <label>
            N ходов назад
            <select value={n} onChange={(event) => setN(Number(event.target.value) as 2 | 3 | 4)}>
              <option value={2}>2-back</option>
              <option value={3}>3-back</option>
              <option value={4}>4-back</option>
            </select>
          </label>
          <label>
            Начальная скорость: {baseIntervalMs} мс
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
            <input checked={useBot} onChange={(event) => setUseBot(event.target.checked)} type="checkbox" />
            Добавить бота
          </label>
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
          <p>N-back: нажимайте, если клетка совпала с клеткой N ходов назад.</p>
          <p>Упрощенный режим: нажимайте, если клетка встречалась среди последних 5 ходов.</p>
          <p>Верный ход подсвечивает клетку зеленым, ошибка со штрафом - красным, обычный стимул остается желтым.</p>
          <p>После завершения хост может запустить следующий раунд или закрыть лобби.</p>
        </div>

        <div className="round-list">
          {rounds.data?.map((round) => (
            <button
              className={round.id === activeRound?.id ? "round active" : "round"}
              key={round.id}
              onClick={() => setActiveRoundId(round.id)}
            >
              <span>
                {round.mode === "classic" ? `${round.n}-back` : "recent-5"}, {round.players.length}/4
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
                  {activeRound.mode === "classic" ? `${activeRound.n}-back` : "совпадение среди 5 последних"} · стимул{" "}
                  {activeRound.stimulusIndex + 1}/{activeRound.length} · интервал {activeRound.currentIntervalMs} мс
                </p>
                <p>{activeRound.tournament ? "Турнирный формат." : "Обычный матч."}</p>
                <p>{currentPlayer ? `Вы участвуете как ${currentPlayer.displayName}` : "Вы смотрите раунд, но еще не участвуете"}</p>
              </div>
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

            <div className="grid" aria-label="Сетка стимулов 3 на 3">
              {Array.from({ length: 9 }, (_, index) => (
                <div
                  className={[
                    "cell",
                    index === activeRound.currentPosition ? "lit" : "",
                    feedbackFlash?.position === index ? `flash-${feedbackFlash.kind}` : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={index}
                />
              ))}
            </div>

            <button className="match-button" disabled={!canAnswer || submit.isPending} onClick={handleSubmit}>
              <Send size={20} /> Есть совпадение
            </button>

            {!canAnswer && (
              <p className="notice">
                {activeRound.status === "running" ? "Сначала войдите в раунд." : "Кнопка станет активной после старта раунда."}
              </p>
            )}
            {message && <p className="notice">{message}</p>}

            <div className="scoreboard">
              {activeRound.players.map((player) => (
                <div className={player.userId === session.user.id ? "score me" : "score"} key={player.userId}>
                  <strong>
                    {player.isBot && <Bot size={16} />}
                    {player.displayName}
                    {player.userId === session.user.id ? " · вы" : ""}
                    {player.userId === activeRound.ownerId ? " · владелец" : ""}
                  </strong>
                  <span>Верно: {player.correct}</span>
                  <span>Ошибки: {player.errors}</span>
                  <span>Штраф: {player.penalty}</span>
                </div>
              ))}
            </div>

            <section className="history-panel">
              <h2>История лобби</h2>
              {activeRound.history.length === 0 ? (
                <p className="notice">Завершенных раундов в этом лобби пока нет.</p>
              ) : (
                activeRound.history.map((entry, index) => {
                  const winner = entry.players.find((player) => player.userId === entry.winnerUserId);
                  return (
                    <div className="history-block" key={entry.roundId}>
                      <div className="history-head">
                        <strong>Раунд {index + 1}</strong>
                        <span>Победитель: {winner?.displayName ?? "нет"}</span>
                      </div>
                      <div className="history-table">
                        <span>Игрок</span>
                        <span>Верно</span>
                        <span>Ошибки</span>
                        <span>Штраф</span>
                        {entry.players.map((player) => (
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

export function TournamentMiniCard({ round, currentUserId }: { round: TournamentRound; currentUserId: string }) {
  const me = round.players.find((player) => player.userId === currentUserId);
  const winner = round.players.find((player) => player.userId === round.winnerUserId);

  return (
    <div className="tournament-mini">
      <span>{round.mode === "classic" ? `${round.n}-back` : "recent-5"} · {round.finishedAt ? new Date(round.finishedAt).toLocaleDateString("ru-RU") : "завершен"}</span>
      <span>Победитель: {winner?.displayName ?? "нет"}</span>
      {me && <span>Ваше место: {me.place}, верно: {me.correct}</span>}
    </div>
  );
}

export function TournamentTable({ round, currentUserId }: { round: TournamentRound; currentUserId: string }) {
  const winner = round.players.find((player) => player.userId === round.winnerUserId);

  return (
    <div className="history-block">
      <div className="history-head">
        <strong>{round.mode === "classic" ? `${round.n}-back` : "recent-5"}{round.tournament ? " · турнир" : ""}</strong>
        <span>Победитель: {winner?.displayName ?? "нет"}</span>
      </div>
      <div className="history-table tournament-table">
        <span>Место</span>
        <span>Игрок</span>
        <span>Верно</span>
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
      <span>{player.displayName}{player.userId === currentUserId ? " · вы" : ""}</span>
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
