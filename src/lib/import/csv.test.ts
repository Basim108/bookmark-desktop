import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsv } from "./csv";

describe("escapeCsvField", () => {
  it("passes a plain value through untouched", () => {
    expect(escapeCsvField("Hacker News")).toBe("Hacker News");
  });

  it("serializes undefined as empty", () => {
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("serializes an empty string as empty", () => {
    expect(escapeCsvField("")).toBe("");
  });

  describe("RFC 4180 quoting", () => {
    it("quotes a value containing a comma", () => {
      expect(escapeCsvField("Reading, Writing")).toBe('"Reading, Writing"');
    });

    it("quotes and doubles an embedded double quote", () => {
      expect(escapeCsvField('He said "hi"')).toBe('"He said ""hi"""');
    });

    it("quotes a value containing a newline so the row stays intact", () => {
      expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
    });

    it("quotes a value containing a carriage return", () => {
      // The CR is interior, so this is not formula-shaped — quoted only.
      expect(escapeCsvField("a\rb")).toBe('"a\rb"');
    });
  });

  describe("formula-injection prefixing", () => {
    // Values chosen to contain no quoting trigger, so these isolate the
    // prefix. The prefix-plus-quoting interaction is covered separately below.
    it.each([
      ["=", "=SUM(A1:A9)"],
      ["+", "+1234567890"],
      ["-", "-1+2"],
      ["@", "@SUM(A1:A9)"],
      ["tab", "\tleading tab"],
    ])("prefixes a value starting with %s", (_label, value) => {
      expect(escapeCsvField(value)).toBe(`'${value}`);
    });

    it("prefixes and quotes a real HYPERLINK injection payload", () => {
      expect(escapeCsvField('=HYPERLINK("http://evil","click")')).toBe(
        '"\'=HYPERLINK(""http://evil"",""click"")"',
      );
    });

    it("prefixes a value starting with a carriage return", () => {
      // A leading CR is both formula-shaped and quote-triggering.
      expect(escapeCsvField("\rvalue")).toBe('"\'\rvalue"');
    });

    it("does not prefix a value that merely contains those characters later", () => {
      expect(escapeCsvField("a=b")).toBe("a=b");
    });

    it("applies the prefix before quoting when a value is both formula-shaped and separator-bearing", () => {
      // The prefix must land inside the quotes, not before them, or the file
      // stops parsing as CSV.
      expect(escapeCsvField("=cmd,calc")).toBe('"\'=cmd,calc"');
    });

    it("quotes a prefixed value that also contains a double quote", () => {
      expect(escapeCsvField('=a"b')).toBe('"\'=a""b"');
    });
  });
});

describe("toCsv", () => {
  it("emits the header line first, then one line per row, joined with CRLF", () => {
    const csv = toCsv(
      ["status", "title"],
      [
        ["skipped", "Hacker News"],
        ["warning", "Lobsters"],
      ],
    );
    expect(csv).toBe("status,title\r\nskipped,Hacker News\r\nwarning,Lobsters");
  });

  it("emits only the header when there are no rows", () => {
    expect(toCsv(["status", "title"], [])).toBe("status,title");
  });

  it("escapes every field it writes", () => {
    const csv = toCsv(["status", "title"], [["skipped", '=HYPERLINK("x"),y']]);
    expect(csv).toBe('status,title\r\nskipped,"\'=HYPERLINK(""x""),y"');
  });

  it("escapes header fields too", () => {
    expect(toCsv(["a,b"], [])).toBe('"a,b"');
  });

  it("writes an empty cell for an undefined field", () => {
    const csv = toCsv(["a", "b"], [["x", undefined]]);
    expect(csv).toBe("a,b\r\nx,");
  });
});
