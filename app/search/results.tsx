import { searchProducts } from "@/lib/products";

type SearchParams = PageProps<"/search">["searchParams"];

// Same CLS-safe idea as the products grid: skeleton and result share fixed
// heights so streaming in the results doesn't shift the layout.
const RESULT = "flex items-center gap-4 rounded-xl border border-black/10 p-3 dark:border-white/10";
const THUMB = "h-14 w-14 shrink-0 rounded-lg";

export function ResultsSkeleton() {
  return (
    <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className={RESULT} data-testid="result-skeleton" aria-hidden>
          <div className={`${THUMB} bg-black/10 shimmer dark:bg-white/10`} />
          <div className="flex-1">
            <div className="h-4 w-2/3 rounded bg-black/10 shimmer dark:bg-white/10" />
            <div className="mt-2 h-3 w-16 rounded bg-black/10 shimmer dark:bg-white/10" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export async function SearchResults({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const results = await searchProducts(q);

  return (
    <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {results.map((p) => (
        <li key={p.id} className={RESULT} data-testid="result">
          <div className={`${THUMB} bg-gradient-to-br ${p.swatch}`} />
          <div className="flex-1">
            <p className="h-4 truncate font-medium leading-4 text-black dark:text-zinc-50">
              {p.name}
            </p>
            <p className="mt-2 h-3 text-sm leading-3 text-zinc-600 dark:text-zinc-400">
              ${p.price}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
