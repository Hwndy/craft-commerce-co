import { test, expect } from "@playwright/test";

test("landing page loads and shows the entry control", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Enter ALL LIFE" })).toBeVisible();
});
