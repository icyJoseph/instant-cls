export type Product = {
  id: string;
  name: string;
  blurb: string;
  price: number;
  /** Tailwind gradient classes used for the (image-less) media block. */
  swatch: string;
  badge: string;
};

// A fixed catalog. Names/blurbs are deliberately varied in length so that a
// broken skeleton (one that doesn't reserve the right space) would shift the
// layout when the real content streams in — that's exactly what the CLS test
// guards against.
export const PRODUCTS: Product[] = [
  {
    id: "aurora-lamp",
    name: "Aurora Desk Lamp",
    blurb: "Warm dimmable LED with a brushed aluminium arm and a weighted base.",
    price: 89,
    swatch: "from-amber-300 to-rose-400",
    badge: "New",
  },
  {
    id: "nimbus-chair",
    name: "Nimbus Ergonomic Chair",
    blurb:
      "Breathable mesh back, adjustable lumbar support, and a five-point aluminium base for all-day comfort.",
    price: 349,
    swatch: "from-sky-300 to-indigo-400",
    badge: "Popular",
  },
  {
    id: "terra-mug",
    name: "Terra Mug",
    blurb: "Hand-glazed stoneware, 350ml.",
    price: 24,
    swatch: "from-orange-300 to-red-400",
    badge: "Sale",
  },
  {
    id: "orbit-speaker",
    name: "Orbit Speaker",
    blurb: "360° sound with 20-hour battery life and IPX7 water resistance.",
    price: 129,
    swatch: "from-violet-300 to-fuchsia-400",
    badge: "New",
  },
  {
    id: "meadow-throw",
    name: "Meadow Wool Throw",
    blurb: "Ethically sourced merino wool in a herringbone weave.",
    price: 76,
    swatch: "from-emerald-300 to-teal-400",
    badge: "Popular",
  },
  {
    id: "pebble-clock",
    name: "Pebble Clock",
    blurb: "Silent sweep movement.",
    price: 42,
    swatch: "from-stone-300 to-zinc-400",
    badge: "Sale",
  },
  {
    id: "cirrus-bottle",
    name: "Cirrus Insulated Bottle",
    blurb: "Keeps drinks cold for 24 hours or hot for 12, double-walled steel.",
    price: 35,
    swatch: "from-cyan-300 to-blue-400",
    badge: "New",
  },
  {
    id: "fable-notebook",
    name: "Fable Notebook",
    blurb: "192 dotted pages, lay-flat binding, and a soft-touch linen cover.",
    price: 19,
    swatch: "from-lime-300 to-green-400",
    badge: "Popular",
  },
  {
    id: "harbor-backpack",
    name: "Harbor Backpack",
    blurb:
      "Roll-top 22L pack with a padded laptop sleeve and weatherproof recycled canvas shell.",
    price: 118,
    swatch: "from-slate-300 to-gray-500",
    badge: "New",
  },
  {
    id: "lumen-candle",
    name: "Lumen Candle",
    blurb: "Cedar & sage, 45-hour burn.",
    price: 28,
    swatch: "from-yellow-300 to-amber-400",
    badge: "Sale",
  },
  {
    id: "vertex-planter",
    name: "Vertex Planter",
    blurb: "Self-watering ceramic planter with a matte finish and drainage reservoir.",
    price: 54,
    swatch: "from-rose-300 to-pink-400",
    badge: "Popular",
  },
  {
    id: "atlas-headphones",
    name: "Atlas Headphones",
    blurb: "Active noise cancelling over-ears with 40-hour playback.",
    price: 199,
    swatch: "from-indigo-300 to-purple-400",
    badge: "New",
  },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates an uncached, per-item data fetch. The staggered delay keeps the
 * skeleton fallbacks on screen long enough to observe (and to stream in one
 * card at a time). This is intentionally NOT wrapped in `use cache` — we want
 * it to stream behind a Suspense boundary so the skeleton is the instant UI.
 */
export async function fetchProduct(id: string): Promise<Product> {
  const index = PRODUCTS.findIndex((p) => p.id === id);
  const product = PRODUCTS[index];
  if (!product) throw new Error(`Unknown product: ${id}`);
  await sleep(500 + index * 90);
  return product;
}

/**
 * Simulates an uncached search that depends on the request (`searchParams`).
 * Because it reads a runtime input and isn't cached, it must live behind a
 * Suspense boundary — which is what lets the results grid be held back at the
 * shell during an instant navigation. Falls back to the full catalog so the
 * demo always has results to stream in.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  await sleep(700);
  const q = query.trim().toLowerCase();
  if (!q) return PRODUCTS;
  const matches = PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q)
  );
  return matches.length > 0 ? matches : PRODUCTS;
}
