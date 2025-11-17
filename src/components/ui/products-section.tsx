import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Heart } from "lucide-react";

export const ProductsSection = () => {
  const products = [
    {
      id: 1,
      name: "Classic Tire Belt",
      price: "₦ 75,000",
      image: "/api/placeholder/300/300",
      badge: "Bestseller"
    },
    {
      id: 2,
      name: "Premium Tire Belt",
      price: "₦ 95,000",
      image: "/api/placeholder/300/300",
      badge: "Premium"
    },
    {
      id: 3,
      name: "Luxury Tire Belt",
      price: "₦ 125,000",
      image: "/api/placeholder/300/300",
      badge: "Limited"
    }
  ];

  return (
    <section id="shop" className="py-12 sm:py-16 md:py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            Our Exclusive Collection
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-4">
            Discover our range of handcrafted belts made from upcycled tire materials, 
            designed for durability and style.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {products.map((product) => (
            <Card key={product.id} className="group overflow-hidden bg-card border-border card-shadow transition-smooth hover:scale-105">
              <div className="relative overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-48 sm:h-56 md:h-64 object-cover transition-smooth group-hover:scale-110"
                />
                <Badge className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-brand text-brand-foreground text-xs">
                  {product.badge}
                </Badge>
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-smooth">
                  <Button size="icon" variant="secondary" className="h-7 w-7 sm:h-8 sm:w-8">
                    <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                  {product.name}
                </h3>
                <p className="text-xl sm:text-2xl font-bold text-brand mb-3 sm:mb-4">
                  {product.price}
                </p>
                <Button className="w-full bg-brand text-brand-foreground hover:bg-brand/90 text-sm sm:text-base py-2 sm:py-3 h-auto">
                  <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" variant="outline" className="border-brand text-brand hover:bg-brand hover:text-brand-foreground">
            Explore All Products
          </Button>
        </div>
      </div>
    </section>
  );
};