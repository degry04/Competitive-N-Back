import type { PlayerState } from "@/server/game/nback";

export const DEFAULT_RATING = 1000;

export function getRank(rating: number) {
  if (rating < 1000) {
    return "Bronze";
  }
  if (rating < 1400) {
    return "Silver";
  }
  if (rating < 1800) {
    return "Gold";
  }
  if (rating < 2200) {
    return "Platinum";
  }
  if (rating < 2600) {
    return "Diamond";
  }
  return "Master";
}

export function getKFactor(rating: number) {
  return rating < 1500 ? 32 : 16;
}

export function getExpectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export type RatingParticipant = {
  userId: string;
  displayName: string;
  rating: number;
  correct: number;
  averageReactionTime: number | null;
  accuracy: number;
};

export type RatingUpdate = {
  userId: string;
  oldRating: number;
  newRating: number;
  change: number;
  rank: string;
  place: number;
};

export function calculateRatingUpdates(participants: RatingParticipant[]) {
  if (participants.length < 2) {
    return participants.map((participant, index) => ({
      userId: participant.userId,
      oldRating: participant.rating,
      newRating: participant.rating,
      change: 0,
      rank: getRank(participant.rating),
      place: index + 1
    }));
  }

  const ranked = [...participants]
    .map((participant) => ({
      ...participant,
      performanceScore: getPerformanceScore(participant, participants)
    }))
    .sort(
      (a, b) =>
        b.correct - a.correct ||
        compareReactionTimes(a.averageReactionTime, b.averageReactionTime) ||
        b.accuracy - a.accuracy ||
        a.displayName.localeCompare(b.displayName)
    );

  return ranked.map((participant, index) => {
    const opponents = ranked.filter((entry) => entry.userId !== participant.userId);
    const kFactor = getKFactor(participant.rating);
    const pairwiseDelta = opponents.reduce((total, opponent) => {
      const expected = getExpectedScore(participant.rating, opponent.rating);
      const actual = getActualScore(participant, opponent);
      return total + kFactor * (actual - expected);
    }, 0);

    const averageDelta = pairwiseDelta / opponents.length;
    const multiplier = 0.9 + participant.performanceScore * 0.2;
    const change = Math.round(averageDelta * multiplier);
    const newRating = Math.max(0, participant.rating + change);

    return {
      userId: participant.userId,
      oldRating: participant.rating,
      newRating,
      change,
      rank: getRank(newRating),
      place: index + 1
    };
  });
}

export function playerStateToRatingParticipant(
  player: PlayerState,
  rating: number
): RatingParticipant {
  return {
    userId: player.userId,
    displayName: player.displayName,
    rating,
    correct: player.correct,
    averageReactionTime: player.metrics.averageReactionTime,
    accuracy: player.metrics.accuracy
  };
}

function getActualScore(player: RatingParticipant, opponent: RatingParticipant) {
  if (player.correct > opponent.correct) {
    return 1;
  }
  if (player.correct < opponent.correct) {
    return 0;
  }

  const reactionComparison = compareReactionTimes(player.averageReactionTime, opponent.averageReactionTime);
  if (reactionComparison < 0) {
    return 1;
  }
  if (reactionComparison > 0) {
    return 0;
  }

  return 0.5;
}

function getPerformanceScore(player: RatingParticipant, all: RatingParticipant[]) {
  const accuracyScore = clamp(player.accuracy / 100, 0, 1);
  const validReactionTimes = all.map((entry) => entry.averageReactionTime).filter((value): value is number => value !== null);
  let speedScore = 0.5;

  if (player.averageReactionTime !== null && validReactionTimes.length > 1) {
    const min = Math.min(...validReactionTimes);
    const max = Math.max(...validReactionTimes);
    speedScore = max === min ? 1 : 1 - (player.averageReactionTime - min) / (max - min);
  }

  return 0.7 * accuracyScore + 0.3 * clamp(speedScore, 0, 1);
}

function compareReactionTimes(left: number | null, right: number | null) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
