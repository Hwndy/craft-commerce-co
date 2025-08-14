import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";

export const TestimonialsSection = () => {
  const testimonials = [
    {
      id: 1,
      name: "Sulaimon Abdulhakeem",
      role: "Eco-conscious Consumer",
      rating: 5,
      comment: "The quality and craftsmanship of these belts is exceptional. I love knowing that I'm wearing something that's both stylish and sustainable.",
      avatar: "/api/placeholder/60/60"
    },
    {
      id: 2,
      name: "Aisha Mohammed",
      role: "Fashion Enthusiast",
      rating: 5,
      comment: "ALL LIFE has completely changed my perspective on sustainable fashion. These belts are not just accessories, they're conversation starters about environmental responsibility.",
      avatar: "/api/placeholder/60/60"
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            What Our Clients Say About Us
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Hear from our satisfied customers who are making a difference with sustainable fashion choices.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="p-8 bg-card border-border card-shadow">
              <div className="flex items-center mb-6">
                <img 
                  src={testimonial.avatar} 
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full mr-4"
                />
                <div>
                  <h4 className="font-semibold text-foreground">{testimonial.name}</h4>
                  <p className="text-muted-foreground text-sm">{testimonial.role}</p>
                </div>
              </div>
              
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-brand fill-current" />
                ))}
              </div>
              
              <blockquote className="text-muted-foreground text-lg italic leading-relaxed">
                "{testimonial.comment}"
              </blockquote>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};