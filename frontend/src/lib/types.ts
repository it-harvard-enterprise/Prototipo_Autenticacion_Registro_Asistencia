export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

export interface Student {
  id?: string;
  cedula?: string;
  numero_identificacion: string;
  no_matricula: string | null;
  nombres: string;
  apellidos: string;
  edad?: number;
  grado: number;
  telefono: string | null;
  direccion: string | null;
  barrio: string | null;
  nombre_acudiente: string | null;
  telefono_acudiente: string | null;
  programa: string | null;
  fecha_inicio: string | null;
  fecha_matricula: string | null;
  valor_matricula: number | null;
  matricula_cancelada: boolean;
  valor_apoyo_semanal: number;
  fingerprint_right?: string | null;
  fingerprint_left?: string | null;
  huella_indice_derecho: string | null;
  huella_indice_izquierdo: string | null;
  firma: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Course {
  id?: string;
  name?: string;
  id_curso: number;
  nombre_curso: string;
  nivel_curso: string;
  hora_inicio: string;
  hora_fin: string;
  salon: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  description?: string | null;
  schedule?: string | null;
  created_at: string;
  updated_at?: string;
}
