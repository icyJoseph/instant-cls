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

/**
 * Drives one full skeleton -> content transition and returns the CLS attributed
 * to it. `arrive` performs the navigation (a direct visit or a client-side
 * click) from *inside* the instant() lock.
 *
 * instant() freezes the arrival at its instant UI (the skeleton grid) and holds
 * dynamic content back until the callback returns. While frozen we assert the
 * shell is skeletons-only, then baseline the CLS counter at that exact layout —
 * so the number we read afterwards is the shift caused *only* by real cards
 * replacing skeletons, measured deterministically rather than by racing the
 * stream. The lock is available in this production build because
 * `experimental.exposeTestingApiInProductionBuild` is enabled.
 */
async function freezeAndMeasureCLS(
  page: Page,
  baseURL: string | undefined,
  arrive: () => Promise<void>
): Promise<number> {
  await instant(
    page,
    async () => {
      await arrive();

      // Frozen at the instant UI: the skeleton grid, no real cards yet.
      await expect(page.getByTestId("card-skeleton")).toHaveCount(CARD_COUNT);
      await expect(page.getByTestId("product-card")).toHaveCount(0);

      // Baseline the counter at the frozen skeleton layout.
      await page.evaluate(() => {
        (window as unknown as { __cls: number }).__cls = 0;
      });
    },
    { baseURL }
  );

  // Lock released: dynamic content streams in, replacing each skeleton.
  await expect(page.getByTestId("product-card")).toHaveCount(CARD_COUNT);
  await expect(page.getByTestId("card-skeleton")).toHaveCount(0);
  // Let any late shifts settle before reading the accumulated value.
  await page.waitForTimeout(500);

  return readCLS(page);
}

test.describe("Products skeletons: instant shell + CLS", () => {
  // First land: a direct visit renders the whole tree from the root (SSR). The
  // skeleton grid is the static shell; real cards stream into it.
  test("direct/SSR visit lands on the skeleton shell with CLS < 0.1", async ({
    page,
    baseURL,
  }) => {
    await trackCLS(page);

    const cls = await freezeAndMeasureCLS(page, baseURL, async () => {
      await page.goto("/products");
    });

    console.log(`SSR skeleton -> content CLS: ${cls}`);
    expect(cls).toBeLessThan(0.1);
    await expect(
      page.getByRole("heading", { name: PRODUCTS[0].name })
    ).toBeVisible();
  });

  // Client navigation: only the tree below the shared layout re-renders. The
  // prefetched skeleton shell shows instantly on click, then cards stream in.
  test("client navigation lands on the skeleton shell with CLS < 0.1", async ({
    page,
    baseURL,
  }) => {
    await trackCLS(page);
    await page.goto("/");

    const cls = await freezeAndMeasureCLS(page, baseURL, async () => {
      await page.getByRole("link", { name: "Browse products" }).click();
    });

    console.log(`client-nav skeleton -> content CLS: ${cls}`);
    expect(cls).toBeLessThan(0.1);
    await expect(
      page.getByRole("heading", { name: PRODUCTS[0].name })
    ).toBeVisible();
  });
});
