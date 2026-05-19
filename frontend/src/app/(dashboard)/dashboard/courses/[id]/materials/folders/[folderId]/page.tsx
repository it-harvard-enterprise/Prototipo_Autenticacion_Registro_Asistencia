import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCourseMaterialsSnapshot } from "@/app/actions/course-materials";
import { MaterialsFolderExplorerClient } from "@/components/course-materials/materials-folder-explorer-client";
import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { Button } from "@/components/ui/button";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";

interface CourseMaterialsFolderPageProps {
  params: Promise<{ id: string; folderId: string }>;
}

export default async function CourseMaterialsFolderPage({
  params,
}: CourseMaterialsFolderPageProps) {
  const { id, folderId } = await params;
  const parsedFolderId = Number(folderId);

  if (!Number.isInteger(parsedFolderId) || parsedFolderId <= 0) {
    notFound();
  }

  const { course, canManage } = await getCourseMaterialsPageContext(id);
  const snapshotResult = await getCourseMaterialsSnapshot(course.id_curso);

  if (!snapshotResult.success || !snapshotResult.data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Explorador de carpetas
          </h1>
          <p className="mt-1 text-sm text-gray-500">{course.nombre_curso}</p>
        </div>

        <MaterialsNav courseId={course.id_curso} active="content" />

        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            No fue posible cargar los materiales: {snapshotResult.error}
          </p>
        </div>
      </div>
    );
  }

  const targetFolder = snapshotResult.data.folders.find(
    (folder) => folder.id === parsedFolderId,
  );

  if (!targetFolder) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link
            href={`/dashboard/courses/${course.id_curso}/materials/content`}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Explorador de carpetas
          </h1>
          <p className="mt-1 text-sm text-gray-500">{course.nombre_curso}</p>
        </div>
      </div>

      <MaterialsNav courseId={course.id_curso} active="content" />

      <MaterialsFolderExplorerClient
        courseId={course.id_curso}
        canManage={canManage}
        initialFolderId={parsedFolderId}
        folders={snapshotResult.data.folders}
        files={snapshotResult.data.files}
      />
    </div>
  );
}
