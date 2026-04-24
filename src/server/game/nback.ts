export type GameMode = "classic" | "recent-5" | "go-no-go" | "reaction-time" | "stroop";
export type GoNoGoType = "GO" | "NO_GO";
export type StroopColor = "red" | "blue" | "green" | "yellow";

export type GridStimulus = {
  kind: "grid";
  position: number;
};

export type GoNoGoStimulus = {
  kind: "go-no-go";
  type: GoNoGoType;
};

export type ReactionStimulus = {
  kind: "reaction-time";
  delayMs: number;
};

export type StroopStimulus = {
  kind: "stroop";
  word: StroopColor;
  color: StroopColor;
  congruent: boolean;
};

export type Stimulus = GridStimulus | GoNoGoStimulus | ReactionStimulus | StroopStimulus;

export type PlayerMetrics = {
  averageReactionTime: number | null;
  bestReactionTime: number | null;
  consistency: number | null;
  falsePositives: number;
  misses: number;
  falseStarts: number;
  conflictErrors: number;
  accuracy: number;
  correctTrials: number;
  totalTrials: number;
  reactionTimes: number[];
};

export type PlayerSubmission = {
  submittedAt: number;
  answer?: string;
  reactionTime: number | null;
  falseStart: boolean;
  valid: boolean;
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
  submissions: Map<number, PlayerSubmission>;
  metrics: PlayerMetrics;
};

export type StimulusPlayerResult = {
  userId: string;
  displayName: string;
  isCorrect: boolean;
  reacted: boolean;
  falseStart: boolean;
  ignored: boolean;
  answer: string | null;
  reactionTime: number | null;
  pointsAwarded: boolean;
};

export type StimulusResult = {
  stimulusIndex: number;
  mode: GameMode;
  stimulus: Stimulus;
  resolvedAt: number;
  winners: string[];
  players: StimulusPlayerResult[];
};

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
    metrics: Omit<PlayerMetrics, "reactionTimes">;
  }>;
};

export type GameRound = {
  id: string;
  ownerId: string;
  n: number;
  mode: GameMode;
  tournament: boolean;
  rated: boolean;
  length: number;
  goRatio: number;
  baseIntervalMs: number;
  currentIntervalMs: number;
  stimuli: Stimulus[];
  status: "lobby" | "running" | "finished";
  startedAt?: number;
  finishedAt?: number;
  currentStimulusIndex: number;
  currentStimulusStartedAt?: number;
  currentStimulusVisibleAt?: number;
  currentStimulusDurationMs?: number;
  players: Map<string, PlayerState>;
  history: RoundHistoryEntry[];
  lastResult: StimulusResult | null;
  ratingProcessed: boolean;
};

export type SubmitResult = {
  stimulusIndex: number;
  isCorrect: boolean;
  expectedMatch: boolean | null;
  speedChanged: boolean;
  currentIntervalMs: number;
  finished: boolean;
  ignored: boolean;
  reason: "duplicate" | "late" | "waiting" | null;
  reactionTime: number | null;
  falseStart: boolean;
};

const GRID_CELLS = 9;
const RECENT_WINDOW = 5;
const SPEED_UP_FACTOR = 0.9;
const MIN_INTERVAL_MS = 450;
const REACTION_MIN_DELAY_MS = 1000;
const REACTION_MAX_DELAY_MS = 3000;
const STROOP_COLORS: StroopColor[] = ["red", "blue", "green", "yellow"];

export function generateSequence(length: number, randomInt = (max: number) => Math.floor(Math.random() * max)) {
  if (length < 1) {
    throw new Error("Sequence length must be positive.");
  }

  return Array.from({ length }, () => randomInt(GRID_CELLS)).map((position) => ({
    kind: "grid" as const,
    position
  }));
}

