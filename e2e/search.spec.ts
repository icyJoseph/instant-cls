import { test, expect } from "@playwright/test";
import { instant } from "@next/playwright";

// Direct visit (SSR): the whole tree renders from the root. With the instant
// testing API enabled (experimental.exposeTestingApiInProductionBuild), the
// server serves the shell and holds dynamic content back while the lock is
// held — so the results grid is captured at the shell even on a hard load.
test("search is instant on a direct visit", async ({ page, baseURL }) => {
  await instant(
    page,
    async () => {
      await page.goto("/search?q=react");
      await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
      await expect(page.getByTestId("result")).toHaveCount(0); // grid held at the shell
    },
    { baseURL }
  );
});

// After instant() releases, the dynamic results stream in — proving the count
// of 0 above was "held at the shell", not "loaded empty".
test("search results stream in after the shell", async ({ page, baseURL }) => {
  await instant(
    page,
    async () => {
      await page.goto("/search?q=react");
      await expect(page.getByTestId("result")).toHaveCount(0);
    },
    { baseURL }
  );

  await expect(page.getByTestId("result").first()).toBeVisible();
  await expect(page.getByTestId("result")).toHaveCount(12);
});
