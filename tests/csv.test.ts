import { describe, expect, it } from "vitest";
import { escapeCsvCell, fileSlug, toCsv } from "@/lib/export/csv";

describe("CSV escaping", () => {
  it("leaves plain values alone", () => {
    expect(escapeCsvCell("Alex Carter")).toBe("Alex Carter");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and line breaks (RFC 4180)", () => {
    expect(escapeCsvCell("Acme, Inc.")).toBe('"Acme, Inc."');
    expect(escapeCsvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(escapeCsvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(escapeCsvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])("neutralises cells starting with %j so spreadsheets don't run them", (trigger) => {
    const cell = escapeCsvCell(`${trigger}HYPERLINK("http://evil.example")`);
    expect(cell.replace(/^"/, "").startsWith(`'${trigger}`)).toBe(true);
  });

  it("combines formula protection with quoting", () => {
    expect(escapeCsvCell('=cmd|" /C calc"!A0')).toBe(`"'=cmd|"" /C calc""!A0"`);
    expect(escapeCsvCell("-2+3,4")).toBe(`"'-2+3,4"`);
  });

  it("writes a BOM, CRLF rows and escapes every cell including the header", () => {
    const csv = toCsv(["Name", "Note"], [["Ann", "=1+1"], ["Bo, Jr.", "ok"]]);
    expect(csv).toBe("﻿Name,Note\r\nAnn,'=1+1\r\n\"Bo, Jr.\",ok\r\n");
  });

  it("builds safe file names", () => {
    expect(fileSlug("Kinetic Studio / Q4 ")).toBe("kinetic-studio-q4");
    expect(fileSlug("../../etc")).toBe("etc");
    expect(fileSlug("")).toBe("export");
  });
});
