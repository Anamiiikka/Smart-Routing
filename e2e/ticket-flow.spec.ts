import { test, expect } from "@playwright/test";

const PASSWORD = "Password123!";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|tickets)/);
}

test("requester can submit a ticket and see it", async ({ page }) => {
  await login(page, "requester@example.com");

  await page.goto("/tickets/new");
  const title = `E2E test ticket ${Date.now()}`;
  await page.fill('input[name="title"]', title);
  await page.fill(
    'textarea[name="description"]',
    "This is an automated end-to-end test ticket describing a problem.",
  );
  await page.click('button[type="submit"]');

  // Redirects to the ticket detail page.
  await page.waitForURL(/\/tickets\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("manager can view the dashboard with system health", async ({ page }) => {
  await login(page, "manager@example.com");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("System health")).toBeVisible();
});

test("requester is redirected away from the dashboard", async ({ page }) => {
  await login(page, "requester@example.com");
  await page.goto("/dashboard");
  // requireAction redirects requesters to /tickets.
  await page.waitForURL(/\/tickets$/);
});
