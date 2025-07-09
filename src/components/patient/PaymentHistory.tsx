import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Download, Receipt } from "lucide-react";

const PaymentHistory = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment History & Bills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CreditCard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Manage Your Payments</h3>
            <p className="text-muted-foreground mb-6">
              View payment history, outstanding bills, and make secure payments online
            </p>
            <Button>View Payment History</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentHistory;