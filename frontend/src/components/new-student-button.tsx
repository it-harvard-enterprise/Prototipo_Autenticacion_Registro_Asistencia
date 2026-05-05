"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function NewStudentButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/start-service");
      if (res.ok) {
        const json = await res.json();
        toast.success(
          json?.message || "Fingerprint capture service is up and running.",
        );
      } else {
        const json = await res.json().catch(() => null);
        toast.error(
          json?.message || "Fingerprint capture service could not be started",
        );
      }
    } catch (err) {
      toast.error("Error contacting fingerprint service");
    } finally {
      setIsLoading(false);
      router.push("/dashboard/students/new");
    }
  }

  return (
    <Button onClick={handleClick} disabled={isLoading}>
      <Plus className="mr-2 h-4 w-4" />
      Nuevo Estudiante
    </Button>
  );
}
