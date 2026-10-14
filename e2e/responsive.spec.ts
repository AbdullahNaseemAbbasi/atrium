import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

const PAGES: { user: string; path: string }[] = [
  { user: "usr_alex", path: "/w/kinetic" },
  { user: "usr_alex", path: "/w/kinetic/projects" },
  { user: "usr_alex", path: "/w/kinetic/projects/prj_website/tasks" },
  { user: "usr_alex", path: "/w/kinetic/projects/prj_website/deliverables/dlv_homepage" },
  { user: "usr_alex", path: "/w/kinetic/tasks" },
  { user: "usr_alex", path: "/w/kinetic/clients" },
  { user: "usr_alex", path: "/w/kinetic/team" },
  { user: "usr_alex", path: "/w/kinetic/billing" },
  { user: "usr_alex", path: "/w/kinetic/reports" },
  { user: "usr_alex", path: "/w/kinetic/settings/audit-log" },
  { user: "usr_daniel", path: "/portal/kinetic" },
  { user: "usr_daniel", path: "/portal/kinetic/deliverables/dlv_homepage" },
];

test.describe("mobile layout", () => {
  for (const { user, path } of PAGES) {
    test(`${path} has no sideways scroll`, async ({ context, page, baseURL }) => {
      await signInAs(context, user, baseURL!);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  test("the public landing page fits a phone", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
