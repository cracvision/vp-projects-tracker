import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Download, Loader2 } from "lucide-react";
import { downloadInvoicePDF } from "@/lib/invoicePdf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface InvoiceDetailProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function InvoiceDetail({
  invoiceId,
  open,
  onOpenChange,
  onUpdate,
}: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoice();
      loadProfile();
    }
  }, [open, invoiceId]);

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
      console.error("Error loading profile:", error);
    }
  };

  const loadInvoice = async () => {
    if (!invoiceId) return;

    setLoading(true);
    try {
      // Cargar factura con joins
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .select("*, projects(name)")
        .eq("id", invoiceId)
        .single();

      if (invErr) throw invErr;
      setInvoice(invData as any);

      // Cargar items
      const { data: itemsData, error: itemsErr } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("entry_date", { ascending: true });

      if (itemsErr) throw itemsErr;
      setItems(itemsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    setDownloading(true);
    try {
      // Calcular due_date si no existe (30 días desde emisión)
      const dueDate = (invoice as any).due_date 
        ? format(new Date((invoice as any).due_date), "dd/MM/yyyy")
        : format(addDays(new Date(invoice.date), 30), "dd/MM/yyyy");

      await downloadInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        invoiceDate: format(new Date(invoice.date), "dd/MM/yyyy"),
        dueDate,
        projectName: invoice.projects?.name || "Proyecto",
        items: items.map((i) => ({
          description: i.description,
          entryDate: format(new Date(i.entry_date), "dd/MM/yyyy"),
          hours: Number(i.hours),
          rate: Number(i.rate),
          amount: Number(i.amount),
        })),
        subtotal: (invoice as any).subtotal || Number(invoice.total_amount),
        taxRate: (invoice as any).tax_rate || undefined,
        taxAmount: (invoice as any).tax_amount || undefined,
        discount: (invoice as any).discount || undefined,
        total: Number(invoice.total_amount),
        notes: invoice.notes || undefined,
        // Datos del emisor
        companyName: profile?.company_name || undefined,
        companyAddress: profile?.company_address || undefined,
        companyTaxId: profile?.company_tax_id || undefined,
        companyPhone: profile?.company_phone || undefined,
        companyEmail: profile?.company_email || undefined,
        // Instrucciones de pago
        paymentInstructions: profile?.payment_instructions || undefined,
        bankAccount: profile?.bank_account || undefined,
      });

      toast({
        title: "PDF descargado",
        description: "El PDF se ha descargado correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (error) throw error;

      setInvoice({ ...invoice, status: newStatus });
      onUpdate();

      toast({
        title: "Estado actualizado",
        description: `Factura marcada como ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!invoice && !loading) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Factura #{invoice?.invoice_number || ""}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : invoice ? (
          <div className="space-y-6 mt-6">
            {/* Header Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Fecha</div>
                  <div className="font-medium">
                    {format(new Date(invoice.date), "dd/MM/yyyy")}
                  </div>
                </div>
                <Badge
                  variant={
                    invoice.status === "Cobrado" ? "default" : "secondary"
                  }
                >
                  {invoice.status}
                </Badge>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">Proyecto</div>
                <div className="font-medium">
                  {invoice.projects?.name || "N/A"}
                </div>
              </div>
            </div>

            {/* Items Table */}
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
                      <TableCell className="max-w-xs">
                        <div className="truncate">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        {format(new Date(item.entry_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.hours).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(item.rate).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(item.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="min-w-[200px] space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${Number(invoice.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notas */}
            {invoice.notes && (
              <div className="border-t pt-4">
                <div className="text-sm font-medium mb-2">Notas:</div>
                <div className="text-sm text-muted-foreground">
                  {invoice.notes}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Estado</label>
                <Select
                  value={invoice.status}
                  onValueChange={handleStatusChange}
                  disabled={updatingStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="Cobrado">Cobrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={handleDownloadPDF}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Descargar PDF
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
