import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Download, Search, Filter } from "lucide-react";
import { useState } from "react";

const PaymentsModule = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const paymentStats = [
    { title: "Total Revenue", value: "R1,247,380", change: "+15.2%", icon: DollarSign },
    { title: "Pending Payments", value: "R28,450", change: "-2.1%", icon: DollarSign },
    { title: "Failed Payments", value: "R3,240", change: "+0.8%", icon: DollarSign },
    { title: "Refunds Issued", value: "R12,800", change: "+5.4%", icon: DollarSign }
  ];

  const payments = [
    { 
      id: "PAY-001", 
      user: "Dr. Sarah Chen", 
      amount: "R2,499", 
      status: "completed", 
      method: "Credit Card", 
      date: "2024-03-15",
      invoice: "INV-2024-001"
    },
    { 
      id: "PAY-002", 
      user: "Cape Town Clinic", 
      amount: "R4,999", 
      status: "completed", 
      method: "Bank Transfer", 
      date: "2024-03-14",
      invoice: "INV-2024-002"
    },
    { 
      id: "PAY-003", 
      user: "Dr. Michael Rodriguez", 
      amount: "R999", 
      status: "failed", 
      method: "Credit Card", 
      date: "2024-03-13",
      invoice: "INV-2024-003"
    },
    { 
      id: "PAY-004", 
      user: "Patient: James Wilson", 
      amount: "R450", 
      status: "pending", 
      method: "Credit Card", 
      date: "2024-03-13",
      invoice: "INV-2024-004"
    },
    { 
      id: "PAY-005", 
      user: "Durban Medical Center", 
      amount: "R4,999", 
      status: "completed", 
      method: "Credit Card", 
      date: "2024-03-12",
      invoice: "INV-2024-005"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'failed': return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'refunded': return <Badge className="bg-gray-100 text-gray-800">Refunded</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filteredPayments = payments.filter(payment => 
    payment.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.invoice.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {paymentStats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs mt-1 ${
                stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payment Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search payments by user, ID, or invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="border rounded-lg">
            <div className="grid grid-cols-7 gap-4 p-4 bg-muted font-medium text-sm">
              <div>Payment ID</div>
              <div>User</div>
              <div>Amount</div>
              <div>Status</div>
              <div>Method</div>
              <div>Date</div>
              <div>Actions</div>
            </div>
            {filteredPayments.map((payment) => (
              <div key={payment.id} className="grid grid-cols-7 gap-4 p-4 border-t hover:bg-muted/50">
                <div className="font-mono text-sm">{payment.id}</div>
                <div className="font-medium">{payment.user}</div>
                <div className="font-semibold">{payment.amount}</div>
                <div>{getStatusBadge(payment.status)}</div>
                <div className="text-muted-foreground">{payment.method}</div>
                <div className="text-muted-foreground">{payment.date}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                  {payment.status === 'failed' && (
                    <Button size="sm" variant="outline" className="text-blue-600">
                      Retry
                    </Button>
                  )}
                  {payment.status === 'completed' && (
                    <Button size="sm" variant="outline" className="text-red-600">
                      Refund
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredPayments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No payments found matching your search criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout Management */}
      <Card>
        <CardHeader>
          <CardTitle>Doctor Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Dr. Sarah Chen</p>
                <p className="text-sm text-muted-foreground">March 2024 consultations</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">R18,750</p>
                <Badge className="bg-yellow-100 text-yellow-800 mt-1">Pending</Badge>
              </div>
              <Button size="sm">Process Payout</Button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Dr. Michael Rodriguez</p>
                <p className="text-sm text-muted-foreground">March 2024 consultations</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">R12,400</p>
                <Badge className="bg-green-100 text-green-800 mt-1">Paid</Badge>
              </div>
              <Button size="sm" variant="outline">View Details</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsModule;