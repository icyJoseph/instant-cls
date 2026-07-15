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

Playwright's `webServer` runs `pnpm build && pnpm start` automatically — instant navigation (prefetching + the static shell) only behaves like production under `next start`, not in `next dev`. Because we test a production build, [`next.config.ts`](./next.config.ts) sets `experimental.exposeTestingApiInProductionBuild: true` so the `instant()` lock isn't stripped from the bundle (see [below](#instant-works-on-direct-visits-too--if-the-testing-api-is-enabled)).

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

Both entry paths are covered by a shared `freezeAndMeasureCLS` helper, because they produce different initial UI (see [the Next.js docs](node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md)):

- **Direct / SSR first visit** — `arrive` is `page.goto('/products')`; the whole tree renders from the root.
- **Client navigation** — `arrive` is a `<Link>` click; only the tree below the shared layout re-renders.

Each asserts the shell is skeletons-only, baselines CLS there, releases, and asserts `< 0.1`.

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

await instant(page, async () => {
  await page.goto("/products");
  // Frozen at the skeleton grid — no real cards yet:
  await expect(page.getByTestId("card-skeleton")).toHaveCount(12);
  await expect(page.getByTestId("product-card")).toHaveCount(0);
  // Baseline the counter at the frozen skeleton layout:
  await page.evaluate(() => { window.__cls = 0; });
}, { baseURL });

// instant() released → content streams in, replacing skeletons:
await expect(page.getByTestId("product-card")).toHaveCount(12);
await page.waitForTimeout(500); // let shifts settle
expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
```

> Installing the observer via `addInitScript` + baselining inside the frozen callback is deliberately more robust than observing *after* load or resolving on the first observer callback — both of which stop counting shifts too early. Because the measurement is a direct visit (no click), `hadRecentInput` never excludes the shift.

### `instant()` works on direct visits too — if the testing API is enabled

`instant()`'s hold-back is normally stripped from **production** bundles: `next build` aliases the navigation-lock module to an inert stub, so `instant()` becomes a no-op and can't freeze anything (see `create-compiler-aliases.ts` in the `next` package). It's active in `next dev`, and in a production build **only** when you opt in:

```ts
// next.config.ts
const nextConfig = {
  cacheComponents: true,
  experimental: { exposeTestingApiInProductionBuild: true },
};
```

With the API enabled, `instant()` freezes **both** client navigations *and* direct/SSR visits — the server serves the shell and holds dynamic content back while the lock is held (the MPA-capture path keys off a `self.__next_instant_test` flag). The `/search` route ([`app/search/page.tsx`](./app/search/page.tsx)) proves this: [`e2e/search.spec.ts`](./e2e/search.spec.ts) does `instant(() => page.goto('/search?q=react'))` and asserts the results grid is held at `count 0`, then streams in afterwards.

> Without the flag, a hard `page.goto` inside `instant()` looks like it "doesn't freeze" — but that's the disabled stub, not a client-vs-SSR limitation. Since this repo runs its e2e suite against `next build && next start`, the flag is set in [`next.config.ts`](./next.config.ts).

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
  products.spec.ts      instant() shell + CLS on SSR first-land AND client nav
  search.spec.ts        instant() freezing a direct/SSR visit at the shell
playwright.config.ts    webServer runs build+start; Chromium project
next.config.ts          cacheComponents: true
```

## Further reading

The version-accurate docs ship inside the package at `node_modules/next/dist/docs/` — see `01-app/02-guides/instant-navigation.md` and `01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md`.
