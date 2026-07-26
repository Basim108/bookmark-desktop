import { describe, expect, it } from "vitest";
import { exportFileName, reportFileName } from "./download";

describe("exportFileName", () => {
  it("formats YYYY-MM-DD-HH-mm-bookmark-desktop.json with zero-padding", () => {
    // Local time: 2026-03-05 09:07.
    const date = new Date(2026, 2, 5, 9, 7);
    expect(exportFileName(date)).toBe("2026-03-05-09-07-bookmark-desktop.json");
  });

  it("pads a two-digit month and day", () => {
    const date = new Date(2026, 10, 25, 14, 30);
    expect(exportFileName(date)).toBe("2026-11-25-14-30-bookmark-desktop.json");
  });
});

describe("reportFileName", () => {
  it("strips the extension and appends -report.json", () => {
    expect(reportFileName("2026-03-05-09-07-bookmark-desktop.json")).toBe(
      "2026-03-05-09-07-bookmark-desktop-report.json",
    );
  });

  it("handles a name with multiple dots by stripping only the last segment", () => {
    expect(reportFileName("backup.v2.json")).toBe("backup.v2-report.json");
  });

  it("handles a name without an extension", () => {
    expect(reportFileName("backup")).toBe("backup-report.json");
  });

  it("uses a caller-supplied extension", () => {
    expect(reportFileName("utab-export.json", "log")).toBe(
      "utab-export-report.log",
    );
  });

  it("applies a caller-supplied extension to a dotless name", () => {
    expect(reportFileName("utab-export", "log")).toBe("utab-export-report.log");
  });
});
