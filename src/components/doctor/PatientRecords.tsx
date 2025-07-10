import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Plus, Edit, Eye, Calendar, Pill, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface MedicalRecord {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  diagnosis: string | null;
  consultation_notes: string | null;
  treatment_plan: string | null;
  vital_signs: any;
  created_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  patient_profiles?: {
    blood_type: string | null;
    allergies: string | null;
    medical_history: string | null;
  };
}

interface Patient {
  user_id: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  patient_profiles?: {
    date_of_birth: string | null;
    blood_type: string | null;
    allergies: string | null;
    medical_history: string | null;
  };
}

const PatientRecords = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      fetchMedicalRecords();
      fetchMyPatients();
    }
  }, [user]);

  const fetchMedicalRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*')
        .eq('doctor_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch patient profiles separately
      const patientIds = [...new Set(data?.map(record => record.patient_id) || [])];
      let profiles: any[] = [];
      
      if (patientIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', patientIds);
        profiles = profilesData || [];
      }
      
      const recordsWithProfiles = data?.map(record => ({
        ...record,
        profiles: profiles.find(p => p.user_id === record.patient_id)
      })) || [];
      
      setMedicalRecords(recordsWithProfiles);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching medical records",
        description: error.message
      });
    }
  };

  const fetchMyPatients = async () => {
    try {
      // Get unique patients from appointments
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('doctor_id', user?.id);

      if (error) throw error;

      const uniquePatientIds = [...new Set(appointments?.map(apt => apt.patient_id) || [])];

      if (uniquePatientIds.length > 0) {
        const { data: patientsData, error: patientsError } = await supabase
          .from('profiles')
          .select(`
            user_id,
            first_name,
            last_name,
            email
          `)
          .in('user_id', uniquePatientIds);

        if (patientsError) throw patientsError;
        
        // Fetch patient profiles separately
        const { data: patientProfiles } = await supabase
          .from('patient_profiles')
          .select('user_id, date_of_birth, blood_type, allergies, medical_history')
          .in('user_id', uniquePatientIds);
        
        const patientsWithProfiles = patientsData?.map(p => ({
          ...p,
          profiles: p,
          patient_profiles: patientProfiles?.find(pp => pp.user_id === p.user_id)
        })) || [];
        
        setMyPatients(patientsWithProfiles);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching patients",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = medicalRecords.filter(record => 
    record.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.consultation_notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPatients = myPatients.filter(patient => 
    patient.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading patient records...</div>
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
            <div className="text-2xl font-bold">{myPatients.length}</div>
            <p className="text-sm text-muted-foreground">Total Patients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{medicalRecords.length}</div>
            <p className="text-sm text-muted-foreground">Medical Records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {medicalRecords.filter(r => {
                const recordDate = new Date(r.created_at);
                const today = new Date();
                return recordDate.toDateString() === today.toDateString();
              }).length}
            </div>
            <p className="text-sm text-muted-foreground">Today's Records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {medicalRecords.filter(r => {
                const recordDate = new Date(r.created_at);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return recordDate >= weekAgo;
              }).length}
            </div>
            <p className="text-sm text-muted-foreground">This Week</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Medical Records</TabsTrigger>
          <TabsTrigger value="patients">My Patients</TabsTrigger>
        </TabsList>

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search records and patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Record
          </Button>
        </div>

        <TabsContent value="records">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Medical Records ({filteredRecords.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No medical records found
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecords.map((record) => (
                    <div key={record.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">
                              {record.profiles?.first_name} {record.profiles?.last_name}
                            </h4>
                            <Badge variant="outline">
                              {new Date(record.created_at).toLocaleDateString()}
                            </Badge>
                          </div>
                          
                          {record.diagnosis && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Diagnosis:</p>
                              <p className="text-sm">{record.diagnosis}</p>
                            </div>
                          )}
                          
                          {record.consultation_notes && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Consultation Notes:</p>
                              <p className="text-sm">{record.consultation_notes}</p>
                            </div>
                          )}
                          
                          {record.treatment_plan && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Treatment Plan:</p>
                              <p className="text-sm">{record.treatment_plan}</p>
                            </div>
                          )}
                          
                          {record.vital_signs && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Vital Signs:</p>
                              <div className="text-sm grid grid-cols-2 gap-2">
                                {Object.entries(record.vital_signs).map(([key, value]) => (
                                  <span key={key}>{key}: {String(value)}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
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

        <TabsContent value="patients">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                My Patients ({filteredPatients.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {filteredPatients.map((patient) => (
                  <div key={patient.user_id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <h4 className="font-semibold">
                          {patient.profiles?.first_name} {patient.profiles?.last_name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {patient.profiles?.email}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {patient.patient_profiles?.date_of_birth && (
                            <div>
                              <span className="font-medium">DOB: </span>
                              {new Date(patient.patient_profiles.date_of_birth).toLocaleDateString()}
                            </div>
                          )}
                          {patient.patient_profiles?.blood_type && (
                            <div>
                              <span className="font-medium">Blood Type: </span>
                              {patient.patient_profiles.blood_type}
                            </div>
                          )}
                        </div>
                        
                        {patient.patient_profiles?.allergies && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Allergies:</p>
                            <p className="text-sm">{patient.patient_profiles.allergies}</p>
                          </div>
                        )}
                        
                        {patient.patient_profiles?.medical_history && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Medical History:</p>
                            <p className="text-sm">{patient.patient_profiles.medical_history}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Pill className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredPatients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No patients found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientRecords;