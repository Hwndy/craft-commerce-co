import { Link, useParams } from "react-router-dom";

import { useViewpointsQuery } from "@/canvas/lib/useViewpoints";
import { listViewpoints } from "@/canvas/viewpoints";
import { useCollagePhotos } from "@/features/collage/lib/useCollagePhotos";
import { useFilm } from "@/features/film/lib/useFilm";
import { useRegionNodes } from "@/features/list/lib/useRegionNodes";

/**
 * /list/:region — plain semantic HTML for one region's content
 * (docs/02-canvas-spec.md §9, FR-8.9). Most canvas_nodes still render
 * generically (node type + id), since no ref_table content for them exists
 * yet; `region-label` nodes are filtered out entirely — they're an
 * internal "nothing published here yet" placeholder (supabase/seed.sql),
 * never real content a list visitor should see. `gallery` and `collage`
 * are real content today, so both get their own section, each using the
 * same data hook the spatial view itself renders from (useFilm(),
 * useCollagePhotos()) rather than duplicating a second query.
 *
 * Reads the viewpoint label from useViewpointsQuery()'s own data, not the
 * synchronous listViewpoints() snapshot — see ListIndex.tsx's comment for
 * why a component needs the reactive query, not a one-off synchronous read.
 */
export default function ListRegion() {
  const { region } = useParams<{ region: string }>();
  const { data: viewpoints } = useViewpointsQuery();
  const viewpoint = region ? (viewpoints ?? listViewpoints()).find((v) => v.key === region) : undefined;
  const { data: nodes } = useRegionNodes(region ?? "");
  const { data: film } = useFilm();
  const { data: photos } = useCollagePhotos();
  const realNodes = (nodes ?? []).filter((node) => node.nodeType !== "region-label");
  const hasAnyContent = realNodes.length > 0 || (region === "gallery" && !!film) || (region === "collage" && !!photos?.length);

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
              <li key={photo.id}>
                {photo.title}
                {photo.takenOn ? ` — ${photo.takenOn}` : ""}
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
