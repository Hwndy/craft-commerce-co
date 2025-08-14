import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Facebook, Instagram, Twitter, Mail } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 text-brand flex items-center justify-center font-bold text-xl">
                ⚡
              </div>
              <span className="text-xl font-bold text-foreground">ALL LIFE</span>
            </div>
            <p className="text-muted-foreground mb-6">
              Transforming forgotten rubber into durable, stylish, and eco-friendly fashion accessories.
            </p>
            <div className="flex space-x-4">
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand">
                <Facebook className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand">
                <Instagram className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand">
                <Twitter className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li><a href="#home" className="text-muted-foreground hover:text-brand transition-smooth">Home</a></li>
              <li><a href="#about" className="text-muted-foreground hover:text-brand transition-smooth">About Us</a></li>
              <li><a href="#shop" className="text-muted-foreground hover:text-brand transition-smooth">Shop</a></li>
              <li><a href="#blog" className="text-muted-foreground hover:text-brand transition-smooth">Blog</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-foreground mb-6">Support</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-muted-foreground hover:text-brand transition-smooth">Contact Us</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-brand transition-smooth">FAQ</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-brand transition-smooth">Shipping</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-brand transition-smooth">Returns</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-semibold text-foreground mb-6">Newsletter</h3>
            <p className="text-muted-foreground mb-4">
              Stay updated with our latest products and sustainability stories.
            </p>
            <div className="space-y-3">
              <Input 
                type="email" 
                placeholder="Enter your email" 
                className="bg-background border-border"
              />
              <Button className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
                <Mail className="h-4 w-4 mr-2" />
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-8 text-center">
          <p className="text-muted-foreground">
            © 2024 ALL LIFE. All rights reserved. Crafted with sustainability in mind.
          </p>
        </div>
      </div>
    </footer>
  );
};