import {
  CourseFolder,
  computeCompletion,
} from "@/lib/course-materials/mock-data";
import { cn } from "@/lib/utils";

interface FolderCardProps {
  folder: CourseFolder;
  large?: boolean;
  showUploadHint?: boolean;
}

export function FolderCard({
  folder,
  large = false,
  showUploadHint = false,
}: FolderCardProps) {
  const completion = computeCompletion(folder.visitedCount, folder.fileCount);

  return (
    <article
      className={cn(
        "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm",
        large ? "min-h-72" : "min-h-60",
      )}
    >
      <div
        className={cn(
          "mb-4 rounded-xl bg-gradient-to-br",
          folder.colorClass,
          large ? "h-36" : "h-28",
        )}
      />

      <h3
        className={cn(
          "font-semibold text-gray-900",
          large ? "text-lg" : "text-base",
        )}
      >
        {folder.name}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        {folder.fileCount} archivos en la carpeta
      </p>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>Progreso de lectura</span>
          <span>{completion}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${completion}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {folder.visitedCount} de {folder.fileCount} archivos visitados
        </p>
      </div>

      {showUploadHint ? (
        <div className="mt-4 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          Suba nuevos archivos dentro de esta carpeta.
        </div>
      ) : null}
    </article>
  );
}
