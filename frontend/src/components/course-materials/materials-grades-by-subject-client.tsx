"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SubjectKey = "ingles" | "matematicas" | "sistemas";

type SubjectOption = {
  key: SubjectKey;
  label: string;
};

type GradesBySubjectRow = {
  numero_identificacion: string;
  tipo_identificacion: string | null;
  nombres: string;
  apellidos: string;
  ingles_speaking_1: number | null;
  ingles_speaking_2: number | null;
  ingles_listening_1: number | null;
  ingles_listening_2: number | null;
  ingles_writing_1: number | null;
  ingles_writing_2: number | null;
  ingles_reading_1: number | null;
  ingles_reading_2: number | null;
  ingles_grammar_1: number | null;
  ingles_grammar_2: number | null;
  ingles_definitiva: number | null;
  ingles_comentarios_docente: string | null;
  matematicas_pro: number | null;
  matematicas_sol: number | null;
  matematicas_com: number | null;
  matematicas_raz: number | null;
  matematicas_definitiva: number | null;
  matematicas_comentarios_docente: string | null;
  sistemas_definitiva: number | null;
  sistemas_notas_docente: string | null;
  comentarios_generales_docente: string | null;
};

interface SubjectColumn {
  key: string;
  label: string;
  type: "grade" | "text";
  highlight?: boolean;
  getValue: (row: GradesBySubjectRow) => string;
}

interface MaterialsGradesBySubjectClientProps {
  rows: GradesBySubjectRow[];
  isStudentViewer: boolean;
}

const SUBJECT_OPTIONS: SubjectOption[] = [
  { key: "ingles", label: "Ingles" },
  { key: "matematicas", label: "Matematicas" },
  { key: "sistemas", label: "Sistemas" },
];

function formatGrade(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(2);
}

function formatText(value: string | null): string {
  if (typeof value !== "string") {
    return "-";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "-";
}

const SUBJECT_COLUMNS: Record<SubjectKey, SubjectColumn[]> = {
  ingles: [
    {
      key: "ingles_speaking_1",
      label: "Speaking 1",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_speaking_1),
    },
    {
      key: "ingles_speaking_2",
      label: "Speaking 2",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_speaking_2),
    },
    {
      key: "ingles_listening_1",
      label: "Listening 1",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_listening_1),
    },
    {
      key: "ingles_listening_2",
      label: "Listening 2",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_listening_2),
    },
    {
      key: "ingles_writing_1",
      label: "Writing 1",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_writing_1),
    },
    {
      key: "ingles_writing_2",
      label: "Writing 2",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_writing_2),
    },
    {
      key: "ingles_reading_1",
      label: "Reading 1",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_reading_1),
    },
    {
      key: "ingles_reading_2",
      label: "Reading 2",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_reading_2),
    },
    {
      key: "ingles_grammar_1",
      label: "Grammar 1",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_grammar_1),
    },
    {
      key: "ingles_grammar_2",
      label: "Grammar 2",
      type: "grade",
      getValue: (row) => formatGrade(row.ingles_grammar_2),
    },
    {
      key: "ingles_definitiva",
      label: "Definitiva",
      type: "grade",
      highlight: true,
      getValue: (row) => formatGrade(row.ingles_definitiva),
    },
    {
      key: "ingles_comentarios_docente",
      label: "Comentarios docente",
      type: "text",
      getValue: (row) => formatText(row.ingles_comentarios_docente),
    },
  ],
  matematicas: [
    {
      key: "matematicas_pro",
      label: "PRO",
      type: "grade",
      getValue: (row) => formatGrade(row.matematicas_pro),
    },
    {
      key: "matematicas_sol",
      label: "SOL",
      type: "grade",
      getValue: (row) => formatGrade(row.matematicas_sol),
    },
    {
      key: "matematicas_com",
      label: "COM",
      type: "grade",
      getValue: (row) => formatGrade(row.matematicas_com),
    },
    {
      key: "matematicas_raz",
      label: "RAZ",
      type: "grade",
      getValue: (row) => formatGrade(row.matematicas_raz),
    },
    {
      key: "matematicas_definitiva",
      label: "Definitiva",
      type: "grade",
      highlight: true,
      getValue: (row) => formatGrade(row.matematicas_definitiva),
    },
    {
      key: "matematicas_comentarios_docente",
      label: "Comentarios docente",
      type: "text",
      getValue: (row) => formatText(row.matematicas_comentarios_docente),
    },
  ],
  sistemas: [
    {
      key: "sistemas_definitiva",
      label: "Definitiva",
      type: "grade",
      highlight: true,
      getValue: (row) => formatGrade(row.sistemas_definitiva),
    },
    {
      key: "sistemas_notas_docente",
      label: "Comentario docente",
      type: "text",
      getValue: (row) => formatText(row.sistemas_notas_docente),
    },
  ],
};

export function MaterialsGradesBySubjectClient({
  rows,
  isStudentViewer,
}: MaterialsGradesBySubjectClientProps) {
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey>("ingles");

  const currentSubject = useMemo(
    () =>
      SUBJECT_OPTIONS.find((item) => item.key === selectedSubject) ??
      SUBJECT_OPTIONS[0],
    [selectedSubject],
  );

  const columns = SUBJECT_COLUMNS[selectedSubject];
  const emptyColSpan = columns.length + (isStudentViewer ? 1 : 2);

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Calificaciones
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Mostrando {rows.length} estudiante(s) para {currentSubject.label}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline" }),
              "min-w-44 justify-between gap-2",
            )}
          >
            {currentSubject.label}
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {SUBJECT_OPTIONS.map((subject) => (
              <DropdownMenuItem
                key={subject.key}
                onClick={() => setSelectedSubject(subject.key)}
                className={cn(
                  "cursor-pointer",
                  subject.key === selectedSubject &&
                    "bg-accent text-accent-foreground",
                )}
              >
                {subject.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              {!isStudentViewer ? (
                <th className="px-3 py-3 text-left font-semibold">
                  Identificacion
                </th>
              ) : null}
              <th className="px-3 py-3 text-left font-semibold">Estudiante</th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-3 text-left font-semibold"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.numero_identificacion}
                className="border-t border-gray-100"
              >
                {!isStudentViewer ? (
                  <td className="px-3 py-3 text-gray-700">
                    <div className="font-mono text-xs">
                      {row.numero_identificacion}
                    </div>
                    <div className="text-xs text-gray-500">
                      {row.tipo_identificacion ?? "-"}
                    </div>
                  </td>
                ) : null}

                <td className="px-3 py-3 text-gray-900">
                  {row.apellidos}, {row.nombres}
                </td>

                {columns.map((column) => (
                  <td
                    key={`${row.numero_identificacion}-${column.key}`}
                    className={cn(
                      "px-3 py-3 text-gray-700",
                      column.type === "grade" && "font-semibold text-gray-900",
                      column.highlight && "text-emerald-700",
                      column.type === "text" &&
                        "min-w-44 max-w-xs whitespace-pre-wrap",
                    )}
                  >
                    {column.getValue(row)}
                  </td>
                ))}
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr className="border-t border-gray-100">
                <td
                  colSpan={emptyColSpan}
                  className="px-3 py-6 text-center text-gray-500"
                >
                  No hay calificaciones registradas para mostrar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
