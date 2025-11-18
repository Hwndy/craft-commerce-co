import { useNavigate } from "react-router-dom";
import { useRef, useEffect } from "react";

const LandingVideo = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Maximum autoplay reliability (iOS, Android, desktop)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const play = () => video.play().catch(() => {});
    play();
    video.addEventListener("loadeddata", play);
    video.addEventListener("canplay", play);

    return () => {
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", play);
    };
  }, []);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black cursor-pointer"
      onClick={() => navigate("/home")}
      role="button"
      tabIndex={0}
      aria-label="Enter ALL LIFE"
    >
      {/* Perfect full-screen video – never cropped, always centered */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/videos/all_life_poster.jpg"
        className="fixed inset-0 w-full h-full object-contain object-center bg-black"
        style={{
          maxWidth: "100vw",
          maxHeight: "100vh",
          width: "auto",
          height: "auto",
          minWidth: "100vw",
          minHeight: "100vh",
        }}
        aria-hidden="true"
      >
        <source src="/videos/all_life_1.webm" type="video/webm" />
        <source src="/videos/all_life_1.mp4" type="video/mp4" />
        Your browser does not support video.
      </video>

      {/* Very subtle overlay for depth (optional – remove if you want pure video) */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      {/* Invisible clickable overlay + subtle hint on mobile */}
      <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none">
        <p className="text-white/50 text-sm tracking-widest font-light animate-pulse md:hidden">
          TAP TO ENTER
        </p>
      </div>
    </div>
  );
};

export default LandingVideo;