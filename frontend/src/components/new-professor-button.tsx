"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewProfessorButton() {
  const router = useRouter();

  return (
    <Button onClick={() => router.push("/dashboard/professors/new")}>
      <Plus className="mr-2 h-4 w-4" />
      Nuevo Profesor
    </Button>
  );
}
