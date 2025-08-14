import { Button } from "@/components/ui/button";
import { ShoppingBag, User, Search } from "lucide-react";

export const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 text-brand flex items-center justify-center font-bold text-xl">
              ⚡
            </div>
            <span className="text-xl font-bold text-foreground">ALL LIFE</span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#home" className="text-foreground hover:text-brand transition-smooth">
              HOME
            </a>
            <a href="#project" className="text-foreground hover:text-brand transition-smooth">
              PROJECT
            </a>
            <a href="#about" className="text-foreground hover:text-brand transition-smooth">
              ABOUT
            </a>
            <a href="#shop" className="text-foreground hover:text-brand transition-smooth">
              SHOP
            </a>
            <a href="#blog" className="text-foreground hover:text-brand transition-smooth">
              BLOG
            </a>
            <a href="#contact" className="text-foreground hover:text-brand transition-smooth">
              CONTACT
            </a>
          </div>

          {/* Action Icons */}
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="text-foreground hover:text-brand">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-foreground hover:text-brand">
              <User className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-foreground hover:text-brand">
              <ShoppingBag className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};