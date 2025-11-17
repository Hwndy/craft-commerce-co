import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background geometric pattern */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 sm:opacity-20">
        <div className="relative scale-50 sm:scale-75 md:scale-100">
          {/* Outer circle with radiating lines */}
          <div className="w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 border-2 sm:border-4 border-brand rounded-full relative animate-glow">
            {/* Radiating lines */}
            {[...Array(24)].map((_, i) => (
              <div
                key={i}
                className="absolute w-12 sm:w-16 h-0.5 bg-brand origin-left hidden sm:block"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${i * 15}deg) translateX(${i % 2 === 0 ? '128px' : '160px'})`,
                }}
              />
            ))}
            
            {/* Inner overlapping circles */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-24 sm:w-32 h-24 sm:h-32 border-2 sm:border-4 border-brand rounded-full"></div>
              <div className="w-24 sm:w-32 h-24 sm:h-32 border-2 sm:border-4 border-brand rounded-full absolute top-6 sm:top-8 left-6 sm:left-8"></div>
              
              {/* Central A symbol */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl sm:text-5xl md:text-6xl font-bold text-brand">
                A
              </div>
            </div>
          </div>
          
          {/* Text around circle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-foreground text-xs sm:text-sm tracking-widest transform rotate-0 absolute -top-16 sm:-top-20">
              ALL LIFE
            </div>
            <div className="text-foreground text-xs sm:text-sm tracking-widest transform rotate-180 absolute -bottom-16 sm:-bottom-20">
              ALL LIFE
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 sm:px-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold mb-6 sm:mb-8 text-foreground">
          ALL LIFE
        </h1>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto px-4">
          Transforming forgotten rubber into durable, stylish, and eco-friendly fashion
        </p>
        <Button size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90 brand-shadow text-sm sm:text-base px-6 sm:px-8 py-4 sm:py-6 h-auto">
          Explore
        </Button>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <ArrowDown className="h-6 w-6 text-brand" />
      </div>
    </section>
  );
};