import { describe, expect, it } from "vitest";
import {
  deleteCanvasBackground,
  getCanvasBackground,
  putCanvasBackground,
} from "./canvasBackground";

describe("canvasBackground", () => {
  it("returns undefined when no background is stored", async () => {
    expect(await getCanvasBackground()).toBeUndefined();
  });

  it("stores and retrieves the background image bytes", async () => {
    await putCanvasBackground(new Blob(["bg-bytes"], { type: "image/jpeg" }));

    const stored = await getCanvasBackground();
    expect(stored).toBeDefined();
    expect(stored?.type).toBe("image/jpeg");
    expect(await stored?.text()).toBe("bg-bytes");
  });

  it("deletes the stored background", async () => {
    await putCanvasBackground(new Blob(["bytes"], { type: "image/png" }));
    await deleteCanvasBackground();
    expect(await getCanvasBackground()).toBeUndefined();
  });
});
