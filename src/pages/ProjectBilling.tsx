import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ArrowLeft, Plus, Eye, Loader2 } from "lucide-react";
import { CreateInvoiceDialog } from "@/components/billing/CreateInvoiceDialog";

interface Project {
  id: string;
  name: string;
  hourly_rate: number;
}

interface Invoice {
  id: string;
  invoice_number: number;
  date: string;
  total_amount: number;
  status: string;
}

export default function ProjectBilling() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      // Cargar proyecto
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, name, hourly_rate")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Cargar facturas
      await loadInvoices();
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

  const loadInvoices = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, date, total_amount, status")
        .eq("project_id", projectId)
        .order("date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      toast({
        title: "Error cargando facturas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreated = () => {
    loadInvoices();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Proyecto no encontrado</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/")}
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/project/${projectId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al proyecto
          </Button>
          <h1 className="text-3xl font-bold">Facturación - {project.name}</h1>
        </div>
      </div>

      {/* Crear Factura */}
      <Card>
        <CardHeader>
          <CardTitle>Crear Nueva Factura</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Factura
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Facturas */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay facturas creadas para este proyecto
            </p>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        #{invoice.invoice_number.toString().padStart(4, '0')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        ${Number(invoice.total_amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.status === "Cobrado"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/project/${projectId}/billing/${invoice.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateInvoiceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        project={project}
        onCreated={handleCreated}
      />
    </div>
  );
}
