import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingVideo from "./pages/LandingVideo";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// src/features/entry/preload.ts prefetches this chunk during the entry
// sequence (the "Gallery chunk" T6's brief calls for).
const Gallery = lazy(() => import("./pages/Gallery"));

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={null}>
          <FilmStage />
        </Suspense>
        <Routes>
          <Route path="/" element={<LandingVideo />} />
          <Route path="/home" element={<Home />} />
          <Route
            path="/gallery"
            element={
              <Suspense fallback={null}>
                <Gallery />
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
