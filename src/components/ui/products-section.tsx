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
    <section id="shop" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Our Exclusive Collection
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Discover our range of handcrafted belts made from upcycled tire materials, 
            designed for durability and style.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {products.map((product) => (
            <Card key={product.id} className="group overflow-hidden bg-card border-border card-shadow transition-smooth hover:scale-105">
              <div className="relative overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-64 object-cover transition-smooth group-hover:scale-110"
                />
                <Badge className="absolute top-4 left-4 bg-brand text-brand-foreground">
                  {product.badge}
                </Badge>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-smooth">
                  <Button size="icon" variant="secondary" className="h-8 w-8">
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {product.name}
                </h3>
                <p className="text-2xl font-bold text-brand mb-4">
                  {product.price}
                </p>
                <Button className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
                  <ShoppingCart className="h-4 w-4 mr-2" />
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