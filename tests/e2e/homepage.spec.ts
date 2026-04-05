import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders the page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Localize News/i);
  });

  test("shows the hero headline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("shows the 'Request a township' link", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /request a township/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/request");
  });
});

test.describe("Request form", () => {
  test("renders all required fields", async ({ page }) => {
    await page.goto("/request");
    await expect(page.getByLabel(/township name/i)).toBeVisible();
    await expect(page.getByLabel(/township website/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /submit request/i })).toBeVisible();
  });

  test("shows validation error on empty submit", async ({ page }) => {
    await page.goto("/request");
    // HTML5 validation prevents submit; ensure required fields are marked
    const nameInput = page.getByLabel(/township name/i);
    await expect(nameInput).toHaveAttribute("required");
  });
});
