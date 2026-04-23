export type GameMode = "classic" | "recent-5";

export type RoundHistoryEntry = {
  roundId: string;
  finishedAt: number;
  winnerUserId: string | null;
  players: Array<{
    userId: string;
    displayName: string;
    isBot: boolean;
    correct: number;
    errors: number;
    penalty: number;
  }>;
};

export type PlayerState = {
  userId: string;
  displayName: string;
  isBot: boolean;
  botAccuracy?: number;
  correct: number;
  errors: number;
  penalty: number;
  answeredStimuli: Set<number>;
};

export type GameRound = {
  id: string;
  ownerId: string;
  n: number;
  mode: GameMode;
  tournament: boolean;
  length: number;
  baseIntervalMs: number;
  currentIntervalMs: number;
  sequence: number[];
  status: "lobby" | "running" | "finished";
  startedAt?: number;
  finishedAt?: number;
  players: Map<string, PlayerState>;
  history: RoundHistoryEntry[];
};

export type SubmitResult = {
  stimulusIndex: number;
  expectedMatch: boolean;
  isCorrect: boolean;
  speedChanged: boolean;
  currentIntervalMs: number;
  finished: boolean;
};

const GRID_CELLS = 9;
const RECENT_WINDOW = 5;
const SPEED_UP_FACTOR = 0.9;
const MIN_INTERVAL_MS = 450;

export function generateSequence(length: number, randomInt = (max: number) => Math.floor(Math.random() * max)) {
  if (length < 1) {
    throw new Error("Sequence length must be positive.");
  }

  return Array.from({ length }, () => randomInt(GRID_CELLS));
}

export function createRound(params: {
  id: string;
  ownerId: string;
  ownerName: string;
  n: number;
  mode: GameMode;
  tournament: boolean;
  length: number;
  baseIntervalMs: number;
  botAccuracy?: number | null;
  sequence?: number[];
}): GameRound {
  if (![2, 3, 4].includes(params.n)) {
    throw new Error("N must be 2, 3, or 4.");
  }
  if (params.length <= params.n) {
    throw new Error("Round length must be greater than N.");
  }
  if (params.baseIntervalMs < MIN_INTERVAL_MS) {
    throw new Error(`Base interval must be at least ${MIN_INTERVAL_MS} ms.`);
  }

  const sequence = params.sequence ?? generateSequence(params.length);
  const players = new Map<string, PlayerState>();
  players.set(params.ownerId, createPlayer(params.ownerId, params.ownerName));
  if (params.botAccuracy !== undefined && params.botAccuracy !== null) {
    players.set(
      `bot:${params.id}`,
      createPlayer(`bot:${params.id}`, `Bot ${Math.round(params.botAccuracy * 100)}%`, true, params.botAccuracy)
    );
  }

  return {
    id: params.id,
    ownerId: params.ownerId,
    n: params.n,
    mode: params.mode,
    tournament: params.tournament,
    length: params.length,
    baseIntervalMs: params.baseIntervalMs,
    currentIntervalMs: params.baseIntervalMs,
    sequence,
    status: "lobby",
    players,
    history: []
  };
}

export function joinRound(round: GameRound, userId: string, displayName: string, isBot = false, botAccuracy?: number) {
  if (round.status !== "lobby") {
    throw new Error("You can only join a round in lobby.");
  }
  if (round.players.has(userId)) {
    return;
  }
  if (round.players.size >= 4) {
    throw new Error("A round supports up to 4 players.");
  }

  round.players.set(userId, createPlayer(userId, displayName, isBot, botAccuracy));
}

function createPlayer(userId: string, displayName: string, isBot = false, botAccuracy?: number): PlayerState {
  return {
    userId,
    displayName,
    isBot,
    botAccuracy,
    correct: 0,
    errors: 0,
    penalty: 0,
    answeredStimuli: new Set()
  };
}

export function startRound(round: GameRound, now = Date.now()) {
  if (round.status !== "lobby") {
    throw new Error("Round is not in lobby.");
  }
  if (round.players.size < 2) {
    throw new Error("At least 2 players are required.");
  }

  round.status = "running";
  round.startedAt = now;
}

export function getCurrentStimulusIndex(round: GameRound, now = Date.now()) {
  if (round.status !== "running" || round.startedAt === undefined) {
    return 0;
  }

  return Math.min(Math.floor((now - round.startedAt) / round.currentIntervalMs), round.length - 1);
}

export function isMatchAt(round: Pick<GameRound, "n" | "mode" | "sequence">, stimulusIndex: number) {
  if (round.mode === "recent-5") {
    const start = Math.max(0, stimulusIndex - RECENT_WINDOW);
    return round.sequence.slice(start, stimulusIndex).includes(round.sequence[stimulusIndex]);
  }

  if (stimulusIndex < round.n) {
    return false;
  }

  return round.sequence[stimulusIndex] === round.sequence[stimulusIndex - round.n];
}

export function submitMatch(round: GameRound, userId: string, now = Date.now()): SubmitResult {
  if (round.status !== "running") {
    throw new Error("Round is not running.");
  }

  const player = round.players.get(userId);
  if (!player) {
    throw new Error("Player is not in round.");
  }

  const stimulusIndex = getCurrentStimulusIndex(round, now);
  if (player.answeredStimuli.has(stimulusIndex)) {
    throw new Error("Player already answered this stimulus.");
  }

  const expectedMatch = isMatchAt(round, stimulusIndex);
  const isCorrect = expectedMatch;
  let speedChanged = false;

  player.answeredStimuli.add(stimulusIndex);
  if (isCorrect) {
    player.correct += 1;
  } else {
    speedChanged = registerError(round, player);
  }

  const finished = stimulusIndex >= round.length - 1;
  if (finished) {
    finishRound(round, now);
  }

  return {
    stimulusIndex,
    expectedMatch,
    isCorrect,
    speedChanged,
    currentIntervalMs: round.currentIntervalMs,
    finished
  };
}

export function finishRound(round: GameRound, now = Date.now()) {
  if (round.status === "finished") {
    return;
  }

  round.status = "finished";
  round.finishedAt = now;
  round.history.push(createHistoryEntry(round, now));
}

export function getWinner(round: GameRound) {
  return [...round.players.values()].sort((a, b) => b.correct - a.correct || a.errors - b.errors)[0] ?? null;
}

export function createHistoryEntry(round: GameRound, finishedAt = Date.now()): RoundHistoryEntry {
  const winner = getWinner(round);
  return {
    roundId: round.id,
    finishedAt,
    winnerUserId: winner?.userId ?? null,
    players: [...round.players.values()].map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      isBot: player.isBot,
      correct: player.correct,
      errors: player.errors,
      penalty: player.penalty
    }))
  };
}

export function registerMiss(round: GameRound, userId: string, stimulusIndex: number) {
  const player = round.players.get(userId);
  if (!player) {
    throw new Error("Player is not in round.");
  }
  if (player.answeredStimuli.has(stimulusIndex)) {
    return false;
  }

  player.answeredStimuli.add(stimulusIndex);
  return registerError(round, player);
}

export function shouldBotPress(round: GameRound, stimulusIndex: number, accuracy: number, random = Math.random) {
  const expectedMatch = isMatchAt(round, stimulusIndex);
  return expectedMatch ? random() < accuracy : random() >= accuracy;
}

function registerError(round: GameRound, player: PlayerState) {
  player.errors += 1;
  player.penalty += 1;
  if (player.errors % 3 === 0) {
    round.currentIntervalMs = Math.max(MIN_INTERVAL_MS, Math.round(round.currentIntervalMs * SPEED_UP_FACTOR));
    return true;
  }

  return false;
}
