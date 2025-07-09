import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, TrendingUp, Users, DollarSign } from "lucide-react";

const SubscriptionManagement = () => {
  const subscriptionStats = [
    { title: "Active Subscriptions", value: "1,247", change: "+8.2%", icon: Users },
    { title: "Monthly Revenue", value: "R284,750", change: "+12.5%", icon: DollarSign },
    { title: "Churn Rate", value: "2.4%", change: "-0.8%", icon: TrendingUp },
    { title: "Avg. Revenue per User", value: "R228", change: "+4.1%", icon: CreditCard }
  ];

  const subscriptions = [
    { user: "Dr. Sarah Chen", plan: "Pro", status: "active", amount: "R2,499", nextBilling: "2024-04-15" },
    { user: "Cape Town Clinic", plan: "Premium", status: "active", amount: "R4,999", nextBilling: "2024-04-20" },
    { user: "Dr. Michael Rodriguez", plan: "Basic", status: "cancelled", amount: "R999", nextBilling: "-" },
    { user: "Durban Medical Center", plan: "Premium", status: "active", amount: "R4,999", nextBilling: "2024-04-18" },
    { user: "Dr. Priya Patel", plan: "Pro", status: "past_due", amount: "R2,499", nextBilling: "2024-03-28" }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      case 'past_due': return <Badge className="bg-yellow-100 text-yellow-800">Past Due</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'Basic': return <Badge variant="outline">Basic</Badge>;
      case 'Pro': return <Badge className="bg-blue-100 text-blue-800">Pro</Badge>;
      case 'Premium': return <Badge className="bg-purple-100 text-purple-800">Premium</Badge>;
      default: return <Badge>{plan}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {subscriptionStats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-green-600 mt-1">
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscription List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Active Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <div className="grid grid-cols-6 gap-4 p-4 bg-muted font-medium text-sm">
              <div>User</div>
              <div>Plan</div>
              <div>Status</div>
              <div>Amount</div>
              <div>Next Billing</div>
              <div>Actions</div>
            </div>
            {subscriptions.map((subscription, index) => (
              <div key={index} className="grid grid-cols-6 gap-4 p-4 border-t hover:bg-muted/50">
                <div className="font-medium">{subscription.user}</div>
                <div>{getPlanBadge(subscription.plan)}</div>
                <div>{getStatusBadge(subscription.status)}</div>
                <div className="font-medium">{subscription.amount}/month</div>
                <div className="text-muted-foreground">{subscription.nextBilling}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Revenue chart will be displayed here</p>
              <p className="text-sm text-muted-foreground mt-2">Integration with analytics service required</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionManagement;