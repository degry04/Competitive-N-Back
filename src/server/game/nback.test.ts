import { describe, expect, it } from "vitest";
import { createRound, isMatchAt, joinRound, shouldBotPress, startRound, submitMatch } from "./nback";

function makeRound(sequence = [0, 1, 0, 2, 0, 4, 0]) {
  return createRound({
    id: "round-1",
    ownerId: "player-1",
    ownerName: "Ada",
    n: 2,
    mode: "classic",
    tournament: false,
    length: sequence.length,
    baseIntervalMs: 1000,
    sequence
  });
}

describe("competitive n-back business rules", () => {
  it("detects matches against the stimulus N steps back", () => {
    const round = makeRound();

    expect(isMatchAt(round, 0)).toBe(false);
    expect(isMatchAt(round, 2)).toBe(true);
    expect(isMatchAt(round, 3)).toBe(false);
    expect(isMatchAt(round, 4)).toBe(true);
  });

  it("requires 2 players and supports no more than 4 players", () => {
    const round = makeRound();

    expect(() => startRound(round, 0)).toThrow("At least 2 players");

    joinRound(round, "player-2", "Grace");
    joinRound(round, "player-3", "Linus");
    joinRound(round, "player-4", "Margaret");

    expect(() => joinRound(round, "player-5", "Barbara")).toThrow("up to 4 players");
  });

  it("adds penalties for wrong match presses", () => {
    const round = makeRound();
    joinRound(round, "player-2", "Grace");
    startRound(round, 0);

    const result = submitMatch(round, "player-1", 100);
    const player = round.players.get("player-1");

    expect(result.isCorrect).toBe(false);
    expect(player?.errors).toBe(1);
    expect(player?.penalty).toBe(1);
  });

  it("speeds up everyone after every third error from one player", () => {
    const round = makeRound([0, 1, 2, 3, 4, 5, 6]);
    joinRound(round, "player-2", "Grace");
    startRound(round, 0);

    submitMatch(round, "player-1", 100);
    submitMatch(round, "player-1", 1100);
    const third = submitMatch(round, "player-1", 2100);

    expect(third.speedChanged).toBe(true);
    expect(round.currentIntervalMs).toBe(900);
  });

  it("counts correct responses when the current stimulus is a match", () => {
    const round = makeRound([0, 1, 0, 3, 4]);
    joinRound(round, "player-2", "Grace");
    startRound(round, 0);

    const result = submitMatch(round, "player-1", 2100);

    expect(result.expectedMatch).toBe(true);
    expect(result.isCorrect).toBe(true);
    expect(round.players.get("player-1")?.correct).toBe(1);
  });

  it("supports the simplified recent-5 match mode", () => {
    const round = createRound({
      id: "round-2",
      ownerId: "player-1",
      ownerName: "Ada",
      n: 4,
      mode: "recent-5",
      tournament: false,
      length: 7,
      baseIntervalMs: 1000,
      sequence: [0, 1, 2, 3, 4, 0, 8]
    });

    expect(isMatchAt(round, 5)).toBe(true);
    expect(isMatchAt(round, 6)).toBe(false);
  });

  it("lets bots decide according to configured accuracy", () => {
    const round = makeRound([0, 1, 0, 3, 4]);

    expect(shouldBotPress(round, 2, 0.75, () => 0.2)).toBe(true);
    expect(shouldBotPress(round, 2, 0.75, () => 0.9)).toBe(false);
    expect(shouldBotPress(round, 3, 0.75, () => 0.9)).toBe(true);
  });
});
