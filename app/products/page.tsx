import { Suspense } from "react";
import { PRODUCTS } from "@/lib/products";
import { CardSkeleton, ProductCard } from "./card";

// Opt this route into Cache Components instant-navigation validation. In dev,
// the overlay will flag anything that would block the navigation from showing
// its static shell (the skeleton grid) immediately.
export const instant = true;

export default function ProductsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Products
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Each card streams in behind a shimmer skeleton that reserves its exact
          final size — so nothing shifts when the data lands.
        </p>
      </header>

      {/* The grid + skeletons are static, so they ship in the instant shell.
          Each ProductCard fetches uncached data, so it streams into its own
          Suspense fallback. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PRODUCTS.map((product) => (
          <Suspense key={product.id} fallback={<CardSkeleton />}>
            <ProductCard id={product.id} />
          </Suspense>
        ))}
      </div>
    </main>
  );
}
