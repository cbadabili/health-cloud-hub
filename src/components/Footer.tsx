import { Stethoscope, Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-medical-dark text-gray-300 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-1 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Stethoscope className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">MedFlow</h1>
                <p className="text-xs text-gray-400">EMR & Billing</p>
              </div>
            </div>
            <p className="text-gray-400 leading-relaxed mb-6 max-w-md">
              Complete cloud-based EMR and medical billing solution designed to streamline 
              your healthcare practice and enhance patient care.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-medical-blue" />
                <span className="text-sm">support@medflow.co.za</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-medical-blue" />
                <span className="text-sm">+27 (0) 11 123 4567</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-medical-blue" />
                <span className="text-sm">Cape Town, South Africa</span>
              </div>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-white font-semibold mb-6">Product</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">Features</a></li>
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">Pricing</a></li>
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">Security</a></li>
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">Integrations</a></li>
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">API Documentation</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-6">Support</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">Help Center</a></li>
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">Contact Support</a></li>
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">Training</a></li>
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">System Status</a></li>
              <li><a href="#" className="text-gray-400 hover:text-medical-blue transition-colors">HIPAA Compliance</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © 2024 MedFlow EMR & Billing. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-400 hover:text-medical-blue transition-colors text-sm">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-medical-blue transition-colors text-sm">Terms of Service</a>
              <a href="#" className="text-gray-400 hover:text-medical-blue transition-colors text-sm">Cookie Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;