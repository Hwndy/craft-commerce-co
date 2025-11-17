import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, ArrowRight } from "lucide-react";

export const BlogSection = () => {
  const blogPosts = [
    {
      id: 1,
      title: "The Tire Belt Chronicle",
      excerpt: "Follow our journey as we turn forgotten rubber into durable, stylish, and eco-friendly belts.",
      date: "March 15, 2024",
      image: "/api/placeholder/400/250",
      category: "Process"
    },
    {
      id: 2,
      title: "Sustainability in Fashion",
      excerpt: "Exploring how upcycled materials are revolutionizing the fashion industry.",
      date: "March 10, 2024",
      image: "/api/placeholder/400/250",
      category: "Sustainability"
    },
    {
      id: 3,
      title: "Craftsmanship Behind Every Belt",
      excerpt: "Discover the artistry and skill that goes into creating each unique piece.",
      date: "March 5, 2024",
      image: "/api/placeholder/400/250",
      category: "Craftsmanship"
    }
  ];

  return (
    <section id="blog" className="py-12 sm:py-16 md:py-20 bg-card">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            Latest News
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-4">
            Stay updated with our latest stories, behind-the-scenes content, and sustainability insights.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {blogPosts.map((post) => (
            <Card key={post.id} className="group overflow-hidden bg-background border-border card-shadow transition-smooth hover:scale-105">
              <div className="relative overflow-hidden">
                <img 
                  src={post.image} 
                  alt={post.title}
                  className="w-full h-40 sm:h-48 object-cover transition-smooth group-hover:scale-110"
                />
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
                  <span className="bg-brand text-brand-foreground px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                    {post.category}
                  </span>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <div className="flex items-center text-muted-foreground text-xs sm:text-sm mb-2 sm:mb-3">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  {post.date}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3 group-hover:text-brand transition-smooth">
                  {post.title}
                </h3>
                <p className="text-muted-foreground text-sm sm:text-base mb-3 sm:mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
                <Button variant="ghost" className="text-brand hover:text-brand-foreground hover:bg-brand group text-sm sm:text-base px-0">
                  Read More
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-2 transition-smooth group-hover:translate-x-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" variant="outline" className="border-brand text-brand hover:bg-brand hover:text-brand-foreground">
            View More Stories
          </Button>
        </div>
      </div>
    </section>
  );
};