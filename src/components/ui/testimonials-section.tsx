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
    <section className="py-12 sm:py-16 md:py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            What Our Clients Say About Us
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-4">
            Hear from our satisfied customers who are making a difference with sustainable fashion choices.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="p-6 sm:p-8 bg-card border-border card-shadow">
              <div className="flex items-center mb-4 sm:mb-6">
                <img 
                  src={testimonial.avatar} 
                  alt={testimonial.name}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full mr-3 sm:mr-4"
                />
                <div>
                  <h4 className="font-semibold text-foreground text-sm sm:text-base">{testimonial.name}</h4>
                  <p className="text-muted-foreground text-xs sm:text-sm">{testimonial.role}</p>
                </div>
              </div>
              
              <div className="flex items-center mb-3 sm:mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 sm:h-5 sm:w-5 text-brand fill-current" />
                ))}
              </div>
              
              <blockquote className="text-muted-foreground text-sm sm:text-base md:text-lg italic leading-relaxed">
                "{testimonial.comment}"
              </blockquote>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};