export function createRound(params: {
  id: string;
  ownerId: string;
  ownerName: string;
  n: number;
  mode: GameMode;
  tournament: boolean;
  rated?: boolean;
  length: number;
  baseIntervalMs: number;
  botAccuracy?: number | null;
  goRatio?: number | null;
  stimuli?: Stimulus[];
}): GameRound {
  if (![2, 3, 4].includes(params.n)) {
    throw new Error("N must be 2, 3, or 4.");
  }
  if (params.length <= 0) {
    throw new Error("Round length must be positive.");
  }
  if (params.baseIntervalMs < MIN_INTERVAL_MS) {
    throw new Error(`Base interval must be at least ${MIN_INTERVAL_MS} ms.`);
  }

  const goRatio = params.goRatio ?? 0.7;
  if (goRatio <= 0 || goRatio >= 1) {
    throw new Error("GO ratio must be between 0 and 1.");
  }

  const stimuli = params.stimuli ?? generateStimuli(params.mode, params.length, goRatio);
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
    rated: params.rated ?? false,
    length: params.length,
    goRatio,
    baseIntervalMs: params.baseIntervalMs,
    currentIntervalMs: params.baseIntervalMs,
    stimuli,
    status: "lobby",
    currentStimulusIndex: 0,
    players,
    history: [],
    lastResult: null,
    ratingProcessed: false
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
    answeredStimuli: new Set(),
    submissions: new Map(),
    metrics: {
      averageReactionTime: null,
      bestReactionTime: null,
      consistency: null,
      falsePositives: 0,
      misses: 0,
      falseStarts: 0,
      conflictErrors: 0,
      accuracy: 0,
      correctTrials: 0,
      totalTrials: 0,
      reactionTimes: []
    }
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
  scheduleStimulus(round, 0, now);
}

export function advanceRoundState(round: GameRound, now = Date.now()) {
  if (round.status !== "running") {
    return { changed: false, finished: round.status === "finished" };
  }

  let changed = false;
  while (round.status === "running" && round.currentStimulusStartedAt !== undefined) {
    const deadline = getCurrentStimulusDeadline(round);
    if (now < deadline) {
      break;
    }

    finalizeStimulus(round, round.currentStimulusIndex, deadline);
    changed = true;

    if (round.currentStimulusIndex >= round.length - 1) {
      finishRound(round, deadline);
      break;
    }

    scheduleStimulus(round, round.currentStimulusIndex + 1, deadline);
  }

  const finished = round.status !== "running";
  return { changed, finished };
}

export function getCurrentStimulusIndex(round: GameRound) {
  return round.currentStimulusIndex;
}

export function getCurrentStimulus(round: GameRound, now = Date.now()) {
  const stimulus = round.stimuli[round.currentStimulusIndex] ?? null;
  if (!stimulus) {
    return null;
  }

  const visible = isStimulusVisible(round, now);
  if (stimulus.kind === "reaction-time" && !visible) {
    return {
      kind: "reaction-time" as const,
      visible: false,
      delayMs: stimulus.delayMs
    };
  }

  return {
    ...stimulus,
    visible
  };
}

export function isMatchAt(round: Pick<GameRound, "n" | "mode" | "stimuli">, stimulusIndex: number) {
  const current = round.stimuli[stimulusIndex];
  if (!current || current.kind !== "grid") {
    return false;
  }

  if (round.mode === "recent-5") {
    const start = Math.max(0, stimulusIndex - RECENT_WINDOW);
    return round.stimuli
      .slice(start, stimulusIndex)
      .some((stimulus) => stimulus.kind === "grid" && stimulus.position === current.position);
  }

  if (stimulusIndex < round.n) {
    return false;
  }

  const previous = round.stimuli[stimulusIndex - round.n];
  return previous?.kind === "grid" && previous.position === current.position;
}

export function validateGoNoGoResponse(stimulus: GoNoGoStimulus, clicked: boolean) {
  return (stimulus.type === "GO" && clicked) || (stimulus.type === "NO_GO" && !clicked);
}

export function validateStroopResponse(stimulus: StroopStimulus, answer: string) {
  return answer === stimulus.color;
}

export function validateReactionResponse(visibleAt: number, clickedAt: number) {
  return {
    falseStart: clickedAt < visibleAt,
    reactionTime: clickedAt >= visibleAt ? clickedAt - visibleAt : null
  };
}

