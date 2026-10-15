import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("client approval journey", () => {
  test("a client viewer can comment but not approve", async ({ context, page, baseURL }) => {
    await signInAs(context, "usr_chris", baseURL!);
    await page.goto("/portal/kinetic/deliverables/dlv_homepage");
    await expect(page.getByRole("heading", { name: "Homepage mockup" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve v3/ })).toHaveCount(0);
  });

  test("an approver approves the current version and the team sees it", async ({ browser, baseURL }) => {
    const client = await browser.newContext();
    await signInAs(client, "usr_daniel", baseURL!);
    const portal = await client.newPage();
    await portal.goto("/portal/kinetic/deliverables/dlv_calendar");
    await portal.getByRole("button", { name: "Approve v1" }).click();
    await portal.getByRole("dialog").getByLabel("Note for the team").fill("Approved, thanks.");
    await portal.getByRole("button", { name: "Yes, approve v1" }).click();
    await expect(portal.getByText("Approved").first()).toBeVisible();
    await expect(portal.getByRole("button", { name: "Approve v1" })).toHaveCount(0);
    await client.close();

    const team = await browser.newContext();
    await signInAs(team, "usr_alex", baseURL!);
    const app = await team.newPage();
    await app.goto("/w/kinetic/projects/prj_seo/deliverables/dlv_calendar");
    await expect(app.getByText("Daniel Reed").first()).toBeVisible();
    await expect(app.getByText("Approved, thanks.", { exact: true })).toBeVisible();
    await team.close();
  });
});
