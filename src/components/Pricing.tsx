import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Pricing = () => {
  const plans = [
    {
      name: "Basic",
      price: "R999",
      period: "/month",
      description: "Perfect for small practices getting started",
      features: [
        "Up to 500 patients",
        "Basic appointment scheduling",
        "Digital patient records",
        "Standard billing & invoicing",
        "Email support",
        "Basic reporting"
      ],
      popular: false,
      cta: "Start Free Trial"
    },
    {
      name: "Pro",
      price: "R2,499",
      period: "/month",
      description: "Most popular for growing practices",
      features: [
        "Up to 2,000 patients",
        "Advanced scheduling with automation",
        "Complete EMR/EHR system",
        "Intelligent billing & PMB claims",
        "Telehealth consultations",
        "Digital prescriptions",
        "Advanced analytics",
        "Priority support"
      ],
      popular: true,
      cta: "Start Free Trial"
    },
    {
      name: "Premium",
      price: "R4,999",
      period: "/month",
      description: "Enterprise solution for large practices",
      features: [
        "Unlimited patients",
        "Multi-location support",
        "Advanced telehealth features",
        "Custom integrations",
        "White-label options",
        "Dedicated account manager",
        "24/7 phone support",
        "Custom reporting",
        "API access"
      ],
      popular: false,
      cta: "Get Started"
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-medical-light-blue/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-medical-dark mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-medical-gray max-w-3xl mx-auto">
            Choose the plan that fits your practice size. All plans include our core EMR features 
            and 30-day free trial.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`p-8 border transition-all duration-300 hover:shadow-elevated ${
                plan.popular 
                  ? 'border-medical-blue shadow-card bg-gradient-hero relative transform scale-105' 
                  : 'border-border hover:shadow-card bg-background'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-medical-dark mb-2">{plan.name}</h3>
                <p className="text-medical-gray mb-6">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl lg:text-5xl font-bold text-medical-dark">{plan.price}</span>
                  <span className="text-medical-gray">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-medical-green flex-shrink-0 mt-0.5" />
                    <span className="text-medical-gray">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant={plan.popular ? "hero" : "medical-outline"} 
                size="lg" 
                className="w-full group"
                asChild
              >
                <Link to="/auth">
                  {plan.cta}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-medical-gray mb-4">
            All plans include 30-day free trial • No setup fees • Cancel anytime
          </p>
          <p className="text-sm text-medical-gray">
            Need a custom solution? <a href="mailto:sales@clinithetics.com" className="text-medical-blue hover:underline">Contact our sales team</a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;