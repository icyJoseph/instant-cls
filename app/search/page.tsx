import { Suspense } from "react";
import { ResultsSkeleton, SearchResults } from "./results";

export const instant = true;

// A direct visit renders this whole tree from the root. The heading is static
// so it lands in the shell immediately; the results read `searchParams` (a
// runtime input) and are uncached, so they suspend and stream in behind the
// skeleton fallback.
export default function SearchPage(props: PageProps<"/search">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Search
      </h1>
      <Suspense fallback={<ResultsSkeleton />}>
        <SearchResults searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
