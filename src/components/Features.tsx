import { Card } from "@/components/ui/card";
import { 
  Calendar, 
  FileText, 
  CreditCard, 
  Video, 
  Shield, 
  Clock,
  Users,
  Pill,
  BarChart3
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Automated appointment booking with conflict detection and patient reminders.",
      color: "bg-medical-light-blue",
      iconColor: "text-medical-blue"
    },
    {
      icon: FileText,
      title: "Complete EMR/EHR",
      description: "Digital patient records with real-time updates and seamless data integration.",
      color: "bg-medical-light-green",
      iconColor: "text-medical-green"
    },
    {
      icon: CreditCard,
      title: "Intelligent Billing",
      description: "Automated invoicing with PMB claims processing and payment tracking.",
      color: "bg-medical-light-blue",
      iconColor: "text-medical-blue"
    },
    {
      icon: Video,
      title: "Telehealth Platform",
      description: "Secure video consultations with integrated note-taking and prescriptions.",
      color: "bg-medical-light-green",
      iconColor: "text-medical-green"
    },
    {
      icon: Pill,
      title: "Digital Prescriptions",
      description: "Create and send secure digital prescriptions directly to patients.",
      color: "bg-medical-light-blue",
      iconColor: "text-medical-blue"
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Comprehensive practice insights with revenue and performance analytics.",
      color: "bg-medical-light-green",
      iconColor: "text-medical-green"
    },
    {
      icon: Shield,
      title: "HIPAA Compliance",
      description: "Bank-level security with encrypted data and audit trails.",
      color: "bg-medical-light-blue",
      iconColor: "text-medical-blue"
    },
    {
      icon: Users,
      title: "Multi-Role Access",
      description: "Separate dashboards for doctors, patients, and administrators.",
      color: "bg-medical-light-green",
      iconColor: "text-medical-green"
    },
    {
      icon: Clock,
      title: "24/7 Support",
      description: "Round-the-clock technical support and system monitoring.",
      color: "bg-medical-light-blue",
      iconColor: "text-medical-blue"
    }
  ];

  return (
    <section id="features" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-medical-dark mb-6">
            Everything You Need in One Platform
          </h2>
          <p className="text-xl text-medical-gray max-w-3xl mx-auto">
            Comprehensive healthcare management tools designed to streamline your practice 
            and enhance patient care.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="p-6 border border-border hover:shadow-card transition-all duration-300 hover:transform hover:scale-105 bg-gradient-card"
            >
              <div className={`p-3 ${feature.color} rounded-xl w-fit mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
              </div>
              <h3 className="text-xl font-semibold text-medical-dark mb-3">
                {feature.title}
              </h3>
              <p className="text-medical-gray leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;