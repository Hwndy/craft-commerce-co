import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background geometric pattern */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <div className="relative">
          {/* Outer circle with radiating lines */}
          <div className="w-96 h-96 border-4 border-brand rounded-full relative animate-glow">
            {/* Radiating lines */}
            {[...Array(24)].map((_, i) => (
              <div
                key={i}
                className="absolute w-16 h-0.5 bg-brand origin-left"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${i * 15}deg) translateX(192px)`,
                }}
              />
            ))}
            
            {/* Inner overlapping circles */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-32 h-32 border-4 border-brand rounded-full"></div>
              <div className="w-32 h-32 border-4 border-brand rounded-full absolute top-8 left-8"></div>
              
              {/* Central A symbol */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl font-bold text-brand">
                A
              </div>
            </div>
          </div>
          
          {/* Text around circle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-foreground text-sm tracking-widest transform rotate-0 absolute -top-20">
              ALL LIFE
            </div>
            <div className="text-foreground text-sm tracking-widest transform rotate-180 absolute -bottom-20">
              ALL LIFE
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        <h1 className="text-6xl md:text-8xl font-bold mb-8 text-foreground">
          ALL LIFE
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          Transforming forgotten rubber into durable, stylish, and eco-friendly fashion
        </p>
        <Button size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90 brand-shadow">
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