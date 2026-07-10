import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  getSidebarWidth,
  setSidebarWidth,
} from "./sidebarSettings";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("getSidebarWidth", () => {
  it("returns the default width when nothing is stored", async () => {
    expect(await getSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
  });

  it("returns the stored width when set", async () => {
    await setSidebarWidth(300);
    expect(await getSidebarWidth()).toBe(300);
  });

  it("clamps a stored width below the minimum when read", async () => {
    await setSidebarWidth(10);
    expect(await getSidebarWidth()).toBe(MIN_SIDEBAR_WIDTH);
  });
});

describe("setSidebarWidth", () => {
  it("clamps to the minimum width before storing", async () => {
    await setSidebarWidth(-100);
    expect(await getSidebarWidth()).toBe(MIN_SIDEBAR_WIDTH);
  });
});
