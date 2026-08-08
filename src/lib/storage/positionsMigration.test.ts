import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { getAllPositions } from "./positions";
import { ensurePositionsMigrated } from "./positionsMigration";
import { POSITIONS_SCHEMA_SLOTS, STORAGE_KEYS } from "./schema";
import { paginate } from "../grid/layout";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

/** Records the frame an old build last measured, as that build would have. */
async function seedMeasuredCapacity(capacity: {
  cols: number;
  rows: number;
}): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.GRID_CAPACITY]: capacity });
}

/** Seeds the pre-slot `(page, row, col)` shape directly, as an old build left it. */
async function seedLegacyPositions(
  positions: Record<
    string,
    Record<string, { page: number; row: number; col: number }>
  >,
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.POSITIONS]: positions });
}

describe("ensurePositionsMigrated", () => {
  it("converts stored cells to slots against the last measured capacity", async () => {
    await seedMeasuredCapacity({ cols: 6, rows: 3 });
    await seedLegacyPositions({
      f1: {
        a: { page: 0, row: 0, col: 0 },
        b: { page: 0, row: 0, col: 1 },
        pinned: { page: 0, row: 2, col: 5 },
        later: { page: 1, row: 0, col: 0 },
      },
    });

    await ensurePositionsMigrated();

    expect(await getAllPositions()).toEqual({
      f1: { a: 0, b: 1, pinned: 17, later: 18 },
    });
  });

  it("reproduces the layout the earlier version displayed at that capacity", async () => {
    const frame = { cols: 6, rows: 3 };
    const legacy = {
      a: { page: 0, row: 0, col: 0 },
      b: { page: 0, row: 0, col: 1 },
      pinned: { page: 0, row: 2, col: 5 },
    };
    await seedMeasuredCapacity(frame);
    await seedLegacyPositions({ f1: legacy });

    await ensurePositionsMigrated();
    const pages = paginate((await getAllPositions()).f1 ?? {}, frame);

    // Every bookmark renders in exactly the cell it was stored at.
    for (const [bookmarkId, cell] of Object.entries(legacy)) {
      const entry = pages[cell.page]?.find((e) => e.bookmarkId === bookmarkId);
      expect(entry?.cell).toEqual(cell);
    }
  });

  it("falls back to the bootstrap frame when no capacity was ever measured", async () => {
    await seedLegacyPositions({
      f1: { a: { page: 0, row: 1, col: 0 } },
    });

    await ensurePositionsMigrated();

    // Bootstrap frame is 6x4, so row 1 col 0 is slot 6.
    expect(await getAllPositions()).toEqual({ f1: { a: 6 } });
  });

  it("records the schema marker so the conversion is not repeated", async () => {
    await seedMeasuredCapacity({ cols: 6, rows: 3 });
    await seedLegacyPositions({ f1: { a: { page: 0, row: 2, col: 5 } } });

    await ensurePositionsMigrated();

    const stored = await chrome.storage.local.get(
      STORAGE_KEYS.POSITIONS_SCHEMA,
    );
    expect(stored[STORAGE_KEYS.POSITIONS_SCHEMA]).toBe(POSITIONS_SCHEMA_SLOTS);
  });

  it("is idempotent: a second run does not re-convert already-converted slots", async () => {
    await seedMeasuredCapacity({ cols: 6, rows: 3 });
    await seedLegacyPositions({ f1: { a: { page: 0, row: 2, col: 5 } } });

    await ensurePositionsMigrated();
    const afterFirst = await getAllPositions();

    // A different window size measured in between must not re-frame anything.
    await seedMeasuredCapacity({ cols: 4, rows: 2 });
    await ensurePositionsMigrated();

    expect(await getAllPositions()).toEqual(afterFirst);
  });

  it("converts once when two contexts migrate concurrently", async () => {
    await seedMeasuredCapacity({ cols: 6, rows: 3 });
    await seedLegacyPositions({ f1: { a: { page: 0, row: 2, col: 5 } } });

    await Promise.all([ensurePositionsMigrated(), ensurePositionsMigrated()]);

    expect(await getAllPositions()).toEqual({ f1: { a: 17 } });
  });

  it("leaves an already-slotted store alone", async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.POSITIONS]: { f1: { a: 17 } },
      [STORAGE_KEYS.POSITIONS_SCHEMA]: POSITIONS_SCHEMA_SLOTS,
    });

    await ensurePositionsMigrated();

    expect(await getAllPositions()).toEqual({ f1: { a: 17 } });
  });

  it("does nothing surprising to an empty store", async () => {
    await ensurePositionsMigrated();
    expect(await getAllPositions()).toEqual({});
  });
});

describe("reading a store that has not been migrated yet", () => {
  it("normalizes cells to slots in memory so a racing read still sees slots", async () => {
    await seedMeasuredCapacity({ cols: 6, rows: 3 });
    await seedLegacyPositions({ f1: { a: { page: 0, row: 2, col: 5 } } });

    // No ensurePositionsMigrated() call: this is a read that beat the migration.
    expect(await getAllPositions()).toEqual({ f1: { a: 17 } });
  });
});
