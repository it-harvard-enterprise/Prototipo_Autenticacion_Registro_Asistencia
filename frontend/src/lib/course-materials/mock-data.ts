export type CourseProfileRole = "administrador" | "profesor" | "estudiante";

export interface CoursePost {
  id: string;
  author: string;
  role: CourseProfileRole;
  message: string;
  publishedAt: string;
}

export interface CourseFolder {
  id: string;
  name: string;
  fileCount: number;
  visitedCount: number;
  colorClass: string;
}

export interface GradeColumn {
  id: string;
  name: string;
  weight: number;
}

export interface StudentGradeRow {
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
  grades: Record<string, number>;
}

export interface CourseMember {
  id: string;
  role: CourseProfileRole;
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
}

export interface CourseMaterialsDataset {
  posts: CoursePost[];
  folders: CourseFolder[];
  gradeColumns: GradeColumn[];
  gradeRows: StudentGradeRow[];
  members: CourseMember[];
}

export function getCourseMaterialsDataset(
  courseName: string,
): CourseMaterialsDataset {
  const upperCourse = courseName.trim().toUpperCase();

  return {
    posts: [
      {
        id: "post-1",
        author: "Coordinacion Academica",
        role: "administrador",
        message: `Bienvenidos a ${upperCourse}. En esta seccion encontraras guias, talleres y material de apoyo.`,
        publishedAt: "2026-05-01T09:00:00.000Z",
      },
      {
        id: "post-2",
        author: "Prof. Maria C. Rojas",
        role: "profesor",
        message:
          "Recuerden revisar la carpeta de evaluacion. Ya esta disponible la rubrica del primer corte.",
        publishedAt: "2026-05-08T15:40:00.000Z",
      },
    ],
    folders: [
      {
        id: "f-1",
        name: "Unidad 1 - Fundamentos",
        fileCount: 6,
        visitedCount: 4,
        colorClass: "from-amber-300 to-orange-500",
      },
      {
        id: "f-2",
        name: "Unidad 2 - Casos Practicos",
        fileCount: 8,
        visitedCount: 3,
        colorClass: "from-sky-300 to-blue-500",
      },
      {
        id: "f-3",
        name: "Proyecto Final",
        fileCount: 5,
        visitedCount: 1,
        colorClass: "from-emerald-300 to-green-500",
      },
      {
        id: "f-4",
        name: "Biblioteca y Lecturas",
        fileCount: 10,
        visitedCount: 6,
        colorClass: "from-fuchsia-300 to-pink-500",
      },
    ],
    gradeColumns: [
      { id: "g-1", name: "Parcial 1", weight: 30 },
      { id: "g-2", name: "Proyecto", weight: 40 },
      { id: "g-3", name: "Parcial Final", weight: 30 },
    ],
    gradeRows: [
      {
        id: "s-1",
        nombres: "Andrea",
        apellidos: "Lopez",
        email: "andrea.lopez@correo.edu.co",
        telefono: "3101234567",
        grades: { "g-1": 4.2, "g-2": 4.7, "g-3": 4.0 },
      },
      {
        id: "s-2",
        nombres: "Camilo",
        apellidos: "Ruiz",
        email: "camilo.ruiz@correo.edu.co",
        telefono: "3129876543",
        grades: { "g-1": 3.6, "g-2": 4.1, "g-3": 3.8 },
      },
      {
        id: "s-3",
        nombres: "Valentina",
        apellidos: "Sierra",
        email: "valentina.sierra@correo.edu.co",
        telefono: "3014567890",
        grades: { "g-1": 4.8, "g-2": 4.5, "g-3": 4.9 },
      },
    ],
    members: [
      {
        id: "m-1",
        role: "administrador",
        nombres: "Laura",
        apellidos: "Martinez",
        telefono: "3001112233",
        email: "laura.martinez@instituto.edu.co",
      },
      {
        id: "m-2",
        role: "profesor",
        nombres: "Maria Camila",
        apellidos: "Rojas",
        telefono: "3004445566",
        email: "maria.rojas@instituto.edu.co",
      },
      {
        id: "m-3",
        role: "estudiante",
        nombres: "Andrea",
        apellidos: "Lopez",
        telefono: "3101234567",
        email: "andrea.lopez@correo.edu.co",
      },
      {
        id: "m-4",
        role: "estudiante",
        nombres: "Camilo",
        apellidos: "Ruiz",
        telefono: "3129876543",
        email: "camilo.ruiz@correo.edu.co",
      },
      {
        id: "m-5",
        role: "estudiante",
        nombres: "Valentina",
        apellidos: "Sierra",
        telefono: "3014567890",
        email: "valentina.sierra@correo.edu.co",
      },
    ],
  };
}

export function computeCompletion(
  visitedCount: number,
  fileCount: number,
): number {
  if (fileCount <= 0) return 0;
  const ratio = (visitedCount / fileCount) * 100;
  return Math.max(0, Math.min(100, Math.round(ratio)));
}
