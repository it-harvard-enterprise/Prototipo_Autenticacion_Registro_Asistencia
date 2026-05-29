"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GradeColumn, StudentGradeRow } from "@/lib/course-materials/mock-data";

interface MaterialsGradesClientProps {
  canManage: boolean;
  initialColumns: GradeColumn[];
  rows: StudentGradeRow[];
}

function calculateFinalGrade(
  row: StudentGradeRow,
  columns: GradeColumn[],
): number {
  const weighted = columns.reduce((acc, column) => {
    const grade = row.grades[column.id] ?? 0;
    return acc + (grade * column.weight) / 100;
  }, 0);

  return Number(weighted.toFixed(2));
}

export function MaterialsGradesClient({
  canManage,
  initialColumns,
  rows,
}: MaterialsGradesClientProps) {
  const [columns, setColumns] = useState<GradeColumn[]>(initialColumns);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnWeight, setNewColumnWeight] = useState("10");

  const totalWeight = useMemo(
    () => columns.reduce((acc, column) => acc + column.weight, 0),
    [columns],
  );

  const addColumn = () => {
    const name = newColumnName.trim();
    const weight = Number(newColumnWeight);

    if (!name || Number.isNaN(weight) || weight <= 0) return;

    const newColumnId = `g-local-${Date.now()}`;
    setColumns((prev) => [
      ...prev,
      {
        id: newColumnId,
        name,
        weight,
      },
    ]);
    setNewColumnName("");
    setNewColumnWeight("10");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Estructura de Calificaciones
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Las columnas son creadas por administradores o profesores indicando su
          porcentaje.
        </p>

        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Peso acumulado actual:{" "}
          <span className="font-semibold">{totalWeight}%</span>
        </div>

        {canManage ? (
          <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <Input
              value={newColumnName}
              onChange={(event) => setNewColumnName(event.target.value)}
              placeholder="Nombre de la nota (ej: Quices)"
            />
            <Input
              value={newColumnWeight}
              onChange={(event) => setNewColumnWeight(event.target.value)}
              placeholder="Porcentaje"
              type="number"
              min={1}
              step={1}
            />
            <Button onClick={addColumn} disabled={!newColumnName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar columna
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Esta vista es de lectura para estudiantes.
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-3 text-left font-semibold">Estudiante</th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="px-3 py-3 text-left font-semibold"
                >
                  <div>{column.name}</div>
                  <div className="text-xs font-normal text-gray-500">
                    {column.weight}%
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-left font-semibold">Nota final</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-3 py-3 text-gray-900">
                  <div className="font-medium">
                    {row.apellidos}, {row.nombres}
                  </div>
                  <div className="text-xs text-gray-500">{row.email}</div>
                </td>
                {columns.map((column) => (
                  <td
                    key={`${row.id}-${column.id}`}
                    className="px-3 py-3 text-gray-700"
                  >
                    {row.grades[column.id]?.toFixed(1) ?? "-"}
                  </td>
                ))}
                <td className="px-3 py-3 font-semibold text-emerald-700">
                  {calculateFinalGrade(row, columns).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
