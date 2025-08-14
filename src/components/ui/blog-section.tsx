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
    <section id="blog" className="py-20 bg-card">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Latest News
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Stay updated with our latest stories, behind-the-scenes content, and sustainability insights.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {blogPosts.map((post) => (
            <Card key={post.id} className="group overflow-hidden bg-background border-border card-shadow transition-smooth hover:scale-105">
              <div className="relative overflow-hidden">
                <img 
                  src={post.image} 
                  alt={post.title}
                  className="w-full h-48 object-cover transition-smooth group-hover:scale-110"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-brand text-brand-foreground px-3 py-1 rounded-full text-sm font-medium">
                    {post.category}
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-center text-muted-foreground text-sm mb-3">
                  <Calendar className="h-4 w-4 mr-2" />
                  {post.date}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-brand transition-smooth">
                  {post.title}
                </h3>
                <p className="text-muted-foreground mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
                <Button variant="ghost" className="text-brand hover:text-brand-foreground hover:bg-brand group">
                  Read More
                  <ArrowRight className="h-4 w-4 ml-2 transition-smooth group-hover:translate-x-1" />
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