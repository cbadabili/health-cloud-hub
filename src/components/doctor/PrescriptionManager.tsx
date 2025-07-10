import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, Plus, Search, Edit, Eye, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Prescription {
  id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  status: string;
  created_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

const PrescriptionManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      fetchPrescriptions();
    }
  }, [user]);

  const fetchPrescriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('doctor_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch patient profiles separately
      const patientIds = [...new Set(data?.map(presc => presc.patient_id) || [])];
      let profiles: any[] = [];
      
      if (patientIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', patientIds);
        profiles = profilesData || [];
      }
      
      const prescriptionsWithProfiles = data?.map(presc => ({
        ...presc,
        profiles: profiles.find(p => p.user_id === presc.patient_id)
      })) || [];
      
      setPrescriptions(prescriptionsWithProfiles);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching prescriptions",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePrescriptionStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setPrescriptions(prev => 
        prev.map(presc => presc.id === id ? { ...presc, status } : presc)
      );

      toast({
        title: "Prescription updated",
        description: `Status changed to ${status}`
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating prescription",
        description: error.message
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'completed': return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filteredPrescriptions = prescriptions.filter(presc => 
    presc.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    presc.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    presc.medication_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    presc.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activePrescriptions = filteredPrescriptions.filter(presc => presc.status === 'active');
  const recentPrescriptions = filteredPrescriptions.slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading prescriptions...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{activePrescriptions.length}</div>
            <p className="text-sm text-muted-foreground">Active Prescriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {prescriptions.filter(p => p.status === 'pending').length}
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {prescriptions.filter(p => p.status === 'completed').length}
            </div>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{prescriptions.length}</div>
            <p className="text-sm text-muted-foreground">Total Prescribed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="all">All Prescriptions</TabsTrigger>
        </TabsList>

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search prescriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Prescription
          </Button>
        </div>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Active Prescriptions ({activePrescriptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activePrescriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active prescriptions
                </div>
              ) : (
                <div className="space-y-4">
                  {activePrescriptions.map((prescription) => (
                    <div key={prescription.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{prescription.medication_name}</h4>
                            {getStatusBadge(prescription.status)}
                          </div>
                          <p className="text-sm font-medium">
                            Patient: {prescription.profiles?.first_name} {prescription.profiles?.last_name}
                          </p>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Dosage:</strong> {prescription.dosage}</p>
                            <p><strong>Frequency:</strong> {prescription.frequency}</p>
                            <p><strong>Duration:</strong> {prescription.duration}</p>
                            {prescription.instructions && (
                              <p><strong>Instructions:</strong> {prescription.instructions}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Recent Prescriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentPrescriptions.map((prescription) => (
                  <div key={prescription.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{prescription.medication_name}</h4>
                        {getStatusBadge(prescription.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {prescription.profiles?.first_name} {prescription.profiles?.last_name} • 
                        {new Date(prescription.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {prescription.dosage} • {prescription.frequency}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                All Prescriptions ({filteredPrescriptions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <div className="grid grid-cols-6 gap-4 p-4 bg-muted font-medium text-sm">
                  <div>Date</div>
                  <div>Patient</div>
                  <div>Medication</div>
                  <div>Dosage & Frequency</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                {filteredPrescriptions.map((prescription) => (
                  <div key={prescription.id} className="grid grid-cols-6 gap-4 p-4 border-t hover:bg-muted/50">
                    <div className="text-sm">
                      {new Date(prescription.created_at).toLocaleDateString()}
                    </div>
                    <div>
                      <div className="font-medium">
                        {prescription.profiles?.first_name} {prescription.profiles?.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {prescription.profiles?.email}
                      </div>
                    </div>
                    <div className="font-medium">{prescription.medication_name}</div>
                    <div className="text-sm">
                      <div>{prescription.dosage}</div>
                      <div className="text-muted-foreground">{prescription.frequency}</div>
                    </div>
                    <div>{getStatusBadge(prescription.status)}</div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {filteredPrescriptions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No prescriptions found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PrescriptionManager;