import { Link } from "react-router-dom";

import { useViewpointsQuery } from "@/canvas/lib/useViewpoints";
import { listViewpoints } from "@/canvas/viewpoints";

/**
 * /list — plain semantic HTML index of every region, for keyboard and
 * screen-reader users, and anyone who'd rather not navigate a spatial
 * canvas at all (docs/02-canvas-spec.md §9, FR-8.9).
 *
 * Uses useViewpointsQuery()'s own data directly, not the synchronous
 * listViewpoints() snapshot: this component renders before that query
 * resolves (it's fetched asynchronously, same as everywhere else), and
 * unlike an imperative call site (a click handler, a mount effect fired
 * well after load) a React component needs to actually re-render once
 * the real data arrives — listViewpoints() alone would permanently show
 * only the landing/gallery fallback, since nothing re-renders this
 * component when the cache behind it updates. Falls back to the
 * synchronous snapshot only for the brief gap before the query settles.
 */
export default function ListIndex() {
  const { data } = useViewpointsQuery();
  const viewpoints = data ?? listViewpoints();

  return (
    <main className="bg-background text-foreground min-h-screen" style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ALL LIFE — list view</h1>
      <p>A plain list of every region on the board, for keyboard and screen-reader navigation.</p>
      <nav aria-label="Regions">
        <ul>
          {viewpoints.map((viewpoint) => (
            <li key={viewpoint.key}>
              <Link to={`/list/${viewpoint.key}`}>{viewpoint.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <p>
        <Link to="/">Back to the spatial view</Link>
      </p>
    </main>
  );
}
