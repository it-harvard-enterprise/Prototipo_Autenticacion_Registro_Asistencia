import { notFound } from "next/navigation";
import { getCourseById } from "@/app/actions/courses";
import { resolveCurrentUserAccess } from "@/lib/auth/resolved-access";
import { Course } from "@/lib/types";

export async function getCourseMaterialsPageContext(courseId: string) {
  const access = await resolveCurrentUserAccess();

  const courseResult = await getCourseById(Number(courseId));

  if (!courseResult.success || !courseResult.data) {
    notFound();
  }

  const typedCourse = courseResult.data as Course;
  const canManage =
    access.role === "administrador" || access.role === "profesor";

  return {
    course: typedCourse,
    access,
    canManage,
  };
}
