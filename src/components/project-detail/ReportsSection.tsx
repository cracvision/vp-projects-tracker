import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportsSectionProps {
  project: {
    id: string;
    name: string;
  };
}

const ReportsSection = ({ project }: ReportsSectionProps) => {
  const { toast } = useToast();

  const handleGenerateReport = (type: "daily" | "status") => {
    toast({
      title: "Función en desarrollo",
      description: `La generación de reportes ${type === "daily" ? "diarios" : "de estado"} estará disponible próximamente`,
    });
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle>Reportes</CardTitle>
        <CardDescription>
          Genera reportes diarios y de estado del proyecto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => handleGenerateReport("daily")}
          >
            <Calendar className="h-6 w-6" />
            <div className="text-center">
              <p className="font-semibold">Reporte Diario</p>
              <p className="text-xs text-muted-foreground">
                Resumen de entradas por fecha
              </p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => handleGenerateReport("status")}
          >
            <FileText className="h-6 w-6" />
            <div className="text-center">
              <p className="font-semibold">Reporte de Estado</p>
              <p className="text-xs text-muted-foreground">
                Progreso y próximos pasos
              </p>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportsSection;