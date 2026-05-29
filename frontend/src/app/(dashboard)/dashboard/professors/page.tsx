import { getProfessors } from "@/app/actions/professors";
import { NewProfessorButton } from "@/components/new-professor-button";
import { DetailLookup } from "@/components/detail-lookup";
import { ProfessorsTable } from "@/components/professors-table";
import { Professor } from "@/lib/types";

export default async function ProfessorsPage() {
  const result = await getProfessors();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profesores</h1>
          <p className="text-gray-500 mt-1">
            Gestión de profesores registrados en el sistema
          </p>
        </div>
        <NewProfessorButton />
      </div>

      <DetailLookup type="professor" />

      {!result.success ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">
            Error al cargar los profesores: {result.error}
          </p>
        </div>
      ) : (
        <ProfessorsTable professors={(result.data ?? []) as Professor[]} />
      )}
    </div>
  );
}
