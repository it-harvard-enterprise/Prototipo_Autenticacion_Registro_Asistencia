"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function NewStudentButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function startFingerprintService() {
    try {
      const res = await fetch("/api/start-service");
      if (res.ok) {
        const json = await res.json();
        console.info(
          json?.message || "El servicio de captura de huellas está activo.",
        );
      } else {
        const json = await res.json().catch(() => null);
        toast.error(
          json?.message ||
            "No se pudo iniciar el servicio de captura de huellas",
        );
      }
    } catch {
      toast.error("Error al contactar el servicio de captura de huellas");
    }
  }

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    void startFingerprintService();
    setIsLoading(false);
    router.push("/dashboard/students/new");
  }

  return (
    <Button onClick={handleClick} disabled={isLoading}>
      <Plus className="mr-2 h-4 w-4" />
      Nuevo Estudiante
    </Button>
  );
}
