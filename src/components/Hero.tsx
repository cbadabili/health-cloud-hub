import { Button } from "@/components/ui/button";
import { Shield, Clock, Users, ArrowRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative py-20 lg:py-32 bg-gradient-hero overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-72 h-72 bg-medical-blue rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-medical-green rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-medical-light-blue border border-medical-blue/20 rounded-full px-4 py-2 mb-8">
            <Shield className="h-4 w-4 text-medical-blue" />
            <span className="text-sm font-medium text-medical-blue">HIPAA Compliant & Secure</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl lg:text-6xl font-bold text-medical-dark mb-6 leading-tight">
            Complete EMR & Medical Billing
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Solution</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl lg:text-2xl text-medical-gray mb-8 max-w-3xl mx-auto leading-relaxed">
            Streamline your medical practice with integrated appointment scheduling, patient records, 
            intelligent billing, and telehealth capabilities in one secure platform.
          </p>

          {/* Role Selector */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button variant="hero" size="xl" className="group">
              I'm a Doctor
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="medical-outline" size="xl" className="group">
              I'm a Patient
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-medical-light-green rounded-xl mb-4">
                <Users className="h-8 w-8 text-medical-green" />
              </div>
              <h3 className="font-semibold text-medical-dark mb-2">10,000+ Users</h3>
              <p className="text-medical-gray text-sm">Trusted by healthcare professionals</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-medical-light-blue rounded-xl mb-4">
                <Shield className="h-8 w-8 text-medical-blue" />
              </div>
              <h3 className="font-semibold text-medical-dark mb-2">100% Secure</h3>
              <p className="text-medical-gray text-sm">Bank-level encryption & HIPAA compliant</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-medical-light-green rounded-xl mb-4">
                <Clock className="h-8 w-8 text-medical-green" />
              </div>
              <h3 className="font-semibold text-medical-dark mb-2">Save 5+ Hours</h3>
              <p className="text-medical-gray text-sm">Daily admin time saved per doctor</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;