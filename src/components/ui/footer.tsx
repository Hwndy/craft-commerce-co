import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Facebook, Instagram, Twitter, Mail } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4 sm:mb-6">
              <div className="w-7 h-7 sm:w-8 sm:h-8 text-brand flex items-center justify-center font-bold text-lg sm:text-xl">
                ⚡
              </div>
              <span className="text-lg sm:text-xl font-bold text-foreground">ALL LIFE</span>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base mb-4 sm:mb-6">
              Transforming forgotten rubber into durable, stylish, and eco-friendly fashion accessories.
            </p>
            <div className="flex space-x-3 sm:space-x-4">
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand h-9 w-9">
                <Facebook className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand h-9 w-9">
                <Instagram className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-brand h-9 w-9">
                <Twitter className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 sm:mb-6 text-sm sm:text-base">Quick Links</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li><a href="#home" className="text-muted-foreground hover:text-brand transition-smooth text-sm sm:text-base">Home</a></li>
              <li><a href="#about" className="text-muted-foreground hover:text-brand transition-smooth text-sm sm:text-base">About Us</a></li>
              <li><a href="#shop" className="text-muted-foreground hover:text-brand transition-smooth text-sm sm:text-base">Shop</a></li>
              <li><a href="#blog" className="text-muted-foreground hover:text-brand transition-smooth text-sm sm:text-base">Blog</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 sm:mb-6 text-sm sm:text-base">Support</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li><a href="#" className="text-muted-foreground hover:text-brand transition-smooth text-sm sm:text-base">Contact Us</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-brand transition-smooth text-sm sm:text-base">FAQ</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-brand transition-smooth text-sm sm:text-base">Shipping</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-brand transition-smooth text-sm sm:text-base">Returns</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h3 className="font-semibold text-foreground mb-3 sm:mb-6 text-sm sm:text-base">Newsletter</h3>
            <p className="text-muted-foreground mb-3 sm:mb-4 text-sm sm:text-base">
              Stay updated with our latest products and sustainability stories.
            </p>
            <div className="space-y-2 sm:space-y-3">
              <Input 
                type="email" 
                placeholder="Enter your email" 
                className="bg-background border-border text-sm sm:text-base h-9 sm:h-10"
              />
              <Button className="w-full bg-brand text-brand-foreground hover:bg-brand/90 text-sm sm:text-base py-2 sm:py-3 h-auto">
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 sm:pt-8 text-center">
          <p className="text-muted-foreground text-xs sm:text-sm md:text-base px-4">
            © 2024 ALL LIFE. All rights reserved. Crafted with sustainability in mind.
          </p>
        </div>
      </div>
    </footer>
  );
};