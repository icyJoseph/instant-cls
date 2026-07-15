import { fetchProduct } from "@/lib/products";

// Shared frame + sub-element heights. The skeleton and the real card MUST use
// identical dimensions for every block, otherwise the skeleton -> content swap
// moves pixels and spikes Cumulative Layout Shift. Keeping the class strings in
// one place is what keeps the two in sync.
const FRAME =
  "flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10";
const MEDIA = "h-40 w-full rounded-xl";
const TITLE = "h-6"; // one line of text-base/leading-6
const DESC = "h-[3.75rem]"; // three lines of text-sm/leading-5
const FOOTER = "h-6";

const SKELETON = "bg-black/10 dark:bg-white/10";

export function CardSkeleton() {
  return (
    <div className={FRAME} data-testid="card-skeleton" aria-hidden>
      <div className={`${MEDIA} ${SKELETON} shimmer`} />
      <div className={`${TITLE} flex items-center`}>
        <div className={`h-4 w-3/4 rounded ${SKELETON} shimmer`} />
      </div>
      <div className={`${DESC} flex flex-col justify-start gap-2`}>
        <div className={`h-3 w-full rounded ${SKELETON} shimmer`} />
        <div className={`h-3 w-full rounded ${SKELETON} shimmer`} />
        <div className={`h-3 w-2/3 rounded ${SKELETON} shimmer`} />
      </div>
      <div className={`${FOOTER} flex items-center justify-between`}>
        <div className={`h-5 w-16 rounded ${SKELETON} shimmer`} />
        <div className={`h-5 w-12 rounded-full ${SKELETON} shimmer`} />
      </div>
    </div>
  );
}

export async function ProductCard({ id }: { id: string }) {
  const product = await fetchProduct(id);

  return (
    <div className={FRAME} data-testid="product-card">
      <div
        className={`${MEDIA} bg-gradient-to-br ${product.swatch}`}
        role="img"
        aria-label={product.name}
      />
      <h2
        className={`${TITLE} line-clamp-1 text-base font-semibold leading-6 text-black dark:text-zinc-50`}
      >
        {product.name}
      </h2>
      <p
        className={`${DESC} line-clamp-3 text-sm leading-5 text-zinc-600 dark:text-zinc-400`}
      >
        {product.blurb}
      </p>
      <div
        className={`${FOOTER} flex items-center justify-between text-black dark:text-zinc-50`}
      >
        <span className="text-base font-semibold">${product.price}</span>
        <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-medium dark:bg-white/[.08]">
          {product.badge}
        </span>
      </div>
    </div>
  );
}