export function submitMatch(round: GameRound, userId: string, answer?: string, now = Date.now()): SubmitResult {
  advanceRoundState(round, now);

  if (round.status !== "running") {
    return {
      stimulusIndex: round.currentStimulusIndex,
      isCorrect: false,
      expectedMatch: null,
      speedChanged: false,
      currentIntervalMs: round.currentIntervalMs,
      finished: true,
      ignored: true,
      reason: "late",
      reactionTime: null,
      falseStart: false
    };
  }

  const player = round.players.get(userId);
  if (!player) {
    throw new Error("Player is not in round.");
  }

  const stimulusIndex = round.currentStimulusIndex;
  const stimulus = round.stimuli[stimulusIndex];
  if (!stimulus) {
    throw new Error("Stimulus not found.");
  }
  if (player.answeredStimuli.has(stimulusIndex)) {
    return {
      stimulusIndex,
      isCorrect: false,
      expectedMatch: null,
      speedChanged: false,
      currentIntervalMs: round.currentIntervalMs,
      finished: false,
      ignored: true,
      reason: "duplicate",
      reactionTime: null,
      falseStart: false
    };
  }

  const deadline = getCurrentStimulusDeadline(round);
  if (now > deadline) {
    return {
      stimulusIndex,
      isCorrect: false,
      expectedMatch: null,
      speedChanged: false,
      currentIntervalMs: round.currentIntervalMs,
      finished: false,
      ignored: true,
      reason: "late",
      reactionTime: null,
      falseStart: false
    };
  }

  let isCorrect = false;
  let expectedMatch: boolean | null = null;
  let reactionTime: number | null = null;
  let falseStart = false;
  let speedChanged = false;

  switch (round.mode) {
    case "classic":
    case "recent-5": {
      expectedMatch = isMatchAt(round, stimulusIndex);
      isCorrect = expectedMatch;
      player.answeredStimuli.add(stimulusIndex);
      player.submissions.set(stimulusIndex, {
        submittedAt: now,
        reactionTime: round.currentStimulusVisibleAt ? now - round.currentStimulusVisibleAt : null,
        falseStart: false,
        valid: isCorrect
      });
      if (isCorrect) {
        player.correct += 1;
      } else {
        player.metrics.falsePositives += 1;
        speedChanged = registerError(round, player);
      }
      break;
    }
    case "go-no-go": {
      if (stimulus.kind !== "go-no-go") {
        throw new Error("Invalid stimulus for Go/No-Go.");
      }
      reactionTime = round.currentStimulusVisibleAt ? now - round.currentStimulusVisibleAt : null;
      isCorrect = validateGoNoGoResponse(stimulus, true);
      player.answeredStimuli.add(stimulusIndex);
      player.submissions.set(stimulusIndex, {
        submittedAt: now,
        reactionTime,
        falseStart: false,
        valid: isCorrect
      });
      if (stimulus.type === "GO") {
        registerTrial(player, isCorrect, reactionTime);
      } else {
        player.metrics.totalTrials += 1;
        player.metrics.falsePositives += 1;
        updateAccuracy(player);
      }
      if (isCorrect) {
        player.correct += 1;
      } else {
        speedChanged = registerError(round, player);
      }
      break;
    }
    case "reaction-time": {
      if (stimulus.kind !== "reaction-time") {
        throw new Error("Invalid stimulus for reaction test.");
      }
      const validation = validateReactionResponse(round.currentStimulusVisibleAt ?? now, now);
      falseStart = validation.falseStart;
      reactionTime = validation.reactionTime;
      player.answeredStimuli.add(stimulusIndex);
      player.submissions.set(stimulusIndex, {
        submittedAt: now,
        reactionTime,
        falseStart,
        valid: !falseStart && reactionTime !== null
      });
      player.metrics.totalTrials += 1;
      if (falseStart) {
        player.metrics.falseStarts += 1;
        updateAccuracy(player);
        speedChanged = registerError(round, player);
      } else if (reactionTime !== null) {
        addReactionTime(player, reactionTime);
        player.metrics.correctTrials += 1;
        updateAccuracy(player);
      }
      isCorrect = !falseStart && reactionTime !== null;
      break;
    }
    case "stroop": {
      if (stimulus.kind !== "stroop") {
        throw new Error("Invalid stimulus for Stroop.");
      }
      const normalizedAnswer = (answer ?? "").trim().toLowerCase();
      if (!normalizedAnswer) {
        throw new Error("Answer is required for Stroop mode.");
      }
      reactionTime = round.currentStimulusVisibleAt ? now - round.currentStimulusVisibleAt : null;
      isCorrect = validateStroopResponse(stimulus, normalizedAnswer);
      player.answeredStimuli.add(stimulusIndex);
      player.submissions.set(stimulusIndex, {
        submittedAt: now,
        answer: normalizedAnswer,
        reactionTime,
        falseStart: false,
        valid: isCorrect
      });
      player.metrics.totalTrials += 1;
      if (isCorrect) {
        addReactionTime(player, reactionTime);
        player.metrics.correctTrials += 1;
      } else if (stimulus.congruent === false) {
        player.metrics.conflictErrors += 1;
      }
      updateAccuracy(player);
      if (!isCorrect) {
        speedChanged = registerError(round, player);
      }
      break;
    }
  }

  return {
    stimulusIndex,
    isCorrect,
    expectedMatch,
    speedChanged,
    currentIntervalMs: round.currentIntervalMs,
    finished: false,
    ignored: false,
    reason: null,
    reactionTime,
    falseStart
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
      penalty: player.penalty,
      metrics: {
        averageReactionTime: player.metrics.averageReactionTime,
        bestReactionTime: player.metrics.bestReactionTime,
        consistency: player.metrics.consistency,
        falsePositives: player.metrics.falsePositives,
        misses: player.metrics.misses,
        falseStarts: player.metrics.falseStarts,
        conflictErrors: player.metrics.conflictErrors,
        accuracy: player.metrics.accuracy,
        correctTrials: player.metrics.correctTrials,
        totalTrials: player.metrics.totalTrials
      }
    }))
  };
}

function generateStimuli(mode: GameMode, length: number, goRatio: number): Stimulus[] {
  switch (mode) {
    case "classic":
    case "recent-5":
      return generateSequence(length);
    case "go-no-go":
      return Array.from({ length }, () => ({
        kind: "go-no-go" as const,
        type: (Math.random() < goRatio ? "GO" : "NO_GO") as GoNoGoType
      }));
    case "reaction-time":
      return Array.from({ length }, () => ({
        kind: "reaction-time" as const,
        delayMs: randomBetween(REACTION_MIN_DELAY_MS, REACTION_MAX_DELAY_MS)
      }));
    case "stroop":
      return Array.from({ length }, () => createStroopStimulus());
  }
}

function createStroopStimulus(): StroopStimulus {
  const word = pickOne(STROOP_COLORS);
  const congruent = Math.random() < 0.5;
  const color = congruent ? word : pickOne(STROOP_COLORS.filter((entry) => entry !== word));

  return {
    kind: "stroop",
    word,
    color,
    congruent
  };
}

function scheduleStimulus(round: GameRound, index: number, now: number) {
  const stimulus = round.stimuli[index];
  if (!stimulus) {
    finishRound(round, now);
    return;
  }

  round.currentStimulusIndex = index;
  round.currentStimulusStartedAt = now;
  round.currentStimulusDurationMs = round.currentIntervalMs;
  round.currentStimulusVisibleAt = stimulus.kind === "reaction-time" ? now + stimulus.delayMs : now;
}

