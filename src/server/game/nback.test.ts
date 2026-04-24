import { describe, expect, it } from "vitest";
import {
  advanceRoundState,
  createRound,
  isMatchAt,
  joinRound,
  startRound,
  submitMatch,
  validateGoNoGoResponse,
  validateReactionResponse,
  validateStroopResponse
} from "./nback";

function makeRound(mode: Parameters<typeof createRound>[0]["mode"] = "classic", stimuli = undefined as Parameters<typeof createRound>[0]["stimuli"]) {
  return createRound({
    id: "round-1",
    ownerId: "player-1",
    ownerName: "Ada",
    n: 2,
    mode,
    tournament: false,
    length: stimuli?.length ?? 5,
    baseIntervalMs: 1000,
    goRatio: 0.7,
    stimuli
  });
}

describe("competitive trainer business rules", () => {
  it("detects classic n-back matches", () => {
    const round = makeRound("classic", [
      { kind: "grid", position: 0 },
      { kind: "grid", position: 1 },
      { kind: "grid", position: 0 },
      { kind: "grid", position: 3 }
    ]);

    expect(isMatchAt(round, 0)).toBe(false);
    expect(isMatchAt(round, 2)).toBe(true);
    expect(isMatchAt(round, 3)).toBe(false);
  });

  it("requires 2 players and supports no more than 4 players", () => {
    const round = makeRound();

    expect(() => startRound(round, 0)).toThrow("At least 2 players");

    joinRound(round, "player-2", "Grace");
    joinRound(round, "player-3", "Linus");
    joinRound(round, "player-4", "Margaret");

    expect(() => joinRound(round, "player-5", "Barbara")).toThrow("up to 4 players");
  });

  it("applies penalty on wrong n-back click", () => {
    const round = makeRound("classic", [
      { kind: "grid", position: 0 },
      { kind: "grid", position: 1 },
      { kind: "grid", position: 2 }
    ]);
    joinRound(round, "player-2", "Grace");
    startRound(round, 0);

    const result = submitMatch(round, "player-1", undefined, 100);

    expect(result.isCorrect).toBe(false);
    expect(round.players.get("player-1")?.errors).toBe(1);
    expect(round.players.get("player-1")?.penalty).toBe(1);
  });

  it("handles go/no-go hits and misses", () => {
    const round = makeRound("go-no-go", [
      { kind: "go-no-go", type: "GO" },
      { kind: "go-no-go", type: "NO_GO" }
    ]);
    joinRound(round, "player-2", "Grace");
    startRound(round, 0);

    const hit = submitMatch(round, "player-1", undefined, 100);
    advanceRoundState(round, 1000);
    advanceRoundState(round, 2000);

    expect(validateGoNoGoResponse({ kind: "go-no-go", type: "GO" }, true)).toBe(true);
    expect(hit.isCorrect).toBe(true);
    expect(round.players.get("player-2")?.metrics.misses).toBe(1);
  });

  it("marks reaction false starts and valid reaction times", () => {
    const round = makeRound("reaction-time", [{ kind: "reaction-time", delayMs: 1200 }]);
    joinRound(round, "player-2", "Grace");
    startRound(round, 0);

    const falseStart = submitMatch(round, "player-1", undefined, 500);
    const valid = submitMatch(round, "player-2", undefined, 1300);

    expect(validateReactionResponse(1200, 500).falseStart).toBe(true);
    expect(falseStart.falseStart).toBe(true);
    expect(valid.reactionTime).toBe(100);
  });

  it("validates stroop answers by color instead of word", () => {
    const round = makeRound("stroop", [{ kind: "stroop", word: "red", color: "blue", congruent: false }]);
    joinRound(round, "player-2", "Grace");
    startRound(round, 0);

    const result = submitMatch(round, "player-1", "blue", 100);

    expect(validateStroopResponse({ kind: "stroop", word: "red", color: "blue", congruent: false }, "blue")).toBe(true);
    expect(result.isCorrect).toBe(true);
  });

  it("supports recent-5 matching", () => {
    const round = makeRound("recent-5", [
      { kind: "grid", position: 0 },
      { kind: "grid", position: 1 },
      { kind: "grid", position: 2 },
      { kind: "grid", position: 3 },
      { kind: "grid", position: 4 },
      { kind: "grid", position: 0 }
    ]);

    expect(isMatchAt(round, 5)).toBe(true);
  });
});
