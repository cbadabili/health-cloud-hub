import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ClipboardList, Stethoscope, User } from "lucide-react";

const audiences = [
  {
    icon: Stethoscope,
    title: "Doctors",
    summary: "Spend less time on admin and more time with patients.",
    points: [
      "Daily schedule and appointment management",
      "Patient records and consultation notes",
      "Digital prescriptions",
      "Video consultations with built-in notes",
    ],
    iconBg: "bg-medical-light-blue",
    iconColor: "text-medical-blue",
  },
  {
    icon: User,
    title: "Patients",
    summary: "A simple portal for everything about their care.",
    points: [
      "Book and manage appointments online",
      "View visit records and prescriptions",
      "See and pay invoices",
      "Join telehealth sessions from any device",
    ],
    iconBg: "bg-medical-light-green",
    iconColor: "text-medical-green",
  },
  {
    icon: ClipboardList,
    title: "Practice managers",
    summary: "One view of the practice's people, billing and claims.",
    points: [
      "Manage staff and patient accounts",
      "Track payments and doctor payouts",
      "Monitor PMB claims",
      "Role-based access for every user",
    ],
    iconBg: "bg-medical-light-blue",
    iconColor: "text-medical-blue",
  },
];

const WhoItsFor = () => {
  return (
    <section id="who-its-for" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-medical-dark mb-6">
            Built for Everyone in the Practice
          </h2>
          <p className="text-xl text-medical-gray max-w-3xl mx-auto">
            Each person gets a dashboard designed around the work they actually do.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {audiences.map((audience) => (
            <Card
              key={audience.title}
              className="p-6 border border-border hover:shadow-card transition-all duration-300 bg-gradient-card"
            >
              <div className={`inline-flex p-3 rounded-xl mb-4 ${audience.iconBg}`}>
                <audience.icon className={`h-6 w-6 ${audience.iconColor}`} />
              </div>
              <h3 className="text-xl font-semibold text-medical-dark mb-2">{audience.title}</h3>
              <p className="text-medical-gray mb-5">{audience.summary}</p>
              <ul className="space-y-3">
                {audience.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-medical-dark">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-medical-green" />
                    {point}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="hero" size="lg" className="group" asChild>
            <Link to="/auth?mode=signup&role=doctor">
              Try it with your practice
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default WhoItsFor;
