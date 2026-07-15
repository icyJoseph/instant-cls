import { test, expect } from "@playwright/test";
import { instant } from "@next/playwright";

// A direct visit to /search is an SSR page load: the whole tree renders from
// the root. The static heading ships in the shell; the results read
// `searchParams`, so they're uncached and stream in behind the skeleton.
test("direct SSR visit: shell heading first, results stream in", async ({
  page,
}) => {
  await page.goto("/search?q=react", { waitUntil: "commit" });

  // Heading is part of the static shell, so it's available immediately.
  await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();

  // Results stream in shortly after.
  await expect(page.getByTestId("result").first()).toBeVisible();
  await expect(page.getByTestId("result")).toHaveCount(12);
});

// FINDING: instant() does NOT freeze a direct (hard) navigation.
//
// The instant() hold-back is a client-side mechanism (it coordinates the Next
// *client* router via a CookieStore change event). A hard page.goto has no
// client router in play when the document request goes out, so the server
// streams the full response and the results are already present inside the
// callback — the grid is NOT held at the shell.
//
// Contrast: the client-navigation freeze in products.spec.ts genuinely holds
// the skeletons (goto('/') -> click -> instant()). To assert an *SSR* page's
// instant shell, reach for the DevTools Navigation Inspector (freeze on
// refresh) rather than the Playwright instant() helper.
test("instant() does not hold a direct visit at the shell (client-nav only)", async ({
  page,
  baseURL,
}) => {
  await instant(
    page,
    async () => {
      await page.goto("/search?q=react");
      await expect(
        page.getByRole("heading", { name: "Search" })
      ).toBeVisible();
      // Despite instant(), the SSR response already streamed the results.
      await expect(page.getByTestId("result")).toHaveCount(12);
    },
    { baseURL }
  );
});
