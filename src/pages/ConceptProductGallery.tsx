import { Link } from "react-router-dom";

import { formatGbp } from "@/components/brand/ProductLabel";
import { siteMediaUrl } from "@/lib/storage";
import { useProducts } from "@/features/shop/lib/useProducts";

/**
 * Client-review concept, not part of the real site (see docs/decisions.md):
 * the client sent an interactive-globe reference site and asked whether its
 * look could carry over to the Shop's product view. This mirrors the
 * reference's own two-step shape — a grid you click into, then one big
 * focused view of whatever you picked — using the real, live catalogue
 * (useProducts(), the same query the Shop room itself renders from) rather
 * than invented placeholder products, so the actual turntable videos
 * already on file show up here. ConceptProductPanel.tsx is the detail
 * side of this pair.
 *
 * Reachable in the real production build on purpose (no DEV guard, same
 * reasoning as E2EShopRoom.tsx), since this only exists to be opened from
 * a Vercel preview link for the owner/client to look at — not linked from
 * anywhere in the real navigation. Remove both pages (and their two
 * App.tsx routes) once that review is done, whichever way it goes.
 */
export default function ConceptProductGallery() {
  const { data: products, isLoading, isError, refetch } = useProducts();

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-5xl">
        <p className="mb-6 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/70">
          Concept preview, not the live Shop — pick any real piece below to see it in the proposed panel
          view.
        </p>

        <h1 className="mb-6 font-heading text-2xl font-bold">All pieces</h1>

        {isLoading && <p className="text-sm text-foreground/60">Loading…</p>}

        {isError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="text-destructive">Couldn't load the catalogue.</p>
            <button
              type="button"
              className="mt-2 rounded-full border border-foreground/20 px-4 py-1.5 text-xs font-semibold"
              onClick={() => refetch()}
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && (products?.length ?? 0) === 0 && (
          <p className="text-sm text-foreground/60">Nothing published yet.</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {products?.map((product) => (
            <Link
              key={product.id}
              to={`/concept/products/${product.slug}`}
              className="group rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 transition-colors hover:border-primary/50"
            >
              <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-foreground/5">
                {product.poster?.renditions["640"] ? (
                  <img
                    src={siteMediaUrl(product.poster.renditions["640"])}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-foreground/30">
                    No image
                  </div>
                )}
              </div>
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="text-sm text-foreground/60">{formatGbp(product.priceAmount, product.priceCurrency)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
