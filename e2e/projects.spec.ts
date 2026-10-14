import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("projects and tasks", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, "usr_emma", baseURL!);
  });

  test("a manager creates a project and lands on it", async ({ page }) => {
    await page.goto("/w/kinetic/projects/new");
    await page.getByLabel("Project name").fill("Annual report microsite");
    await page.getByLabel("Client", { exact: true }).selectOption({ label: "Pulse Marketing" });
    await page.getByLabel("Due date").fill("2026-12-15");
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page).toHaveURL(/\/w\/kinetic\/projects\/prj_[a-z0-9]+/);
    await expect(page.getByRole("heading", { name: "Annual report microsite" })).toBeVisible();
    await expect(page.getByText("Not shared with client")).toBeVisible();
  });

  test("validation errors are shown inline", async ({ page }) => {
    await page.goto("/w/kinetic/projects/new");
    await page.getByLabel("Project name").fill("ab");
    await page.getByLabel("Start date").fill("2026-12-20");
    await page.getByLabel("Due date").fill("2026-12-01");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText("Use at least 3 characters.")).toBeVisible();
    await expect(page.getByText("The due date must be on or after the start date.")).toBeVisible();
  });

  test("a task is added from the board and opened in the drawer", async ({ page }) => {
    await page.goto("/w/kinetic/projects/prj_mobile/tasks");
    await page.getByRole("button", { name: "New task" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Draft onboarding copy");
    await dialog.getByLabel("Priority").selectOption("high");
    await dialog.getByRole("button", { name: "Add task" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("link", { name: "Draft onboarding copy" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: "Draft onboarding copy" })).toBeVisible();
    await expect(page).toHaveURL(/task=tsk_/);
  });
});
