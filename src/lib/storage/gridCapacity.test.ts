import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  getMeasuredGridCapacity,
  setMeasuredGridCapacity,
} from "./gridCapacity";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("measured grid capacity", () => {
  it("round-trips a measured capacity", async () => {
    await setMeasuredGridCapacity({ cols: 9, rows: 5 });
    expect(await getMeasuredGridCapacity()).toEqual({ cols: 9, rows: 5 });
  });

  it("returns undefined when nothing has ever been measured", async () => {
    // Not a substituted default: the caller must be able to tell "no page has
    // measured yet" apart from a real measurement, so it can name the
    // bootstrap capacity explicitly.
    expect(await getMeasuredGridCapacity()).toBeUndefined();
  });

  it("keeps the most recent measurement when pages disagree", async () => {
    await setMeasuredGridCapacity({ cols: 9, rows: 5 });
    await setMeasuredGridCapacity({ cols: 4, rows: 3 });
    expect(await getMeasuredGridCapacity()).toEqual({ cols: 4, rows: 3 });
  });
});
