import Link from "next/link";
import { cn } from "@/lib/utils";

interface MaterialsNavProps {
  courseId: number;
  active: "home" | "content" | "grades" | "students";
}

const tabs = [
  { key: "home", label: "Pagina de Inicio del Curso", path: "" },
  { key: "content", label: "Contenido", path: "/content" },
  { key: "students", label: "Listado de Alumnos", path: "/students" },
] as const;

export function MaterialsNav({ courseId, active }: MaterialsNavProps) {
  return (
    <nav className="rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <ul className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <li key={tab.key}>
              <Link
                href={`/dashboard/courses/${courseId}/materials${tab.path}`}
                className={cn(
                  "inline-flex rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
