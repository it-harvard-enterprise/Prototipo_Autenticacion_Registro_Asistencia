export interface Profile {
  id: string
  first_name: string
  last_name: string
  email: string
  created_at: string
}

export interface Student {
  id: string
  cedula: string
  nombres: string
  apellidos: string
  edad: number
  grado: string
  fingerprint_right: string | null
  fingerprint_left: string | null
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  name: string
  description: string | null
  schedule: string | null
  created_at: string
  updated_at: string
}
