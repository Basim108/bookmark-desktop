import { afterEach, describe, expect, it, vi } from "vitest";
import { withPositionsLock } from "./positionsLock";

const originalLocks = globalThis.navigator?.locks;

function setLocks(value: unknown) {
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setLocks(originalLocks);
});

/** Records interleaving so a lock failure shows up as overlapping sections. */
function makeTracker() {
  const events: string[] = [];
  let active = 0;
  let maxConcurrent = 0;
  async function section(name: string, ms: number) {
    active += 1;
    maxConcurrent = Math.max(maxConcurrent, active);
    events.push(`${name}:enter`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    events.push(`${name}:exit`);
    active -= 1;
  }
  return {
    events,
    section,
    get maxConcurrent() {
      return maxConcurrent;
    },
  };
}

describe("withPositionsLock", () => {
  // jsdom has no Web Locks, so these exercise the in-realm fallback — the path
  // unit tests actually run on. Cross-realm exclusion (page vs service worker)
  // can only be verified in a real browser; see
  // e2e/position-write-concurrency.spec.ts.
  describe("without navigator.locks (jsdom fallback)", () => {
    it("serializes overlapping callers instead of interleaving them", async () => {
      setLocks(undefined);
      const tracker = makeTracker();

      await Promise.all([
        withPositionsLock(() => tracker.section("a", 20)),
        withPositionsLock(() => tracker.section("b", 5)),
        withPositionsLock(() => tracker.section("c", 1)),
      ]);

      expect(tracker.maxConcurrent).toBe(1);
      expect(tracker.events).toEqual([
        "a:enter",
        "a:exit",
        "b:enter",
        "b:exit",
        "c:enter",
        "c:exit",
      ]);
    });

    it("releases the lock when a caller throws, so later callers still run", async () => {
      setLocks(undefined);
      const ran: string[] = [];

      const failing = withPositionsLock(async () => {
        ran.push("failing");
        throw new Error("boom");
      });

      await expect(failing).rejects.toThrow("boom");
      await withPositionsLock(async () => {
        ran.push("after");
      });

      expect(ran).toEqual(["failing", "after"]);
    });

    it("propagates the callback's resolved value", async () => {
      setLocks(undefined);
      await expect(withPositionsLock(async () => 42)).resolves.toBe(42);
    });
  });

  describe("with navigator.locks available", () => {
    it("acquires a single named lock rather than falling back", async () => {
      const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) =>
        fn(),
      );
      setLocks({ request });

      await expect(withPositionsLock(async () => "done")).resolves.toBe("done");

      expect(request).toHaveBeenCalledTimes(1);
      const [name] = request.mock.calls[0] ?? [];
      expect(name).toBe("bookmark-desktop:positions");
    });

    it("uses the same lock name for every caller", async () => {
      const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) =>
        fn(),
      );
      setLocks({ request });

      await withPositionsLock(async () => undefined);
      await withPositionsLock(async () => undefined);

      const names = request.mock.calls.map(([name]) => name);
      expect(new Set(names).size).toBe(1);
    });
  });
});
