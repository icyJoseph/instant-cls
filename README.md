# Prevent CLS regression

A small, self-contained demo of building **skeleton/shimmer loading states that don't shift the layout**, and locking that in with end-to-end tests — on **Next.js 16 Cache Components**.

It shows three things working together:

1. **Cache Components streaming** — a product grid whose skeletons render instantly in the static shell, then stream in real content.
2. **`instant()` e2e assertions** — using the `@next/playwright` helper to assert on the *instant UI* (the skeletons) separately from the streamed-in content.
3. **A CLS regression guard** — a Playwright test that measures [Cumulative Layout Shift](https://web.dev/articles/cls) across the skeleton→content transition and fails if it exceeds a threshold.

> Built against `next@16.3.0-preview.6` / React 19.2. Package manager is **pnpm** (an `npm install` will crash on this tree).

## Requirements

- Node.js 20.9+
- pnpm 10+
- Chromium for Playwright (`pnpm exec playwright install chromium`)

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:3000  → visit /products
```

Production build (what the tests run against):

```bash
pnpm build
pnpm start
```

## Running the tests

```bash
pnpm test:e2e       # headless
pnpm test:e2e:ui    # Playwright UI mode
```

Playwright's `webServer` runs `pnpm build && pnpm start` automatically — instant navigation (prefetching + the static shell) only behaves like production under `next start`, not in `next dev`.

## How it works

### The static shell + streaming

`cacheComponents: true` in [`next.config.ts`](./next.config.ts) turns on the streaming model. On [`/products`](./app/products/page.tsx), the grid container and the skeletons are static, so they ship in the **instant shell**. Each card fetches uncached data inside its own `<Suspense>` boundary, so it **streams in** behind a skeleton fallback:

```tsx
{PRODUCTS.map((product) => (
  <Suspense key={product.id} fallback={<CardSkeleton />}>
    <ProductCard id={product.id} />
  </Suspense>
))}
```

`next build` reports `/products` as `◐ (Partial Prerender)` — static HTML with dynamic server-streamed content.

### The CLS-safe skeleton contract

The whole point: **a skeleton must reserve the exact space its real content will occupy.** In [`app/products/card.tsx`](./app/products/card.tsx), `CardSkeleton` and `ProductCard` share the same fixed sub-element heights (media `h-40`, title `h-6`, description `h-[3.75rem]`, footer `h-6`). When a card swaps in, nothing moves — a correct build measures **CLS = 0**.

The shimmer animates `transform` only (composited off the main thread), so the animation itself never contributes to layout shift. It also respects `prefers-reduced-motion`.

### Testing the instant UI with `instant()`

The `@next/playwright` `instant()` helper holds dynamic content back while its callback runs, so you can assert on the shell and the streamed content separately ([`e2e/products.spec.ts`](./e2e/products.spec.ts)):

```ts
import { instant } from "@next/playwright";

await instant(page, async () => {
  await page.getByRole("link", { name: "Browse products" }).click();
  // Only the static shell is visible here:
  await expect(page.getByTestId("card-skeleton")).toHaveCount(12);
  await expect(page.getByTestId("product-card")).toHaveCount(0);
});
// After instant() exits, dynamic content streams in:
await expect(page.getByTestId("product-card")).toHaveCount(12);
```

### Measuring skeleton CLS with `instant()`

This is the key idea. Rather than racing the stream on a page load, the CLS test uses `instant()` to **freeze the navigation at the skeleton state**, zeroes the CLS counter at that exact frozen layout, then **releases and measures the shift** as real content replaces the skeletons. The shift is therefore attributed deterministically to the skeleton→content swap — which is the thing we actually want to guard.

A `layout-shift` `PerformanceObserver` is installed via `page.addInitScript` (so it's live before first paint) and accumulates every non-input shift into `window.__cls`:

```ts
// Observer installed once, before any navigation:
await page.addInitScript(() => {
  window.__cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) window.__cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
});

await page.goto("/");

await instant(page, async () => {
  await page.getByRole("link", { name: "Browse products" }).click();
  // Frozen at the skeleton grid — no real cards yet:
  await expect(page.getByTestId("card-skeleton")).toHaveCount(12);
  await expect(page.getByTestId("product-card")).toHaveCount(0);
  // Baseline the counter at the frozen skeleton layout:
  await page.evaluate(() => { window.__cls = 0; });
});

// instant() released → content streams in, replacing skeletons:
await expect(page.getByTestId("product-card")).toHaveCount(12);
await page.waitForTimeout(500); // let shifts settle
expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
```

Two things that make this work:

- **It must be a client navigation.** `instant()` holds back dynamic content for soft (prefetched) navigations; it does **not** freeze a hard `page.goto('/products')` — there the server just streams the whole response and the skeletons are gone before you can assert on them. So the measurement goes `goto('/')` → click → `instant()`.
- **`hadRecentInput` isn't a problem here.** Shifts within 500ms of a user input are excluded from CLS. Because `instant()` defers streaming until the callback returns (and the data has an artificial delay), the skeleton→content shift lands well after the click, so it's still counted.

> Installing the observer via `addInitScript` + baselining inside the frozen callback is deliberately more robust than observing *after* load or resolving on the first observer callback — both of which stop counting shifts too early.

### `instant()` freezes client navigations, not direct visits

`instant()`'s hold-back is a **client-side** mechanism — it coordinates the Next *client* router (via a `CookieStore` change event) to defer rendering the streamed content. So it freezes **soft/client navigations** (`goto('/')` → click), which is what the products CLS test relies on.

It does **not** freeze a **direct/SSR visit**. On a hard `page.goto('/search?q=react')` there's no client router yet when the document request goes out, so the server streams the whole response (shell **and** results) and the grid is already populated inside the callback. The `/search` route ([`app/search/page.tsx`](./app/search/page.tsx)) and [`e2e/search.spec.ts`](./e2e/search.spec.ts) demonstrate this: the "does not hold a direct visit" test asserts the results are present despite `instant()`. To inspect an SSR page's instant shell, use the DevTools **Navigation Inspector** ("freeze on refresh") rather than the Playwright helper.

## Notes on the 0.1 threshold

The test asserts `< 0.1`, the Core Web Vitals "good" bar. Two things are worth knowing if you adapt this:

- **A correct build measures exactly `0`.** Because cards stream in *staggered, per-card*, each shift is small and localized — so `< 0.1` confirms CWV compliance but is a *loose* guard against skeleton mis-sizing. If you want the test to catch sizing regressions specifically, tighten toward `< 0.02` (there's headroom above the `0` baseline).
- **CLS scoring is viewport-relative.** A *taller* viewport produces a *lower* score for the same shift, so don't "fix" a failing CLS test by enlarging the viewport — that just hides the shift.

## Layout

```
app/
  page.tsx              Home — links to /products
  products/
    page.tsx            Grid of <Suspense> cards; `export const instant = true`
    card.tsx            CardSkeleton + async ProductCard (shared fixed heights)
  search/
    page.tsx            SSR page reading searchParams; results behind Suspense
    results.tsx         SearchResults + ResultsSkeleton
  globals.css           Shimmer keyframes (transform-only)
lib/
  products.ts           Fake catalog + delayed fetchProduct() / searchProducts()
e2e/
  products.spec.ts      instant() skeleton test + instant()-driven CLS test
  search.spec.ts        SSR direct-visit streaming + instant() SSR limitation
playwright.config.ts    webServer runs build+start; Chromium project
next.config.ts          cacheComponents: true
```

## Further reading

The version-accurate docs ship inside the package at `node_modules/next/dist/docs/` — see `01-app/02-guides/instant-navigation.md` and `01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md`.
