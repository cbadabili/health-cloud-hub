import { Card } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const Testimonials = () => {
  const testimonials = [
    {
      name: "Dr. Sarah Chen",
      role: "Family Medicine",
      location: "Cape Town, SA",
      content: "Clinithetics has transformed our practice. The integrated billing and EMR system saves us hours every day, and our patients love the telehealth features.",
      rating: 5,
      avatar: "SC"
    },
    {
      name: "Dr. Michael Rodriguez",
      role: "Internal Medicine",
      location: "Johannesburg, SA",
      content: "The PMB claims processing is seamless. What used to take our team weeks now happens automatically. The ROI was immediate.",
      rating: 5,
      avatar: "MR"
    },
    {
      name: "Lisa Thompson",
      role: "Practice Manager",
      location: "Durban, SA",
      content: "As a practice manager, I appreciate how everything is connected. Scheduling, billing, patient records - it all works together perfectly.",
      rating: 5,
      avatar: "LT"
    },
    {
      name: "Dr. Priya Patel",
      role: "Pediatrics",
      location: "Pretoria, SA",
      content: "The security features give us complete peace of mind. HIPAA compliance is built-in, and the audit trails are comprehensive.",
      rating: 5,
      avatar: "PP"
    },
    {
      name: "James Wilson",
      role: "Patient",
      location: "Cape Town, SA",
      content: "Booking appointments online is so convenient, and the telehealth consultations work flawlessly. Much better than the old phone system.",
      rating: 5,
      avatar: "JW"
    },
    {
      name: "Dr. Ahmed Hassan",
      role: "Cardiology",
      location: "Port Elizabeth, SA",
      content: "The analytics dashboard helps me understand my practice better. Patient flow, revenue trends - everything I need at a glance.",
      rating: 5,
      avatar: "AH"
    }
  ];

  return (
    <section id="testimonials" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-medical-dark mb-6">
            Trusted by Healthcare Professionals
          </h2>
          <p className="text-xl text-medical-gray max-w-3xl mx-auto">
            Join thousands of doctors and practices who have transformed their operations with Clinithetics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="p-6 border border-border hover:shadow-card transition-all duration-300 bg-gradient-card">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  {testimonial.avatar}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-medical-dark">{testimonial.name}</h4>
                  <p className="text-sm text-medical-gray">{testimonial.role}</p>
                  <p className="text-xs text-medical-gray/80">{testimonial.location}</p>
                </div>
                <Quote className="h-6 w-6 text-medical-blue/40" />
              </div>
              
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              
              <p className="text-medical-gray leading-relaxed">
                "{testimonial.content}"
              </p>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-4 bg-medical-light-green px-8 py-4 rounded-full">
            <div className="flex -space-x-2">
              {testimonials.slice(0, 4).map((testimonial, index) => (
                <div key={index} className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-semibold border-2 border-background">
                  {testimonial.avatar}
                </div>
              ))}
            </div>
            <div className="text-medical-dark">
              <span className="font-semibold">10,000+</span> healthcare professionals trust Clinithetics
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;