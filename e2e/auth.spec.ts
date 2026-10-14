import { expect, test } from "@playwright/test";

test.describe("authentication", () => {
  test("signed-out visitors are sent to sign in and come back afterwards", async ({ page }) => {
    await page.goto("/w/kinetic/projects");
    await expect(page).toHaveURL(/\/login\?next=%2Fw%2Fkinetic%2Fprojects/);
    await page.getByLabel("Work email").fill("emma@kinetic.example");
    await page.getByLabel("Password").fill("atrium-demo");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/w\/kinetic\/projects$/);
    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
  });

  test("a wrong password shows an error and keeps the email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill("alex@kinetic.example");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("That email and password don't match an account.")).toBeVisible();
    await expect(page.getByLabel("Work email")).toHaveValue("alex@kinetic.example");
  });

  test("demo account buttons sign in with the right role", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Agency owner/ }).click();
    await expect(page).toHaveURL(/\/w\/kinetic$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Active projects")).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login\?signedOut=1/);
  });
});
