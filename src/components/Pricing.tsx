import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Clock, Star, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_PRICING_COUNTRY, PLAN_PRICES, type PlanName } from "@/config/pricing";
import { COUNTRIES, formatMoney, type CountryCode } from "@/lib/locale";

/**
 * A plan feature. Mark anything not yet usable in the product as coming soon,
 * so the pricing never advertises features customers can't use yet.
 */
type Feature = string | { text: string; comingSoon: true };
const soon = (text: string): Feature => ({ text, comingSoon: true });

const Pricing = () => {
  const [country, setCountry] = useState<CountryCode>(DEFAULT_PRICING_COUNTRY);
  const currency = COUNTRIES[country].currency;
  const priceFor = (plan: PlanName) => {
    const amount = PLAN_PRICES[plan][currency];
    return amount === null ? null : formatMoney(amount, currency, { whole: true });
  };

  const plans: {
    name: PlanName;
    period: string;
    description: string;
    features: Feature[];
    popular: boolean;
    cta: string;
  }[] = [
    {
      name: "Basic",
      period: "/month",
      description: "Perfect for small practices getting started",
      features: [
        "Up to 500 patients",
        "Basic appointment scheduling",
        "Digital patient records",
        "Standard billing & invoicing",
        "Email support",
        soon("Basic reporting")
      ],
      popular: false,
      cta: "Start Free Trial"
    },
    {
      name: "Pro",
      period: "/month",
      description: "Most popular for growing practices",
      features: [
        "Up to 2,000 patients",
        soon("Advanced scheduling with automation"),
        "Complete EMR/EHR system",
        soon("Intelligent billing & PMB claims"),
        soon("Telehealth consultations"),
        "Digital prescriptions",
        soon("Advanced analytics"),
        "Priority support"
      ],
      popular: true,
      cta: "Start Free Trial"
    },
    {
      name: "Premium",
      period: "/month",
      description: "Enterprise solution for large practices",
      features: [
        "Unlimited patients",
        "Multiple sites with per-site staff access",
        soon("Advanced telehealth features"),
        soon("Custom integrations"),
        soon("White-label options"),
        "Dedicated account manager",
        "24/7 phone support",
        soon("Custom reporting"),
        soon("API access")
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
          <div role="group" aria-label="Show prices for" className="mt-8 inline-flex rounded-full border border-border bg-background p-1">
            {(Object.keys(COUNTRIES) as CountryCode[]).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={country === code}
                onClick={() => setCountry(code)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  country === code ? "bg-primary text-primary-foreground" : "text-medical-gray hover:text-medical-dark"
                }`}
              >
                {COUNTRIES[code].name} ({COUNTRIES[code].currency})
              </button>
            ))}
          </div>
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
                  {priceFor(plan.name) ? (
                    <>
                      <span className="text-4xl lg:text-5xl font-bold text-medical-dark">{priceFor(plan.name)}</span>
                      <span className="text-medical-gray">{plan.period}</span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-medical-dark">Contact us</span>
                  )}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => {
                  const text = typeof feature === "string" ? feature : feature.text;
                  const comingSoon = typeof feature !== "string";
                  return (
                    <li key={text} className="flex items-start gap-3">
                      {comingSoon ? (
                        <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <Check className="h-5 w-5 text-medical-green flex-shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <span className={comingSoon ? "text-muted-foreground" : "text-medical-gray"}>
                        {text}
                        {comingSoon && (
                          <span className="ml-2 inline-block whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground">
                            Coming soon
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <Button 
                variant={plan.popular ? "hero" : "medical-outline"} 
                size="lg" 
                className="w-full group"
                asChild
              >
                <Link to="/auth?mode=signup&role=doctor">
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
          <p className="text-sm text-medical-gray mb-4">
            Features marked "Coming soon" are in development and not available yet.
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