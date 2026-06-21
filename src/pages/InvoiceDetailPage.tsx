import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { downloadInvoicePDF } from "@/lib/invoicePdf";
import { ymdToLocalDate } from "@/lib/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface InvoiceItem {
  id: string;
  description: string;
  entry_date: string;
  hours: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoice_number: number;
  date: string;
  total_amount: number;
  status: string;
  notes: string | null;
  projects: { name: string } | null;
}

export default function InvoiceDetailPage() {
  const { projectId, invoiceId } = useParams<{ projectId: string; invoiceId: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
      loadProfile();
    }
  }, [invoiceId]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error loading profile:", error);
      }
    }
  };

  const loadInvoice = async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .select("*, projects(name)")
        .eq("id", invoiceId)
        .single();
      if (invErr) throw invErr;
      setInvoice(invData as any);

      const { data: itemsData, error: itemsErr } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("entry_date", { ascending: true });
      if (itemsErr) throw itemsErr;
      setItems(itemsData || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      const dueDate = (invoice as any).due_date
        ? format(ymdToLocalDate((invoice as any).due_date), "dd/MM/yyyy")
        : format(addDays(ymdToLocalDate(invoice.date), 30), "dd/MM/yyyy");

      await downloadInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        invoiceDate: format(ymdToLocalDate(invoice.date), "dd/MM/yyyy"),
        dueDate,
        projectName: invoice.projects?.name || "Proyecto",
        items: items.map((i) => ({
          description: i.description,
          entryDate: format(ymdToLocalDate(i.entry_date), "dd/MM/yyyy"),
          hours: Number(i.hours),
          rate: Number(i.rate),
          amount: Number(i.amount),
        })),
        subtotal: (invoice as any).subtotal || Number(invoice.total_amount),
        taxRate: (invoice as any).tax_rate || undefined,
        taxAmount: (invoice as any).tax_amount || undefined,
        discount: (invoice as any).discount || undefined,
        total: Number(invoice.total_amount),
        adjustedTotal: (invoice as any).adjusted_total
          ? Number((invoice as any).adjusted_total)
          : undefined,
        notes: invoice.notes || undefined,
        companyName: profile?.company_name || undefined,
        companyAddress: profile?.company_address || undefined,
        companyTaxId: profile?.company_tax_id || undefined,
        companyPhone: profile?.company_phone || undefined,
        companyEmail: profile?.company_email || undefined,
        paymentInstructions: profile?.payment_instructions || undefined,
        bankAccount: profile?.bank_account || undefined,
      });

      toast({ title: "PDF descargado", description: "El PDF se ha descargado correctamente" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", invoice.id);
      if (error) throw error;
      setInvoice({ ...invoice, status: newStatus });
      toast({ title: "Estado actualizado", description: `Factura marcada como ${newStatus}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Factura no encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/project/${projectId}/billing`)}>
          Volver a Facturación
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-5xl">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}/billing`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Facturación
        </Button>
        <h1 className="text-3xl font-bold">
          Factura #{invoice.invoice_number?.toString().padStart(4, "0")}
        </h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Fecha</div>
              <div className="font-medium">
                {format(ymdToLocalDate(invoice.date), "dd/MM/yyyy")}
              </div>
            </div>
            <Badge variant={invoice.status === "Cobrado" ? "default" : "secondary"}>
              {invoice.status}
            </Badge>
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Proyecto</div>
            <div className="font-medium">{invoice.projects?.name || "N/A"}</div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center">Fecha</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-md">
                      <div className="whitespace-pre-wrap">{item.description}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {format(ymdToLocalDate(item.entry_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">{Number(item.hours).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(item.rate).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(item.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <div className="min-w-[240px] space-y-2">
              {(invoice as any).adjusted_total && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total Original:</span>
                  <span className="line-through">
                    ${Number(invoice.total_amount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>
                  ${Number((invoice as any).adjusted_total || invoice.total_amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">Notas:</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</div>
            </div>
          )}

          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={invoice.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Cobrado">Cobrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleDownloadPDF} disabled={downloading} className="h-10">
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Descargar PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}