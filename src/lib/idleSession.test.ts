import { describe, expect, it } from "vitest";
import { idleState, IDLE_LIMIT_MS, IDLE_WARN_MS } from "./idleSession";

describe("idleState", () => {
  const now = 10_000_000;
  it("is ok without a record or when recently active", () => {
    expect(idleState(null, now)).toBe("ok");
    expect(idleState(now - 5 * 60_000, now)).toBe("ok");
  });
  it("warns in the last minute and expires at the limit", () => {
    expect(idleState(now - (IDLE_LIMIT_MS - IDLE_WARN_MS), now)).toBe("warn");
    expect(idleState(now - IDLE_LIMIT_MS, now)).toBe("expired");
    expect(idleState(now - 24 * 3600_000, now)).toBe("expired");
  });
});
