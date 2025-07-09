import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Clock, CheckCircle, XCircle, Search, Download } from "lucide-react";
import { useState } from "react";

const ClaimsMonitoring = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const claimsStats = [
    { title: "Total Claims", value: "1,847", change: "+23%", icon: FileText },
    { title: "Pending Review", value: "234", change: "+8%", icon: Clock },
    { title: "Approved", value: "1,456", change: "+18%", icon: CheckCircle },
    { title: "Rejected", value: "157", change: "+2%", icon: XCircle }
  ];

  const claims = [
    {
      id: "PMB-2024-001",
      patient: "Sarah Johnson",
      doctor: "Dr. Chen",
      procedure: "Cardiology Consultation",
      amount: "R2,850",
      status: "pending",
      submitted: "2024-03-15",
      pmb_code: "PMB-001"
    },
    {
      id: "PMB-2024-002",
      patient: "Michael Rodriguez",
      doctor: "Dr. Smith",
      procedure: "Annual Physical Exam",
      amount: "R1,200",
      status: "approved",
      submitted: "2024-03-14",
      pmb_code: "PMB-002"
    },
    {
      id: "PMB-2024-003",
      patient: "Emma Davis",
      doctor: "Dr. Johnson",
      procedure: "Diabetes Management",
      amount: "R3,450",
      status: "rejected",
      submitted: "2024-03-13",
      pmb_code: "PMB-003"
    },
    {
      id: "PMB-2024-004",
      patient: "James Wilson",
      doctor: "Dr. Patel",
      procedure: "Blood Pressure Monitoring",
      amount: "R890",
      status: "under_review",
      submitted: "2024-03-12",
      pmb_code: "PMB-004"
    },
    {
      id: "PMB-2024-005",
      patient: "Lisa Thompson",
      doctor: "Dr. Hassan",
      procedure: "Cardiac Stress Test",
      amount: "R4,200",
      status: "approved",
      submitted: "2024-03-11",
      pmb_code: "PMB-005"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved': return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'under_review': return <Badge className="bg-blue-100 text-blue-800">Under Review</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'under_review': return <FileText className="h-4 w-4 text-blue-600" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const filteredClaims = claims.filter(claim => 
    claim.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.doctor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.procedure.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Claims Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {claimsStats.map((stat, index) => (
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

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PMB Claims Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search claims by patient, doctor, or procedure..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Claims
            </Button>
          </div>

          <div className="border rounded-lg">
            <div className="grid grid-cols-8 gap-4 p-4 bg-muted font-medium text-sm">
              <div>Claim ID</div>
              <div>Patient</div>
              <div>Doctor</div>
              <div>Procedure</div>
              <div>Amount</div>
              <div>Status</div>
              <div>Submitted</div>
              <div>Actions</div>
            </div>
            {filteredClaims.map((claim) => (
              <div key={claim.id} className="grid grid-cols-8 gap-4 p-4 border-t hover:bg-muted/50">
                <div className="font-mono text-sm">{claim.id}</div>
                <div className="font-medium">{claim.patient}</div>
                <div className="text-muted-foreground">{claim.doctor}</div>
                <div className="text-sm">{claim.procedure}</div>
                <div className="font-semibold">{claim.amount}</div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(claim.status)}
                  {getStatusBadge(claim.status)}
                </div>
                <div className="text-muted-foreground text-sm">{claim.submitted}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Review
                  </Button>
                  {claim.status === 'pending' && (
                    <>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600">
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredClaims.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No claims found matching your search criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claims Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Procedures by Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { procedure: "Cardiology Consultation", count: 145, percentage: 78 },
                { procedure: "Annual Physical Exam", count: 98, percentage: 53 },
                { procedure: "Diabetes Management", count: 76, percentage: 41 },
                { procedure: "Blood Pressure Monitoring", count: 54, percentage: 29 },
                { procedure: "Cardiac Stress Test", count: 32, percentage: 17 }
              ].map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.procedure}</span>
                    <span className="text-muted-foreground">{item.count} claims</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Claims Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Average Processing Time</p>
                  <p className="text-sm text-muted-foreground">Time from submission to approval</p>
                </div>
                <div className="text-2xl font-bold">3.2 days</div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Fastest Processing</p>
                  <p className="text-sm text-muted-foreground">Quickest claim processed</p>
                </div>
                <div className="text-2xl font-bold text-green-600">4 hours</div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Claims Pending {"> 7 days"}</p>
                  <p className="text-sm text-muted-foreground">Require immediate attention</p>
                </div>
                <div className="text-2xl font-bold text-red-600">12</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClaimsMonitoring;