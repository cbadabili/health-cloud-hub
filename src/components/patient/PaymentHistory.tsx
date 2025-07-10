import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Download, Receipt, DollarSign, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Invoice {
  id: string;
  doctor_id: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  invoice_number: string;
  description: string | null;
  created_at: string;
  doctor_profiles?: {
    specialization: string | null;
  };
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
}

const PaymentHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch doctor profiles and doctor info separately
      const doctorIds = [...new Set(data?.map(inv => inv.doctor_id) || [])];
      let doctorProfiles: any[] = [];
      let profiles: any[] = [];
      
      if (doctorIds.length > 0) {
        const [docProfilesResponse, profilesResponse] = await Promise.all([
          supabase.from('doctor_profiles').select('user_id, specialization').in('user_id', doctorIds),
          supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', doctorIds)
        ]);
        
        doctorProfiles = docProfilesResponse.data || [];
        profiles = profilesResponse.data || [];
      }
      
      const invoicesWithProfiles = data?.map(inv => ({
        ...inv,
        doctor_profiles: doctorProfiles.find(dp => dp.user_id === inv.doctor_id),
        profiles: profiles.find(p => p.user_id === inv.doctor_id)
      })) || [];
      
      setInvoices(invoicesWithProfiles);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching invoices",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      case 'cancelled': return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');

  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalOutstanding = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading payment history...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">R{totalPaid.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Total Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">R{totalOutstanding.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">R{totalOverdue.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-sm text-muted-foreground">Total Invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Bills Alert */}
      {(pendingInvoices.length > 0 || overdueInvoices.length > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Outstanding Payments</p>
                <p className="text-sm">
                  You have {pendingInvoices.length + overdueInvoices.length} unpaid invoice(s) 
                  totaling R{(totalOutstanding + totalOverdue).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Invoices</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingInvoices.length})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({paidInvoices.length})</TabsTrigger>
          {overdueInvoices.length > 0 && (
            <TabsTrigger value="overdue">Overdue ({overdueInvoices.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                All Invoices ({invoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">Invoice #{invoice.invoice_number}</h4>
                          {getStatusBadge(invoice.status)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            <strong>Doctor:</strong> Dr. {invoice.profiles?.first_name} {invoice.profiles?.last_name}
                            {invoice.doctor_profiles?.specialization && (
                              <span> • {invoice.doctor_profiles.specialization}</span>
                            )}
                          </p>
                          <p><strong>Amount:</strong> R{invoice.amount.toFixed(2)}</p>
                          <p><strong>Date:</strong> {new Date(invoice.created_at).toLocaleDateString()}</p>
                          {invoice.due_date && (
                            <p><strong>Due:</strong> {new Date(invoice.due_date).toLocaleDateString()}</p>
                          )}
                          {invoice.paid_date && (
                            <p><strong>Paid:</strong> {new Date(invoice.paid_date).toLocaleDateString()}</p>
                          )}
                          {invoice.description && (
                            <p><strong>Description:</strong> {invoice.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                        </Button>
                        {invoice.status === 'pending' && (
                          <Button size="sm" className="bg-primary">
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pay Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {invoices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No invoices found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pending Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingInvoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 border rounded-lg bg-yellow-50">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-semibold">Invoice #{invoice.invoice_number}</h4>
                        <p className="text-sm text-muted-foreground">
                          Dr. {invoice.profiles?.first_name} {invoice.profiles?.last_name} • R{invoice.amount.toFixed(2)}
                        </p>
                        {invoice.due_date && (
                          <p className="text-sm text-muted-foreground">
                            Due: {new Date(invoice.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button size="sm" className="bg-primary">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay R{invoice.amount.toFixed(2)}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {pendingInvoices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No pending payments
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paid">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paidInvoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 border rounded-lg bg-green-50">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-semibold">Invoice #{invoice.invoice_number}</h4>
                        <p className="text-sm text-muted-foreground">
                          Dr. {invoice.profiles?.first_name} {invoice.profiles?.last_name} • R{invoice.amount.toFixed(2)}
                        </p>
                        {invoice.paid_date && (
                          <p className="text-sm text-green-700">
                            Paid: {new Date(invoice.paid_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Badge className="bg-green-100 text-green-800">Paid</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {paidInvoices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No payment history
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {overdueInvoices.length > 0 && (
          <TabsContent value="overdue">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Overdue Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {overdueInvoices.map((invoice) => (
                    <div key={invoice.id} className="p-4 border rounded-lg bg-red-50 border-red-200">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-red-800">Invoice #{invoice.invoice_number}</h4>
                          <p className="text-sm text-red-700">
                            Dr. {invoice.profiles?.first_name} {invoice.profiles?.last_name} • R{invoice.amount.toFixed(2)}
                          </p>
                          {invoice.due_date && (
                            <p className="text-sm text-red-700">
                              Was due: {new Date(invoice.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay Now
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default PaymentHistory;