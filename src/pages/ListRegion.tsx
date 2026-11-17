import { Link, useParams } from "react-router-dom";

import { useViewpointsQuery } from "@/canvas/lib/useViewpoints";
import { listViewpoints } from "@/canvas/viewpoints";
import { formatGbp, STATUS_COPY } from "@/components/brand/ProductLabel";
import { contactIntro } from "@/content/contact";
import { useCollagePhotos } from "@/features/collage/lib/useCollagePhotos";
import { useFilm } from "@/features/film/lib/useFilm";
import { useRegionNodes } from "@/features/list/lib/useRegionNodes";
import { useProductNodes } from "@/features/shop/lib/useProducts";
import { env } from "@/lib/env";

/**
 * /list/:region — plain semantic HTML for one region's content
 * (docs/02-canvas-spec.md §9, FR-8.9). Most canvas_nodes still render
 * generically (node type + id), since no ref_table content for them exists
 * yet; `region-label` nodes are filtered out entirely — they're an
 * internal "nothing published here yet" placeholder (supabase/seed.sql),
 * never real content a list visitor should see. `gallery` and `collage`
 * are real content today, so both get their own section, each using the
 * same data hook the spatial view itself renders from (useFilm(),
 * useCollagePhotos()) rather than duplicating a second query. `contact`
 * (T6) gets its own section too, reading the same static content module
 * (`src/content/contact.ts`) the spatial Contact component renders from
 * — plain text/links here, not the interactive enquiry form (this page
 * is deliberately dependency-free: no Turnstile, no JS-only widgets),
 * same "read-only summary" precedent the Shop section below already
 * sets. `about` had its own section the same way until docs/decisions.md
 * D-71's Step 9 removed the About region outright.
 *
 * Reads the viewpoint label from useViewpointsQuery()'s own data, not the
 * synchronous listViewpoints() snapshot — see ListIndex.tsx's comment for
 * why a component needs the reactive query, not a one-off synchronous read.
 */
const SHOP_REGION_KEYS = new Set(["shop-wall", "shop-floor"]);

export default function ListRegion() {
  const { region } = useParams<{ region: string }>();
  const { data: viewpoints } = useViewpointsQuery();
  const viewpoint = region ? (viewpoints ?? listViewpoints()).find((v) => v.key === region) : undefined;
  const { data: nodes } = useRegionNodes(region ?? "");
  const { data: film } = useFilm();
  const { data: photos } = useCollagePhotos();
  const isShopRegion = !!region && SHOP_REGION_KEYS.has(region);
  const { data: productNodes } = useProductNodes(isShopRegion ? region : "");
  // 'region-label' is always internal; 'product' gets its own section below
  // (real name/price/status, not a bare node-type label) for shop regions.
  const realNodes = (nodes ?? []).filter(
    (node) => node.nodeType !== "region-label" && !(isShopRegion && node.nodeType === "product")
  );
  const hasAnyContent =
    realNodes.length > 0 ||
    (region === "gallery" && !!film) ||
    (region === "collage" && !!photos?.length) ||
    (isShopRegion && !!productNodes?.length) ||
    region === "contact";

  if (!region) return null;

  return (
    <main className="bg-background text-foreground min-h-screen" style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>{viewpoint?.label ?? region}</h1>

      {region === "gallery" && film && (
        <section aria-label="Film">
          <h2>{film.title}</h2>
          <p>
            <a href={`/gallery`}>Watch the film</a>
          </p>
        </section>
      )}

      {region === "collage" && photos && photos.length > 0 && (
        <section aria-label="Photos">
          <ul>
            {photos.map((photo) => (
              // data-photo-id matches PhotoThumbnail.tsx's own convention on
              // the Board — lets anything (e2e specs included) look up a
              // real seeded photo id from this plain, camera/gate-agnostic
              // list instead of the Board's own culled, lock-gated one.
              <li key={photo.id} data-photo-id={photo.id}>
                {photo.title}
                {photo.takenOn ? ` — ${photo.takenOn}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {region === "contact" && (
        <section aria-label="Contact">
          <p>{contactIntro}</p>
          <p>
            {/* Matches the real Contact region's own visible link text
             * (docs/decisions.md D-71, Step 8) — the address itself, not
             * generic copy. */}
            <a href={`mailto:${env.VITE_OWNER_EMAIL}`}>Send us an email at {env.VITE_OWNER_EMAIL}</a>
          </p>
        </section>
      )}

      {isShopRegion && productNodes && productNodes.length > 0 && (
        <section aria-label="Products">
          <ul>
            {productNodes.map(({ nodeId, product }) => (
              <li key={nodeId}>
                {product.name} — {formatGbp(product.priceAmount, product.priceCurrency)} —{" "}
                {STATUS_COPY[product.status]}
                {product.onSale ? " (Sale)" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Content">
        {realNodes.length > 0 ? (
          <ul>
            {realNodes.map((node) => (
              <li key={node.id}>{node.nodeType}</li>
            ))}
          </ul>
        ) : (
          !hasAnyContent && <p>Nothing published here yet.</p>
        )}
      </section>

      <p>
        <Link to="/list">Back to all regions</Link>
      </p>
    </main>
  );
}
