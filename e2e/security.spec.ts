import { expect, test } from "@playwright/test";
import { expectNotFound, signInAs } from "./helpers";

/**
 * IDOR/BOLA checks through the real UI: guessing ids or URLs must never
 * reveal another tenant's or another client's data.
 */
test.describe("tenant and role boundaries", () => {
  test("a team owner cannot open another workspace's project through their own workspace", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_alex", baseURL!);
    await page.goto("/w/kinetic/projects/prj_orbit");
    await expectNotFound(page);
    await expect(page.getByText("Orbit Onboarding Flow")).toHaveCount(0);
  });

  test("a user with no membership gets a 404 for the workspace", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_maya", baseURL!);
    await page.goto("/w/kinetic");
    await expectNotFound(page);
  });

  test("a client user is redirected from the team app to their portal", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_daniel", baseURL!);
    await page.goto("/w/kinetic/projects");
    await expect(page).toHaveURL(/\/portal\/kinetic/);
  });

  test("a client cannot open another client's deliverable, a draft or an unshared project", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_daniel", baseURL!);
    for (const path of [
      "/portal/kinetic/deliverables/dlv_screens",
      "/portal/kinetic/deliverables/dlv_templates",
      "/portal/kinetic/projects/prj_meridian",
    ]) {
      await page.goto(path);
      await expectNotFound(page);
    }
  });

  test("internal comments never reach the client portal", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_daniel", baseURL!);
    await page.goto("/portal/kinetic/deliverables/dlv_homepage");
    await expect(page.getByText("Keep the testimonial carousel static")).toHaveCount(0);
    await expect(page.getByText("Is the mobile menu final?")).toBeVisible();
  });

  test("a team member cannot reach manager-only screens", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_liam", baseURL!);
    await page.goto("/w/kinetic/projects/prj_ecom/settings");
    await expectNotFound(page);
    await page.goto("/w/kinetic/projects/prj_meridian/settings");
    await expectNotFound(page);
  });

  test("a billing manager sees no project data", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_olivia", baseURL!);
    await page.goto("/w/kinetic/projects/prj_website");
    await expectNotFound(page);
  });

  test("platform operations are hidden from workspace owners", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_alex", baseURL!);
    await page.goto("/admin");
    await expectNotFound(page);
  });

  test("expired or forged download links are rejected", async ({ request }) => {
    const response = await request.get("/api/files/download?token=forged.token");
    expect(response.status()).toBe(410);
  });
});
