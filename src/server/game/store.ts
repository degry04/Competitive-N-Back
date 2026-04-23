import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { responses, roundPlayers, rounds } from "@/server/db/schema";
import {
  createRound,
  finishRound,
  getCurrentStimulusIndex,
  getWinner,
  isMatchAt,
  joinRound,
  registerMiss,
  shouldBotPress,
  startRound,
  submitMatch,
  type GameMode,
  type GameRound,
  type PlayerState
} from "./nback";

const activeRounds = new Map<string, GameRound>();

export async function listActiveRounds() {
  await Promise.all([...activeRounds.values()].map((round) => processBotPlayers(round)));
  return [...activeRounds.values()].map(toPublicRound);
}

export async function createGameRound(input: {
  ownerId: string;
  ownerName: string;
  n: number;
  mode: GameMode;
  tournament: boolean;
  length: number;
  baseIntervalMs: number;
  botAccuracy?: number | null;
}) {
  const round = createRound({
    id: randomUUID(),
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    n: input.n,
    mode: input.mode,
    tournament: input.tournament,
    length: input.length,
    baseIntervalMs: input.baseIntervalMs,
    botAccuracy: input.botAccuracy
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
    length: previous.length,
    baseIntervalMs: previous.baseIntervalMs,
    botAccuracy: bot?.botAccuracy ?? null
  });

  nextRound.history = [...previous.history];
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

export async function submitGameResponse(roundId: string, userId: string) {
  const round = getActiveRound(roundId);
  const result = submitMatch(round, userId);
  const player = round.players.get(userId)!;

  await db.insert(responses).values({
    id: randomUUID(),
    roundId,
    userId,
    stimulusIndex: result.stimulusIndex,
    expectedMatch: result.expectedMatch,
    isCorrect: result.isCorrect,
    intervalAfterMs: result.currentIntervalMs,
    createdAt: new Date()
  });

  await db
    .update(roundPlayers)
    .set({ correct: player.correct, errors: player.errors, penalty: player.penalty })
    .where(eq(roundPlayers.id, `${roundId}:${userId}`));

  await db.update(rounds).set({ currentIntervalMs: round.currentIntervalMs }).where(eq(rounds.id, round.id));

  if (round.status === "finished") {
    await persistFinishedRound(round);
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
    botAccuracy: getRoundBotAccuracy(round),
    length: round.length,
    baseIntervalMs: round.baseIntervalMs,
    currentIntervalMs: round.currentIntervalMs,
    status: round.status,
    sequenceJson: JSON.stringify(round.sequence),
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

async function persistFinishedRound(round: GameRound) {
  const winner = getWinner(round);
  await db
    .update(rounds)
    .set({
      status: "finished",
      finishedAt: new Date(round.finishedAt ?? Date.now()),
      winnerUserId: winner?.userId ?? null
    })
    .where(eq(rounds.id, round.id));
}

function toPublicRound(round: GameRound) {
  const index = getCurrentStimulusIndex(round);
  return {
    id: round.id,
    ownerId: round.ownerId,
    n: round.n,
    mode: round.mode,
    tournament: round.tournament,
    length: round.length,
    status: round.status,
    currentIntervalMs: round.currentIntervalMs,
    stimulusIndex: index,
    currentPosition: round.sequence[index] ?? null,
    players: [...round.players.values()].map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      isBot: player.isBot,
      correct: player.correct,
      errors: player.errors,
      penalty: player.penalty
    })),
    winner: round.status === "finished" ? getWinner(round)?.userId ?? null : null,
    history: round.history
  };
}

async function processBotPlayers(round: GameRound) {
  if (round.status !== "running") {
    return;
  }

  const stimulusIndex = getCurrentStimulusIndex(round);
  const now = Date.now();
  let intervalChanged = false;

  for (const bot of round.players.values()) {
    if (!bot.isBot || bot.answeredStimuli.has(stimulusIndex)) {
      continue;
    }

    const accuracy = bot.botAccuracy ?? 0.75;
    const expectedMatch = isMatchAt(round, stimulusIndex);
    const botPresses = shouldBotPress(round, stimulusIndex, accuracy);

    if (botPresses) {
      submitMatch(round, bot.userId, now);
      continue;
    }

    if (expectedMatch) {
      intervalChanged = registerMiss(round, bot.userId, stimulusIndex) || intervalChanged;
    } else {
      bot.answeredStimuli.add(stimulusIndex);
    }
  }

  if (intervalChanged) {
    await db.update(rounds).set({ currentIntervalMs: round.currentIntervalMs }).where(eq(rounds.id, round.id));
  }

  if (stimulusIndex >= round.length - 1 && round.status === "running") {
    finishRound(round, now);
    await persistFinishedRound(round);
  }
}

function getRoundBotAccuracy(round: GameRound) {
  const bot = [...round.players.values()].find((player: PlayerState) => player.isBot);
  return bot?.botAccuracy === undefined ? null : Math.round(bot.botAccuracy * 100);
}
