import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Download, Receipt, DollarSign, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { formatCalendarDate, formatDate, formatMoney, type CurrencyCode } from "@/lib/locale";
import { doctorName, myPortalPatientIds } from "@/lib/booking";

interface Invoice {
  id: string;
  provider_id: string;
  amount: number;
  currency: CurrencyCode | null;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  invoice_number: string;
  description: string | null;
  created_at: string;
  provider?: BookableProvider;
}

type BookableProvider = Database["public"]["Functions"]["list_bookable_providers"]["Returns"][number];

/** Totals per currency, e.g. "P 450.00 + R 200.00" (a patient may be seen in both countries). */
const sumByCurrency = (list: Invoice[]) => {
  const totals = new Map<CurrencyCode, number>();
  for (const inv of list) {
    const cur = inv.currency ?? "BWP";
    totals.set(cur, (totals.get(cur) ?? 0) + Number(inv.amount));
  }
  if (totals.size === 0) return formatMoney(0, "BWP");
  return [...totals].map(([cur, amt]) => formatMoney(amt, cur)).join(" + ");
};

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
      const patientIds = user ? await myPortalPatientIds(user.id) : [];
      if (patientIds.length === 0) {
        setInvoices([]);
        return;
      }
      const [{ data, error }, { data: providers }] = await Promise.all([
        supabase.from('invoices').select('*').in('patient_id', patientIds).order('created_at', { ascending: false }),
        supabase.rpc('list_bookable_providers'),
      ]);

      if (error) throw error;

      const invoicesWithProfiles = (data ?? []).map(inv => ({
        ...inv,
        provider: (providers ?? []).find(p => p.provider_id === inv.provider_id),
      }));
      
      setInvoices(invoicesWithProfiles);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error fetching invoices",
        description: errorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300">Paid</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300">Pending</Badge>;
      case 'overdue': return <Badge className="bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300">Overdue</Badge>;
      case 'cancelled': return <Badge className="bg-gray-100 dark:bg-muted text-gray-800 dark:text-gray-200">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');

  const totalPaid = sumByCurrency(paidInvoices);
  const totalOutstanding = sumByCurrency(pendingInvoices);
  const totalOverdue = sumByCurrency(overdueInvoices);

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totalPaid}</div>
            <p className="text-sm text-muted-foreground">Total Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{totalOutstanding}</div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{totalOverdue}</div>
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
        <Card className="border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Outstanding Payments</p>
                <p className="text-sm">
                  You have {pendingInvoices.length + overdueInvoices.length} unpaid invoice(s) 
                  totaling {sumByCurrency([...pendingInvoices, ...overdueInvoices])}
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
                            <strong>Doctor:</strong> {doctorName(invoice.provider?.display_name)}
                            {invoice.provider?.practice_name && (
                              <span> • {invoice.provider.practice_name}</span>
                            )}
                          </p>
                          <p><strong>Amount:</strong> {formatMoney(invoice.amount, invoice.currency ?? "BWP")}</p>
                          <p><strong>Date:</strong> {formatDate(invoice.created_at, invoice.provider?.timezone ?? "Africa/Gaborone")}</p>
                          {invoice.due_date && (
                            <p><strong>Due:</strong> {formatCalendarDate(invoice.due_date.slice(0, 10))}</p>
                          )}
                          {invoice.paid_date && (
                            <p><strong>Paid:</strong> {formatCalendarDate(invoice.paid_date.slice(0, 10))}</p>
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
                  <div key={invoice.id} className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-500/10">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-semibold">Invoice #{invoice.invoice_number}</h4>
                        <p className="text-sm text-muted-foreground">
                          {doctorName(invoice.provider?.display_name)} • {formatMoney(invoice.amount, invoice.currency ?? "BWP")}
                        </p>
                        {invoice.due_date && (
                          <p className="text-sm text-muted-foreground">
                            Due: {formatCalendarDate(invoice.due_date.slice(0, 10))}
                          </p>
                        )}
                      </div>
                      <Button size="sm" className="bg-primary">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay {formatMoney(invoice.amount, invoice.currency ?? "BWP")}
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
                  <div key={invoice.id} className="p-4 border rounded-lg bg-green-50 dark:bg-green-500/10">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-semibold">Invoice #{invoice.invoice_number}</h4>
                        <p className="text-sm text-muted-foreground">
                          {doctorName(invoice.provider?.display_name)} • {formatMoney(invoice.amount, invoice.currency ?? "BWP")}
                        </p>
                        {invoice.paid_date && (
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Paid: {formatCalendarDate(invoice.paid_date.slice(0, 10))}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Badge className="bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300">Paid</Badge>
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
                    <div key={invoice.id} className="p-4 border rounded-lg bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-red-800 dark:text-red-300">Invoice #{invoice.invoice_number}</h4>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {doctorName(invoice.provider?.display_name)} • {formatMoney(invoice.amount, invoice.currency ?? "BWP")}
                          </p>
                          {invoice.due_date && (
                            <p className="text-sm text-red-700 dark:text-red-300">
                              Was due: {formatCalendarDate(invoice.due_date.slice(0, 10))}
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