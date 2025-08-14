import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Recycle, Leaf, Heart } from "lucide-react";

export const AboutSection = () => {
  return (
    <section id="about" className="py-20 bg-card">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Image placeholder */}
          <div className="relative">
            <div className="aspect-video bg-muted rounded-lg card-shadow overflow-hidden">
              <img 
                src="/api/placeholder/600/400" 
                alt="Tire belt manufacturing process"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="mb-8">
              <h3 className="text-brand text-sm font-semibold tracking-wider uppercase mb-2">
                WHO WE ARE
              </h3>
              <h2 className="text-4xl font-bold text-foreground mb-6">
                Our Story
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                ALL LIFE is an endeavour to really honour a world-wide experience of life. Dating this short launch of time we have on earth, our promotion is to experience the miracle and to have a taste expression and the meaning of our destiny.
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                We came from a wider perspective not over then the standard one to think as being spiritual, and the objective is to see the growth and development of our environment awareness around life.
              </p>
              <Button variant="outline" className="border-brand text-brand hover:bg-brand hover:text-brand-foreground">
                Learn More
              </Button>
            </div>
          </div>
        </div>

        {/* Values Section */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-foreground mb-16">
            Our Values
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center bg-card border-border card-shadow">
              <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Recycle className="h-8 w-8 text-brand" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Sustainability
              </h3>
              <p className="text-muted-foreground">
                Transforming waste materials into beautiful, functional products that help reduce environmental impact.
              </p>
            </Card>

            <Card className="p-8 text-center bg-card border-border card-shadow">
              <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Leaf className="h-8 w-8 text-brand" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Innovation
              </h3>
              <p className="text-muted-foreground">
                Constantly exploring new ways to upcycle materials and create unique, high-quality fashion accessories.
              </p>
            </Card>

            <Card className="p-8 text-center bg-card border-border card-shadow">
              <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="h-8 w-8 text-brand" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Purpose
              </h3>
              <p className="text-muted-foreground">
                Every product tells a story of transformation, giving new life to materials that would otherwise be waste.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};