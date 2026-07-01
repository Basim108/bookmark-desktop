import { describe, expect, it } from "vitest";
import { createMutex } from "./mutex";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createMutex", () => {
  it("runs overlapping calls one at a time, in call order", async () => {
    const { runExclusive } = createMutex();
    const order: number[] = [];

    const calls = [3, 1, 2].map((ms, callIndex) =>
      runExclusive(async () => {
        order.push(callIndex * 100); // marks entry order
        await delay(ms);
        order.push(callIndex * 100 + 1); // marks exit order
      }),
    );

    await Promise.all(calls);

    // If calls were serialized, each call's exit must precede the next
    // call's entry: [0(enter), 1(exit), 100(enter), 101(exit), 200(enter), 201(exit)]
    expect(order).toEqual([0, 1, 100, 101, 200, 201]);
  });

  it("continues serializing subsequent calls even after one throws", async () => {
    const { runExclusive } = createMutex();
    const order: number[] = [];

    await expect(
      runExclusive(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await runExclusive(async () => {
      order.push(1);
    });

    expect(order).toEqual([1]);
  });
});
