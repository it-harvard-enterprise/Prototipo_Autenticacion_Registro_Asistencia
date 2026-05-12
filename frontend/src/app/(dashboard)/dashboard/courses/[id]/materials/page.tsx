import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaterialsNav } from "@/components/course-materials/materials-nav";
import { MaterialsHomeClient } from "@/components/course-materials/materials-home-client";
import { getCourseMaterialsDataset } from "@/lib/course-materials/mock-data";
import { getCourseMaterialsPageContext } from "@/lib/course-materials/page-context";

interface CourseMaterialsHomePageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseMaterialsHomePage({
  params,
}: CourseMaterialsHomePageProps) {
  const { id } = await params;
  const { course, canManage } = await getCourseMaterialsPageContext(id);
  const dataset = getCourseMaterialsDataset(course.nombre_curso);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/dashboard/courses/${course.id_curso}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Materiales del Curso
          </h1>
          <p className="mt-1 text-sm text-gray-500">{course.nombre_curso}</p>
        </div>
      </div>

      <MaterialsNav courseId={course.id_curso} active="home" />

      <MaterialsHomeClient
        courseName={course.nombre_curso}
        canManage={canManage}
        initialPosts={dataset.posts}
        folders={dataset.folders}
      />
    </div>
  );
}
