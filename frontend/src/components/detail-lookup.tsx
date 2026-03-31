"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LookupType = "student" | "course";

interface DetailLookupProps {
  type: LookupType;
}

export function DetailLookup({ type }: DetailLookupProps) {
  const router = useRouter();
  const supabase = createClient();
  const [value, setValue] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const trimmedValue = value.trim();

  const isValid =
    type === "course"
      ? Number.isInteger(Number(trimmedValue)) && Number(trimmedValue) > 0
      : trimmedValue.length > 0;

  const placeholder =
    type === "course"
      ? "Ingrese ID del curso (ej: 12)"
      : "Ingrese número de identificación";

  const label =
    type === "course"
      ? "Buscar curso por ID del curso"
      : "Buscar estudiante por número de identificación";

  const navigate = async () => {
    if (!isValid) return;

    setIsChecking(true);

    try {
      if (type === "course") {
        const { data, error } = await supabase
          .from("cursos")
          .select("id_curso")
          .eq("id_curso", Number(trimmedValue))
          .limit(1);

        if (error || !data || data.length === 0) {
          toast.error("El ID de curso ingresado no existe.");
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("estudiantes")
          .select("numero_identificacion")
          .eq("numero_identificacion", trimmedValue)
          .limit(1);

        if (error || !data || data.length === 0) {
          toast.error("El número de identificación ingresado no existe.");
          return;
        }
      }

      const target =
        type === "course"
          ? `/dashboard/courses/${Number(trimmedValue)}`
          : `/dashboard/students/${encodeURIComponent(trimmedValue)}`;

      router.push(target);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="rounded-md border bg-white p-4">
      <p className="text-sm font-medium text-gray-800 mb-3">{label}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              navigate();
            }
          }}
        />
        <Button
          type="button"
          onClick={navigate}
          disabled={!isValid || isChecking}
        >
          <Search className="mr-2 h-4 w-4" />
          {isChecking ? "Validando..." : "Ver detalle"}
        </Button>
      </div>
    </div>
  );
}
