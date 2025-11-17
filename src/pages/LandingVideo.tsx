import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const LandingVideo = () => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        aria-label="ALL LIFE brand introduction video"
      >
        <source src="/videos/all_life_1.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full gap-12"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* ALL LIFE Logo/Text */}
        <div className="text-center">
          <h1 className="text-8xl md:text-9xl font-bold text-white tracking-wider">
            ALL LIFE
          </h1>
        </div>

        {/* Explore Button - appears on hover */}
        <Button
          onClick={() => navigate("/home")}
          className={`
            transition-all duration-500 ease-out
            bg-primary text-black font-semibold text-lg px-12 py-6 h-auto
            hover:scale-110 hover:shadow-[0_0_40px_rgba(250,204,21,0.6)]
            ${isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
        >
          Explore
        </Button>
      </div>
    </div>
  );
};

export default LandingVideo;
