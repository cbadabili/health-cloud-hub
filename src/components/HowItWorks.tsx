import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Settings, Stethoscope, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const HowItWorks = () => {
  const steps = [
    {
      step: "01",
      icon: UserPlus,
      title: "Quick Setup",
      description: "Create your account and set up your practice profile in minutes. Our onboarding process guides you through every step.",
      color: "bg-medical-light-blue",
      iconColor: "text-medical-blue"
    },
    {
      step: "02",
      icon: Settings,
      title: "Configure & Customize",
      description: "Tailor the platform to your practice needs. Set up appointment types, billing preferences, and user permissions.",
      color: "bg-medical-light-green",
      iconColor: "text-medical-green"
    },
    {
      step: "03",
      icon: Stethoscope,
      title: "Start Practicing",
      description: "Begin managing patients, scheduling appointments, and processing bills. Your complete EMR solution is ready to use.",
      color: "bg-medical-light-blue",
      iconColor: "text-medical-blue"
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-medical-light-blue/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-medical-dark mb-6">
            Get Started in 3 Simple Steps
          </h2>
          <p className="text-xl text-medical-gray max-w-3xl mx-auto">
            Our streamlined onboarding process gets your practice up and running quickly, 
            so you can focus on what matters most - patient care.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <Card className="p-8 text-center border border-border hover:shadow-card transition-all duration-300 bg-background">
                <div className="mb-6">
                  <div className="text-4xl font-bold text-medical-blue/20 mb-4">
                    {step.step}
                  </div>
                  <div className={`p-4 ${step.color} rounded-2xl w-fit mx-auto`}>
                    <step.icon className={`h-8 w-8 ${step.iconColor}`} />
                  </div>
                </div>
                <h3 className="text-2xl font-semibold text-medical-dark mb-4">
                  {step.title}
                </h3>
                <p className="text-medical-gray leading-relaxed">
                  {step.description}
                </p>
              </Card>
              
              {/* Arrow connector for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                  <ArrowRight className="h-8 w-8 text-medical-blue/40" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button variant="hero" size="xl" className="group" asChild>
            <Link to="/auth">
              Start Your Free Trial
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <p className="text-sm text-medical-gray mt-4">
            No credit card required • 30-day free trial • Setup assistance included
          </p>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;