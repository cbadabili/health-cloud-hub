import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  DollarSign,
  FileText,
  TrendingUp,
  UserPlus,
  Settings,
  Shield,
  BarChart3,
  Home,
  LogOut
} from "lucide-react";
import { Link } from "react-router-dom";
import UserManagement from "@/components/admin/UserManagement";
import SubscriptionManagement from "@/components/admin/SubscriptionManagement";
import PaymentsModule from "@/components/admin/PaymentsModule";
import ClaimsMonitoring from "@/components/admin/ClaimsMonitoring";

const SuperAdminDashboard = () => {
  const { user, signOut } = useAuth();
  const displayName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || "there";
  const [activeTab, setActiveTab] = useState("overview");

  const stats = [
    {
      title: "Total Users",
      value: "2,847",
      change: "+12%",
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Monthly Revenue",
      value: "R284,750",
      change: "+8.2%",
      icon: DollarSign,
      color: "text-green-600"
    },
    {
      title: "Active Claims",
      value: "1,247",
      change: "+23%",
      icon: FileText,
      color: "text-orange-600"
    },
    {
      title: "Growth Rate",
      value: "15.8%",
      change: "+2.4%",
      icon: TrendingUp,
      color: "text-purple-600"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link 
              to="/" 
              className="p-2 bg-gradient-primary rounded-lg hover:opacity-80 transition-opacity shrink-0"
              aria-label="Go to home page"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <Shield className="h-6 w-6 text-primary-foreground" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">Super Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground truncate">Welcome back, {displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link to="/" aria-label="Home">
                <Home className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full justify-start overflow-x-auto mb-6 md:grid md:grid-cols-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="claims">Claims</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <p className="text-xs text-green-600 mt-1">
                      {stat.change} from last month
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    className="h-20 flex flex-col gap-2" 
                    variant="outline"
                    onClick={() => setActiveTab("users")}
                  >
                    <UserPlus className="h-6 w-6" />
                    Add User
                  </Button>
                  <Button className="h-20 flex flex-col gap-2" variant="outline">
                    <BarChart3 className="h-6 w-6" />
                    View Reports
                  </Button>
                  <Button 
                    className="h-20 flex flex-col gap-2" 
                    variant="outline"
                    onClick={() => setActiveTab("payments")}
                  >
                    <DollarSign className="h-6 w-6" />
                    Process Payments
                  </Button>
                  <Button 
                    className="h-20 flex flex-col gap-2" 
                    variant="outline"
                    onClick={() => setActiveTab("claims")}
                  >
                    <FileText className="h-6 w-6" />
                    Review Claims
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent System Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { action: "New doctor registration", user: "Dr. Smith", time: "2 hours ago" },
                    { action: "Payment processed", user: "Patient #1247", time: "4 hours ago" },
                    { action: "PMB claim submitted", user: "Dr. Johnson", time: "6 hours ago" },
                    { action: "User account activated", user: "nurse@clinic.com", time: "8 hours ago" }
                  ].map((activity, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium text-foreground">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">{activity.user}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionManagement />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsModule />
          </TabsContent>

          <TabsContent value="claims">
            <ClaimsMonitoring />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;