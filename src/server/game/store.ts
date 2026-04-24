import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { ratingHistory, responses, roundPlayers, rounds, user } from "@/server/db/schema";
import {
  advanceRoundState,
  createRound,
  finishRound,
  getCurrentStimulus,
  getCurrentStimulusIndex,
  getWinner,
  joinRound,
  startRound,
  submitMatch,
  type GameMode,
  type GameRound,
  type GoNoGoType,
  type PlayerState,
  type Stimulus
} from "./nback";
import { calculateRatingUpdates, DEFAULT_RATING, playerStateToRatingParticipant } from "@/server/rating/elo";

const activeRounds = new Map<string, GameRound>();

export async function listActiveRounds() {
  await Promise.all([...activeRounds.values()].map((round) => processActiveRound(round)));
  return [...activeRounds.values()].map(toPublicRound);
}

export async function createGameRound(input: {
  ownerId: string;
  ownerName: string;
  n: number;
  mode: GameMode;
  tournament: boolean;
  rated: boolean;
  length: number;
  baseIntervalMs: number;
  botAccuracy?: number | null;
  goRatio?: number | null;
}) {
  const round = createRound({
    id: randomUUID(),
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    n: input.n,
    mode: input.mode,
    tournament: input.tournament,
    rated: input.rated,
    length: input.length,
    baseIntervalMs: input.baseIntervalMs,
    botAccuracy: input.botAccuracy,
    goRatio: input.goRatio
  });

  activeRounds.set(round.id, round);
  await persistRound(round);
  return toPublicRound(round);
}

export async function listTournamentResults(userId?: string) {
  const tournamentRounds = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.tournament, true), eq(rounds.status, "finished")))
    .orderBy(desc(rounds.finishedAt));

  if (tournamentRounds.length === 0) {
    return [];
  }

  const roundIds = tournamentRounds.map((round) => round.id);
  const players = await db.select().from(roundPlayers).where(inArray(roundPlayers.roundId, roundIds));
  const playersByRound = new Map<string, typeof players>();

  for (const player of players) {
    playersByRound.set(player.roundId, [...(playersByRound.get(player.roundId) ?? []), player]);
  }

  return tournamentRounds
    .map((round) => {
      const roundPlayersList = (playersByRound.get(round.id) ?? []).sort(
        (a, b) => b.correct - a.correct || a.errors - b.errors
      );

      return {
        id: round.id,
        n: round.n,
        mode: round.mode,
        length: round.length,
        baseIntervalMs: round.baseIntervalMs,
        tournament: round.tournament,
        rated: round.rated,
        finishedAt: round.finishedAt?.toISOString() ?? null,
        winnerUserId: round.winnerUserId,
        participated: userId ? roundPlayersList.some((player) => player.userId === userId) : false,
        players: roundPlayersList.map((player, index) => ({
          place: index + 1,
          userId: player.userId,
          displayName: player.displayName,
          correct: player.correct,
          errors: player.errors,
          penalty: player.penalty
        }))
      };
    })
    .filter((round) => !userId || round.participated);
}

export async function listUserGameHistory(userId: string) {
  const playedRounds = await db
    .select({
      id: rounds.id,
      n: rounds.n,
      mode: rounds.mode,
      tournament: rounds.tournament,
      rated: rounds.rated,
      length: rounds.length,
      baseIntervalMs: rounds.baseIntervalMs,
      finishedAt: rounds.finishedAt,
      winnerUserId: rounds.winnerUserId
    })
    .from(rounds)
    .innerJoin(roundPlayers, eq(roundPlayers.roundId, rounds.id))
    .where(and(eq(rounds.status, "finished"), eq(roundPlayers.userId, userId)))
    .orderBy(desc(rounds.finishedAt));

  if (playedRounds.length === 0) {
    return [];
  }

  const roundIds = playedRounds.map((row) => row.id);
  const players = await db.select().from(roundPlayers).where(inArray(roundPlayers.roundId, roundIds));
  const playersByRound = new Map<string, typeof players>();

  for (const player of players) {
    playersByRound.set(player.roundId, [...(playersByRound.get(player.roundId) ?? []), player]);
  }

  return playedRounds.map((round) => {
    const roundPlayersList = (playersByRound.get(round.id) ?? []).sort(
      (a, b) => b.correct - a.correct || a.errors - b.errors
    );

    return {
      id: round.id,
      n: round.n,
      mode: round.mode,
      tournament: round.tournament,
      rated: round.rated,
      length: round.length,
      baseIntervalMs: round.baseIntervalMs,
      finishedAt: round.finishedAt?.toISOString() ?? null,
      winnerUserId: round.winnerUserId,
      players: roundPlayersList.map((player, index) => ({
        place: index + 1,
        userId: player.userId,
        displayName: player.displayName,
        correct: player.correct,
        errors: player.errors,
        penalty: player.penalty
      }))
    };
  });
}

