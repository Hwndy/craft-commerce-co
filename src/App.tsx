import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useViewpointsQuery } from "@/canvas/lib/useViewpoints";
import LandingVideo from "./pages/LandingVideo";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// src/features/entry/preload.ts prefetches this chunk during the entry
// sequence (the "Gallery chunk" T6's brief calls for).
const Gallery = lazy(() => import("./pages/Gallery"));

// Plain semantic HTML, no canvas/gestures — lazy mainly for bundle hygiene
// (keeps them out of the initial chunk), not because of a DEV guard.
const ListIndex = lazy(() => import("./pages/ListIndex"));
const ListRegion = lazy(() => import("./pages/ListRegion"));

// Dev-only routes are lazy so their dependencies (hls.js, the canvas
// engine) never enter the initial bundle real visitors download — they
// wouldn't be reachable in production anyway (see the DEV guard below),
// but a static import still gets bundled unless it's code-split like this.
const DevCanvas = lazy(() => import("./pages/DevCanvas"));
const DevFilm = lazy(() => import("./pages/DevFilm"));

// FilmStage (src/features/entry/preload.ts prefetches this chunk during
// the entry sequence) holds the single persistent <video> element the
// gallery film plays in — mounted unconditionally, outside the router, so
// route changes never recreate it (T8 priming, T11 no-remount-on-rotate).
// Lazy because it pulls in hls.js.
const FilmStage = lazy(() =>
  import("@/features/film/FilmStage").then((m) => ({ default: m.FilmStage }))
);

const queryClient = new QueryClient();

// Keeps src/canvas/viewpoints.ts's getViewpoint()/listViewpoints() cache
// fresh from the real `viewpoints` table as soon as the app mounts, same
// spirit as FilmStage being mounted unconditionally at the root. Renders
// nothing — it only needs QueryClientProvider's context.
function ViewpointsBootstrap() {
  useViewpointsQuery();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ViewpointsBootstrap />
        <Suspense fallback={null}>
          <FilmStage />
        </Suspense>
        <Routes>
          <Route path="/" element={<LandingVideo />} />
          <Route path="/home" element={<Home />} />
          {/*
            A single splat route covers both /gallery and T9's
            /gallery/photo/:id deep link, deliberately NOT two separate
            <Route> entries: React Router v6 remounts a component when the
            *matched route* changes, even if both routes render the exact
            same element — which would reset the camera and the film
            layer's reveal()/hide() every time the photo viewer opens or
            closes. A splat keeps this one route match throughout; Gallery
            itself parses the optional "photo/:id" tail from useParams().
          */}
          <Route
            path="/gallery/*"
            element={
              <Suspense fallback={null}>
                <Gallery />
              </Suspense>
            }
          />
          <Route
            path="/list"
            element={
              <Suspense fallback={null}>
                <ListIndex />
              </Suspense>
            }
          />
          <Route
            path="/list/:region"
            element={
              <Suspense fallback={null}>
                <ListRegion />
              </Suspense>
            }
          />
          {import.meta.env.DEV && (
            <>
              <Route
                path="/dev/canvas"
                element={
                  <Suspense fallback={null}>
                    <DevCanvas />
                  </Suspense>
                }
              />
              <Route
                path="/dev/film"
                element={
                  <Suspense fallback={null}>
                    <DevFilm />
                  </Suspense>
                }
              />
            </>
          )}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
