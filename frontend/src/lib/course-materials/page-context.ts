import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { Course } from "@/lib/types";

export async function getCourseMaterialsPageContext(courseId: string) {
  const supabase = await createClient();
  const access = await resolveCurrentUserAccess();

  const { data: course, error } = await supabase
    .from("cursos")
    .select("*")
    .eq("id_curso", Number(courseId))
    .single();

  if (error || !course) {
    notFound();
  }

  const typedCourse = course as Course;
  const canManage =
    access.role === "administrador" || access.role === "profesor";

  return {
    course: typedCourse,
    access,
    canManage,
  };
}