export async function joinGameRound(roundId: string, userId: string, displayName: string) {
  const round = getActiveRound(roundId);
  joinRound(round, userId, displayName);
  await persistPlayer(roundId, round.players.get(userId)!);
  return toPublicRound(round);
}

export async function closeGameLobby(roundId: string, userId: string) {
  const round = getActiveRound(roundId);
  if (round.ownerId !== userId) {
    throw new Error("Only the owner can close the lobby.");
  }

  if (round.status === "running") {
    finishRound(round);
    await persistFinishedRound(round);
  }

  activeRounds.delete(round.id);
  return { closedRoundId: round.id };
}

export async function createNextGameRound(roundId: string, userId: string) {
  const previous = getActiveRound(roundId);
  if (previous.ownerId !== userId) {
    throw new Error("Only the owner can start the next round.");
  }
  if (previous.status !== "finished") {
    throw new Error("Finish the current round before creating the next one.");
  }

  const owner = previous.players.get(previous.ownerId);
  if (!owner) {
    throw new Error("Owner is not in the lobby.");
  }

  const bot = [...previous.players.values()].find((player) => player.isBot);
  const nextRound = createRound({
    id: randomUUID(),
    ownerId: previous.ownerId,
    ownerName: owner.displayName,
    n: previous.n,
    mode: previous.mode,
    tournament: previous.tournament,
    rated: previous.rated,
    length: previous.length,
    baseIntervalMs: previous.baseIntervalMs,
    botAccuracy: bot?.botAccuracy ?? null,
    goRatio: previous.goRatio
  });

  nextRound.history = [...previous.history];
  nextRound.ratingProcessed = false;
  for (const player of previous.players.values()) {
    if (player.userId === previous.ownerId || player.isBot) {
      continue;
    }
    joinRound(nextRound, player.userId, player.displayName);
  }

  activeRounds.delete(previous.id);
  activeRounds.set(nextRound.id, nextRound);
  await persistRound(nextRound);
  return toPublicRound(nextRound);
}

export async function startGameRound(roundId: string, userId: string) {
  const round = getActiveRound(roundId);
  if (round.ownerId !== userId) {
    throw new Error("Only the owner can start the round.");
  }

  startRound(round);
  await db
    .update(rounds)
    .set({ status: "running", startedAt: new Date(round.startedAt!), currentIntervalMs: round.currentIntervalMs })
    .where(eq(rounds.id, round.id));
  return toPublicRound(round);
}

export async function submitGameResponse(roundId: string, userId: string, answer?: string) {
  const round = getActiveRound(roundId);
  const result = submitMatch(round, userId, answer);
  const player = round.players.get(userId)!;

  if (!result.ignored) {
    await db.insert(responses).values({
      id: randomUUID(),
      roundId,
      userId,
      stimulusIndex: result.stimulusIndex,
      expectedMatch: result.expectedMatch ?? false,
      isCorrect: result.isCorrect,
      intervalAfterMs: result.currentIntervalMs,
      createdAt: new Date()
    });
  }

  await persistScoreboard(round);
  await syncRoundRecord(round);

  if (round.status === "finished") {
    await persistFinishedRound(round);
  } else if (player && !player.isBot) {
    await persistPlayerScore(round.id, player);
  }

  return { round: toPublicRound(round), result };
}

