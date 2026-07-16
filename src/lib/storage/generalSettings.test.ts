import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  DEFAULT_GENERAL_SETTINGS,
  getGeneralSettings,
  setCanvasBackground,
  setGeneralSettings,
} from "./generalSettings";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("getGeneralSettings", () => {
  it("returns the default (no background) when nothing is stored", async () => {
    expect(await getGeneralSettings()).toEqual(DEFAULT_GENERAL_SETTINGS);
  });
});

describe("setGeneralSettings", () => {
  it("round-trips the full settings object", async () => {
    await setGeneralSettings({
      background: { kind: "upload", fit: "contain" },
    });
    expect(await getGeneralSettings()).toEqual({
      background: { kind: "upload", fit: "contain" },
    });
  });
});

describe("setCanvasBackground", () => {
  it("records an uploaded background with its fit mode", async () => {
    await setCanvasBackground({ kind: "upload", fit: "cover" });
    expect((await getGeneralSettings()).background).toEqual({
      kind: "upload",
      fit: "cover",
    });
  });

  it("clears the background back to none", async () => {
    await setCanvasBackground({ kind: "upload", fit: "center" });
    await setCanvasBackground({ kind: "none" });
    expect((await getGeneralSettings()).background).toEqual({ kind: "none" });
  });
});