function finalizeStimulus(round: GameRound, stimulusIndex: number, resolvedAt: number) {
  const stimulus = round.stimuli[stimulusIndex];
  if (!stimulus) {
    return;
  }

  const playerResults: StimulusPlayerResult[] = [];
  const winners: string[] = [];

  switch (round.mode) {
    case "classic":
    case "recent-5": {
      for (const player of round.players.values()) {
        const submission = player.submissions.get(stimulusIndex);
        playerResults.push({
          userId: player.userId,
          displayName: player.displayName,
          isCorrect: submission?.valid ?? false,
          reacted: Boolean(submission),
          falseStart: false,
          ignored: !submission,
          answer: null,
          reactionTime: submission?.reactionTime ?? null,
          pointsAwarded: submission?.valid ?? false
        });
      }
      break;
    }
    case "go-no-go": {
      if (stimulus.kind !== "go-no-go") {
        break;
      }

      for (const player of round.players.values()) {
        const submission = player.submissions.get(stimulusIndex);
        if (!submission) {
          player.metrics.totalTrials += 1;
          if (stimulus.type === "GO") {
            player.metrics.misses += 1;
            updateAccuracy(player);
            registerError(round, player);
            playerResults.push({
              userId: player.userId,
              displayName: player.displayName,
              isCorrect: false,
              reacted: false,
              falseStart: false,
              ignored: true,
              answer: null,
              reactionTime: null,
              pointsAwarded: false
            });
          } else {
            player.metrics.correctTrials += 1;
            updateAccuracy(player);
            player.correct += 1;
            winners.push(player.userId);
            playerResults.push({
              userId: player.userId,
              displayName: player.displayName,
              isCorrect: true,
              reacted: false,
              falseStart: false,
              ignored: true,
              answer: null,
              reactionTime: null,
              pointsAwarded: true
            });
          }
          continue;
        }

        playerResults.push({
          userId: player.userId,
          displayName: player.displayName,
          isCorrect: submission.valid,
          reacted: true,
          falseStart: false,
          ignored: false,
          answer: stimulus.type,
          reactionTime: submission.reactionTime,
          pointsAwarded: submission.valid
        });
        if (submission.valid) {
          winners.push(player.userId);
        }
      }
      break;
    }
    case "reaction-time": {
      const validResponses = [...round.players.values()]
        .map((player) => ({ player, submission: player.submissions.get(stimulusIndex) }))
        .filter((entry): entry is { player: PlayerState; submission: PlayerSubmission } => {
          const submission = entry.submission;
          return submission !== undefined && submission.valid && submission.reactionTime !== null;
        })
        .sort((a, b) => (a.submission.reactionTime ?? Number.MAX_SAFE_INTEGER) - (b.submission.reactionTime ?? Number.MAX_SAFE_INTEGER));

      const winnerId = validResponses[0]?.player.userId ?? null;
      if (winnerId) {
        winners.push(winnerId);
        round.players.get(winnerId)!.correct += 1;
      }

      for (const player of round.players.values()) {
        const submission = player.submissions.get(stimulusIndex);
        if (!submission) {
          player.metrics.totalTrials += 1;
          updateAccuracy(player);
        }
        playerResults.push({
          userId: player.userId,
          displayName: player.displayName,
          isCorrect: submission?.valid ?? false,
          reacted: Boolean(submission),
          falseStart: submission?.falseStart ?? false,
          ignored: !submission,
          answer: null,
          reactionTime: submission?.reactionTime ?? null,
          pointsAwarded: winnerId === player.userId
        });
      }
      break;
    }
    case "stroop": {
      if (stimulus.kind !== "stroop") {
        break;
      }

      const correctPlayers = [...round.players.values()]
        .map((player) => ({ player, submission: player.submissions.get(stimulusIndex) }))
        .filter((entry): entry is { player: PlayerState; submission: PlayerSubmission } => {
          const submission = entry.submission;
          return submission !== undefined && submission.valid && submission.reactionTime !== null;
        })
        .sort((a, b) => (a.submission.reactionTime ?? Number.MAX_SAFE_INTEGER) - (b.submission.reactionTime ?? Number.MAX_SAFE_INTEGER));

      const winnerId = correctPlayers[0]?.player.userId ?? null;
      if (winnerId) {
        winners.push(winnerId);
        round.players.get(winnerId)!.correct += 1;
      }

      for (const player of round.players.values()) {
        const submission = player.submissions.get(stimulusIndex);
        if (!submission) {
          player.metrics.totalTrials += 1;
          player.metrics.misses += 1;
          updateAccuracy(player);
          registerError(round, player);
          playerResults.push({
            userId: player.userId,
            displayName: player.displayName,
            isCorrect: false,
            reacted: false,
            falseStart: false,
            ignored: true,
            answer: null,
            reactionTime: null,
            pointsAwarded: false
          });
          continue;
        }

        playerResults.push({
          userId: player.userId,
          displayName: player.displayName,
          isCorrect: submission.valid,
          reacted: true,
          falseStart: false,
          ignored: false,
          answer: submission.answer ?? null,
          reactionTime: submission.reactionTime,
          pointsAwarded: winnerId === player.userId
        });
      }
      break;
    }
  }

  round.lastResult = {
    stimulusIndex,
    mode: round.mode,
    stimulus,
    resolvedAt,
    winners,
    players: playerResults
  };
}

function getCurrentStimulusDeadline(round: GameRound) {
  if (round.currentStimulusStartedAt === undefined || round.currentStimulusDurationMs === undefined) {
    return 0;
  }

  if (round.mode === "reaction-time") {
    return (round.currentStimulusVisibleAt ?? round.currentStimulusStartedAt) + round.currentStimulusDurationMs;
  }

  return round.currentStimulusStartedAt + round.currentStimulusDurationMs;
}

function isStimulusVisible(round: GameRound, now: number) {
  if (round.currentStimulusVisibleAt === undefined) {
    return false;
  }

  return now >= round.currentStimulusVisibleAt;
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

function registerTrial(player: PlayerState, isCorrect: boolean, reactionTime: number | null) {
  player.metrics.totalTrials += 1;
  if (isCorrect) {
    player.metrics.correctTrials += 1;
    addReactionTime(player, reactionTime);
  }
  updateAccuracy(player);
}

function addReactionTime(player: PlayerState, reactionTime: number | null) {
  if (reactionTime === null) {
    return;
  }

  player.metrics.reactionTimes.push(reactionTime);
  player.metrics.bestReactionTime =
    player.metrics.bestReactionTime === null ? reactionTime : Math.min(player.metrics.bestReactionTime, reactionTime);
  player.metrics.averageReactionTime = Math.round(
    player.metrics.reactionTimes.reduce((sum, current) => sum + current, 0) / player.metrics.reactionTimes.length
  );
  player.metrics.consistency = calculateDeviation(player.metrics.reactionTimes);
}

function updateAccuracy(player: PlayerState) {
  player.metrics.accuracy =
    player.metrics.totalTrials === 0 ? 0 : Math.round((player.metrics.correctTrials / player.metrics.totalTrials) * 100);
}

function calculateDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, current) => sum + current, 0) / values.length;
  const variance = values.reduce((sum, current) => sum + (current - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}