export async function finishGameRound(roundId: string, userId: string) {
  const round = getActiveRound(roundId);
  if (round.ownerId !== userId) {
    throw new Error("Only the owner can finish the round.");
  }

  finishRound(round);
  await persistFinishedRound(round);
  return toPublicRound(round);
}

function getActiveRound(roundId: string) {
  const round = activeRounds.get(roundId);
  if (!round) {
    throw new Error("Round not found or already archived.");
  }
  return round;
}

async function persistRound(round: GameRound) {
  await db.insert(rounds).values({
    id: round.id,
    ownerId: round.ownerId,
    n: round.n,
    mode: round.mode,
    tournament: round.tournament,
    rated: round.rated,
    botAccuracy: getRoundBotAccuracy(round),
    length: round.length,
    baseIntervalMs: round.baseIntervalMs,
    currentIntervalMs: round.currentIntervalMs,
    status: round.status,
    sequenceJson: JSON.stringify(round.stimuli),
    ratingProcessed: round.ratingProcessed,
    createdAt: new Date()
  });

  const owner = round.players.get(round.ownerId)!;
  await persistPlayer(round.id, owner);
}

async function persistPlayer(roundId: string, player: GameRound["players"] extends Map<string, infer P> ? P : never) {
  if (player.isBot) {
    return;
  }

  await db.insert(roundPlayers).values({
    id: `${roundId}:${player.userId}`,
    roundId,
    userId: player.userId,
    displayName: player.displayName,
    correct: player.correct,
    errors: player.errors,
    penalty: player.penalty,
    joinedAt: new Date()
  });
}

async function persistPlayerScore(roundId: string, player: PlayerState) {
  if (player.isBot) {
    return;
  }

  await db
    .update(roundPlayers)
    .set({ correct: player.correct, errors: player.errors, penalty: player.penalty })
    .where(eq(roundPlayers.id, `${roundId}:${player.userId}`));
}

async function persistScoreboard(round: GameRound) {
  await Promise.all([...round.players.values()].filter((player) => !player.isBot).map((player) => persistPlayerScore(round.id, player)));
}

async function syncRoundRecord(round: GameRound) {
  await db
    .update(rounds)
    .set({ currentIntervalMs: round.currentIntervalMs, status: round.status, ratingProcessed: round.ratingProcessed })
    .where(eq(rounds.id, round.id));
}

async function persistFinishedRound(round: GameRound) {
  const winner = getWinner(round);
  await persistScoreboard(round);
  await applyRatings(round);
  await db
    .update(rounds)
    .set({
      status: "finished",
      currentIntervalMs: round.currentIntervalMs,
      finishedAt: new Date(round.finishedAt ?? Date.now()),
      winnerUserId: winner?.userId ?? null,
      ratingProcessed: round.ratingProcessed
    })
    .where(eq(rounds.id, round.id));
}

function toPublicRound(round: GameRound) {
  const currentStimulus = getCurrentStimulus(round);
  return {
    id: round.id,
    ownerId: round.ownerId,
    n: round.n,
    mode: round.mode,
    tournament: round.tournament,
    rated: round.rated,
    length: round.length,
    status: round.status,
    currentIntervalMs: round.currentIntervalMs,
    stimulusIndex: getCurrentStimulusIndex(round),
    currentPosition: currentStimulus?.kind === "grid" && currentStimulus.visible ? currentStimulus.position : null,
    currentStimulus,
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
        accuracy: player.metrics.accuracy
      }
    })),
    winner: round.status === "finished" ? getWinner(round)?.userId ?? null : null,
    lastResult: round.lastResult,
    history: round.history
  };
}

async function processActiveRound(round: GameRound) {
  if (round.status !== "running") {
    return;
  }

  const beforeStatus = round.status;
  const beforeInterval = round.currentIntervalMs;
  const beforeIndex = round.currentStimulusIndex;
  const beforeSignature = playerSignature(round);

  advanceRoundState(round);
  processBotPlayers(round);
  advanceRoundState(round);

  const changed =
    beforeStatus !== round.status ||
    beforeInterval !== round.currentIntervalMs ||
    beforeIndex !== round.currentStimulusIndex ||
    beforeSignature !== playerSignature(round);

  if (!changed) {
    return;
  }

  await persistScoreboard(round);
  const finished = round.status !== "running";
  if (finished) {
    await persistFinishedRound(round);
  } else {
    await syncRoundRecord(round);
  }
}

