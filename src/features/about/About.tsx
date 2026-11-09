import { Region } from "@/canvas/Region";
import { useFittedPanelSize } from "@/canvas/useFittedPanelSize";
import { Badge } from "@/components/ui/badge";
import { aboutContent } from "@/content/about";

export interface AboutProps {
  centerX: number;
  centerY: number;
}

const MAX_WIDTH = 760;
const MAX_HEIGHT = 760;

/**
 * The About region (T6, FR-6.1) — a dark panel directly on the board, same
 * precedent as Gallery/Collage/Shop: real content lives at its own world
 * position, not behind a modal (there's nothing here that needs "entering"
 * the way the film or a product overlay does). Matches the owner's design
 * mockup (`design_6_about_and_contact.png`) almost exactly; its content
 * (purpose statement, brand-story placeholder, category tags) comes from
 * `src/content/about.ts`, a typed stand-in for Phase 4's `pages` table —
 * see that file's own header for why `brandStory` is deliberately not
 * real copy.
 *
 * Sized via useFittedPanelSize, not a fixed 760×760 — see that hook's own
 * comment: a world-space-fixed panel wider than a narrow mobile viewport
 * leaves itself only partially on screen once the camera centres on it,
 * found via a real CI failure on Contact's own identical pattern (PR #3).
 */
export function About({ centerX, centerY }: AboutProps) {
  const { width, height } = useFittedPanelSize(MAX_WIDTH, MAX_HEIGHT);
  return (
    <Region id="about" title="About" x={centerX - width / 2} y={centerY - height / 2} width={width} height={height}>
      <div
        data-board-scrollable
        className="flex h-full w-full flex-col gap-6 overflow-y-auto rounded-2xl border border-white/10 bg-card p-8 text-foreground"
      >
        <div className="flex items-center gap-4">
          <img
            src="/videos/all_life_poster.jpg"
            alt=""
            className="h-14 w-14 shrink-0 rounded-full border border-primary/50 object-cover"
          />
          <h2 className="font-heading text-3xl font-bold uppercase tracking-wide">About</h2>
        </div>

        <p className="font-heading text-xl font-bold text-primary">{aboutContent.tagline}</p>

        <p className="text-sm leading-relaxed text-muted-foreground">{aboutContent.purpose}</p>

        <div>
          {aboutContent.isBrandStoryPlaceholder && (
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground/50">
              Placeholder — pending the owner's own words
            </p>
          )}
          <p className="text-sm italic text-muted-foreground/70">[{aboutContent.brandStory}]</p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          {aboutContent.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </Region>
  );
}
