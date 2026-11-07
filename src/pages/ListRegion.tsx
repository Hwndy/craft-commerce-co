import { Link, useParams } from "react-router-dom";

import { useViewpointsQuery } from "@/canvas/lib/useViewpoints";
import { listViewpoints } from "@/canvas/viewpoints";
import { useFilm } from "@/features/film/lib/useFilm";
import { useRegionNodes } from "@/features/list/lib/useRegionNodes";

/**
 * /list/:region — plain semantic HTML for one region's content
 * (docs/02-canvas-spec.md §9, FR-8.9). Renders canvas_nodes generically
 * (node type + id) since no ref_table content — photos, products — exists
 * yet (T7/T8 and later phases add it; this view picks it up automatically
 * once it does, no changes needed here). The film is real content today,
 * so the gallery region's list also surfaces it directly via useFilm(),
 * the same hook FilmStage itself uses.
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

      <section aria-label="Content">
        {nodes && nodes.length > 0 ? (
          <ul>
            {nodes.map((node) => (
              <li key={node.id}>{node.nodeType}</li>
            ))}
          </ul>
        ) : (
          <p>Nothing published here yet.</p>
        )}
      </section>

      <p>
        <Link to="/list">Back to all regions</Link>
      </p>
    </main>
  );
}