function processBotPlayers(round: GameRound) {
  if (round.status !== "running") {
    return;
  }

  const currentStimulus = getCurrentStimulus(round);
  if (!currentStimulus?.visible) {
    return;
  }

  const currentIndex = round.currentStimulusIndex;
  for (const bot of round.players.values()) {
    if (!bot.isBot || bot.answeredStimuli.has(currentIndex)) {
      continue;
    }

    const accuracy = bot.botAccuracy ?? 0.75;
    const action = decideBotAction(round.mode, currentStimulus as Stimulus & { visible: boolean }, accuracy);
    if (!action.shouldAct) {
      continue;
    }

    const answer = currentStimulus.kind === "stroop" ? action.answer ?? null : undefined;
    submitMatch(round, bot.userId, answer ?? undefined);
  }
}

function decideBotAction(
  mode: GameMode,
  stimulus: Stimulus & { visible: boolean },
  accuracy: number
): { shouldAct: boolean; answer?: string } {
  switch (mode) {
    case "classic":
    case "recent-5":
      return stimulus.kind === "grid" && stimulus.visible
        ? { shouldAct: Math.random() < accuracy }
        : { shouldAct: false };
    case "go-no-go":
      if (stimulus.kind !== "go-no-go") {
        return { shouldAct: false };
      }
      return { shouldAct: stimulus.type === "GO" ? Math.random() < accuracy : Math.random() > accuracy };
    case "reaction-time":
      return { shouldAct: Math.random() < accuracy };
    case "stroop": {
      if (stimulus.kind !== "stroop") {
        return { shouldAct: false };
      }
      const correct = Math.random() < accuracy;
      return {
        shouldAct: true,
        answer: correct ? stimulus.color : pickWrongColor(stimulus.color)
      };
    }
  }
}

function pickWrongColor(color: string) {
  const colors = ["red", "blue", "green", "yellow"].filter((entry) => entry !== color);
  return colors[Math.floor(Math.random() * colors.length)]!;
}

function playerSignature(round: GameRound) {
  return [...round.players.values()]
    .map((player) => `${player.userId}:${player.correct}:${player.errors}:${player.penalty}:${player.metrics.accuracy}`)
    .join("|");
}

function getRoundBotAccuracy(round: GameRound) {
  const bot = [...round.players.values()].find((player: PlayerState) => player.isBot);
  return bot?.botAccuracy === undefined ? null : Math.round(bot.botAccuracy * 100);
}

async function applyRatings(round: GameRound) {
  if (round.ratingProcessed) {
    return;
  }
  if (!round.rated) {
    round.ratingProcessed = true;
    return;
  }

  const humanPlayers = [...round.players.values()].filter((player) => !player.isBot);
  if (humanPlayers.length < 2) {
    round.ratingProcessed = true;
    return;
  }

  const ratings = await db
    .select({
      id: user.id,
      rating: user.rating
    })
    .from(user)
    .where(inArray(user.id, humanPlayers.map((player) => player.userId)));

  const ratingByUserId = new Map(ratings.map((entry) => [entry.id, entry.rating]));
  const updates = calculateRatingUpdates(
    humanPlayers.map((player) => playerStateToRatingParticipant(player, ratingByUserId.get(player.userId) ?? DEFAULT_RATING))
  );

  await Promise.all(
    updates.map(async (update) => {
      await db
        .update(user)
        .set({
          rating: update.newRating,
          rank: update.rank,
          updatedAt: new Date()
        })
        .where(eq(user.id, update.userId));

      await db.insert(ratingHistory).values({
        id: randomUUID(),
        userId: update.userId,
        roundId: round.id,
        oldRating: update.oldRating,
        newRating: update.newRating,
        change: update.change,
        createdAt: new Date()
      });
    })
  );

  round.ratingProcessed = true;
}
