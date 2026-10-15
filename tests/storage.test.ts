import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sniffAvatar } from "@/lib/storage/avatars";
import { signClaims, verifyClaims } from "@/lib/storage/signed-urls";
import { claimUpload, issueUpload, uploadKey } from "@/lib/storage/uploads";

// These run against the memory backend: no Supabase keys, no network.
beforeEach(() => {
  vi.stubEnv("ATRIUM_BACKEND", "memory");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("signed claims", () => {
  it("round-trips and rejects tampering", () => {
    const token = signClaims({ objectId: "fil_1", userId: "usr_alex" }, 60);
    expect(verifyClaims<{ objectId: string }>(token)?.objectId).toBe("fil_1");

    const [body, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ objectId: "fil_2", userId: "usr_alex", exp: 9_999_999_999 })).toString("base64url");
    expect(verifyClaims(`${forged}.${signature}`)).toBeNull();
    expect(verifyClaims(`${body}.${signature}x`)).toBeNull();
    expect(verifyClaims("not-a-token")).toBeNull();
  });

  it("expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
    const token = signClaims({ objectId: "fil_1" }, 60);
    vi.setSystemTime(new Date("2026-10-15T12:02:00Z"));
    expect(verifyClaims(token)).toBeNull();
  });
});

describe("upload tickets", () => {
  const expected = { orgId: "org_kinetic", projectId: "prj_seo", userId: "usr_alex", fileName: "brief.pdf", sizeBytes: 2048, mimeType: "application/pdf" };

  async function ticketFor(overrides: Partial<typeof expected> = {}) {
    const claims = { ...expected, ...overrides };
    const storageKey = uploadKey(claims.orgId, claims.projectId, "files");
    const issued = await issueUpload({ ...claims, storageKey });
    return { storageKey, ...issued };
  }

  function form(ticket?: string) {
    const data = new FormData();
    if (ticket) data.set("uploadTicket", ticket);
    return data;
  }

  it("keys objects under the organization and project", () => {
    expect(uploadKey("org_kinetic", "prj_seo", "deliverables")).toMatch(/^org\/org_kinetic\/projects\/prj_seo\/deliverables\/[0-9a-f-]{36}$/);
  });

  it("needs no storage URL in memory mode", async () => {
    const issued = await ticketFor();
    expect(issued.uploadUrl).toBeNull();
  });

  it("accepts the matching ticket and keeps its storage key", async () => {
    const { ticket, storageKey } = await ticketFor();
    const claimed = await claimUpload(form(ticket), expected, "files");
    expect(claimed).toEqual({ ok: true, storageKey, hasPreview: false });
  });

  it("rejects a ticket issued for another workspace, project, person or file", async () => {
    for (const other of [{ orgId: "org_lumen" }, { projectId: "prj_website" }, { userId: "usr_liam" }, { fileName: "other.pdf" }, { sizeBytes: 1 }]) {
      const { ticket } = await ticketFor(other);
      const claimed = await claimUpload(form(ticket), expected, "files");
      expect(claimed.ok, JSON.stringify(other)).toBe(false);
    }
  });

  it("rejects a forged ticket", async () => {
    const claimed = await claimUpload(form("abc.def"), expected, "files");
    expect(claimed.ok).toBe(false);
  });

  it("lets direct calls without a ticket through in memory mode only", async () => {
    const claimed = await claimUpload(form(), expected, "deliverables");
    expect(claimed.ok && claimed.storageKey.startsWith("org/org_kinetic/projects/prj_seo/deliverables/")).toBe(true);
  });
});

describe("avatar type sniffing", () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
  const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffAvatar(bytes(0xff, 0xd8, 0xff, 0xe0))?.type).toBe("image/jpeg");
    expect(sniffAvatar(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))?.type).toBe("image/png");
    expect(sniffAvatar(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))?.type).toBe("image/webp");
  });

  it("rejects anything else, whatever the file name says", () => {
    expect(sniffAvatar(bytes(...ascii("GIF89a")))).toBeNull();
    expect(sniffAvatar(bytes(...ascii("<svg xmlns")))).toBeNull();
    expect(sniffAvatar(bytes(...ascii("<html>")))).toBeNull();
  });
});
