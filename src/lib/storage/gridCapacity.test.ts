import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { getMeasuredGridCapacity } from "./gridCapacity";
import { STORAGE_KEYS } from "./schema";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("measured grid capacity", () => {
  it("reads the capacity an older build recorded", async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.GRID_CAPACITY]: { cols: 9, rows: 5 },
    });
    expect(await getMeasuredGridCapacity()).toEqual({ cols: 9, rows: 5 });
  });

  it("returns undefined when nothing was ever measured", async () => {
    // Not a substituted default: the migration must be able to tell "no frame
    // on record" apart from a real one, so it can name the bootstrap frame
    // explicitly.
    expect(await getMeasuredGridCapacity()).toBeUndefined();
  });

  it("is read-only — nothing in this build publishes a capacity", async () => {
    // Placement is capacity-free, so there is no writer left to keep in sync.
    // Guards against a future edit quietly reintroducing one.
    const module = await import("./gridCapacity");
    expect(Object.keys(module)).toEqual(["getMeasuredGridCapacity"]);
  });
});
