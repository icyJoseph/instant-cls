import { test, expect, type Page } from "@playwright/test";
import { instant } from "@next/playwright";

import { PRODUCTS } from "../lib/products";

const CARD_COUNT = PRODUCTS.length;

/**
 * Installs a `layout-shift` PerformanceObserver as an init script so it is
 * present before the very first paint on the next navigation, and accumulates
 * every non-input-driven shift into `window.__cls`. This is more robust than
 * observing inside `page.evaluate` after load (which can miss early shifts) or
 * resolving on the first observer callback (which stops counting too soon).
 */
async function trackCLS(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // `LayoutShift` isn't in the default DOM lib types.
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) {
          (window as unknown as { __cls: number }).__cls += shift.value;
        }
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  });
}

async function readCLS(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

/** Zeroes the accumulator so measurement starts from the current layout. */
async function baselineCLS(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __cls: number }).__cls = 0;
  });
}

test.describe("Products page skeletons", () => {
  test("skeletons are the instant UI, then real cards stream in", async ({
    page,
  }) => {
    await page.goto("/");

    // Inside instant(), dynamic content is held back — only the prefetched
    // static shell (the skeleton grid) is visible.
    await instant(page, async () => {
      await page.getByRole("link", { name: "Browse products" }).click();

      await expect(page.getByTestId("card-skeleton").first()).toBeVisible();
      await expect(page.getByTestId("card-skeleton")).toHaveCount(CARD_COUNT);
      // Real cards have not streamed in yet.
      await expect(page.getByTestId("product-card")).toHaveCount(0);
    });

    // After instant() exits, dynamic content streams in and the skeletons are
    // replaced by real cards.
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByTestId("product-card")).toHaveCount(CARD_COUNT);
    await expect(page.getByTestId("card-skeleton")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: PRODUCTS[0].name })
    ).toBeVisible();
  });

  test("skeleton -> content transition keeps CLS under 0.1", async ({
    page,
    baseURL,
  }) => {
    await trackCLS(page);

    // instant() freezes the visit at its instant UI (the skeleton grid) and
    // holds dynamic content back until the callback returns. That lets us
    // baseline the CLS counter at the exact frozen skeleton layout, so we
    // measure the shift caused *only* by real content replacing skeletons —
    // deterministically, rather than racing the stream. The lock works on a
    // direct visit because exposeTestingApiInProductionBuild is enabled.
    await instant(
      page,
      async () => {
        await page.goto("/products");

        // Frozen at the instant UI: skeletons only, no real cards yet.
        await expect(page.getByTestId("card-skeleton")).toHaveCount(CARD_COUNT);
        await expect(page.getByTestId("product-card")).toHaveCount(0);

        // Baseline the counter at the frozen skeleton layout so CLS is
        // attributed to the skeleton -> content swap and nothing before it.
        await baselineCLS(page);
      },
      { baseURL }
    );

    // instant() released the lock: dynamic content now streams into the shell,
    // replacing each skeleton with its real card.
    await expect(page.getByTestId("product-card")).toHaveCount(CARD_COUNT);
    await expect(page.getByTestId("card-skeleton")).toHaveCount(0);
    // Let any late shifts settle before reading the accumulated value.
    await page.waitForTimeout(500);

    const cls = await readCLS(page);
    console.log(`Skeleton -> content CLS: ${cls}`);
    expect(cls).toBeLessThan(0.1);
  });
});
