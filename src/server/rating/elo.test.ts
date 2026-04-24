import { describe, expect, it } from "vitest";
import { calculateRatingUpdates, getExpectedScore, getKFactor, getRank } from "./elo";

describe("elo rating system", () => {
  it("maps rating to rank tiers", () => {
    expect(getRank(900)).toBe("Bronze");
    expect(getRank(1000)).toBe("Silver");
    expect(getRank(1450)).toBe("Gold");
    expect(getRank(1900)).toBe("Platinum");
    expect(getRank(2300)).toBe("Diamond");
    expect(getRank(2600)).toBe("Master");
  });

  it("uses correct k-factor thresholds", () => {
    expect(getKFactor(1400)).toBe(32);
    expect(getKFactor(1500)).toBe(16);
  });

  it("calculates expected score symmetrically", () => {
    const left = getExpectedScore(1200, 1200);
    expect(left).toBe(0.5);
    expect(getExpectedScore(1600, 1200)).toBeGreaterThan(0.5);
  });

  it("awards more rating to the better player in multiplayer standings", () => {
    const updates = calculateRatingUpdates([
      {
        userId: "u1",
        displayName: "Alice",
        rating: 1000,
        correct: 10,
        averageReactionTime: 500,
        accuracy: 90
      },
      {
        userId: "u2",
        displayName: "Bob",
        rating: 1000,
        correct: 8,
        averageReactionTime: 600,
        accuracy: 80
      },
      {
        userId: "u3",
        displayName: "Carol",
        rating: 1000,
        correct: 6,
        averageReactionTime: 700,
        accuracy: 75
      }
    ]);

    expect(updates[0]?.change).toBeGreaterThan(0);
    expect(updates[2]?.change).toBeLessThan(0);
  });
});
