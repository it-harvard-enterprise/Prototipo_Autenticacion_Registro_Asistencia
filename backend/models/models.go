package models

import "encoding/json"

type StudentEnrollRequest struct {
    TipoIdentificacion    string   `json:"tipo_identificacion"`
    NumeroIdentificacion  string   `json:"numero_identificacion"`
    NoMatricula           *string  `json:"no_matricula"`
    Nombres               string   `json:"nombres"`
    Apellidos             string   `json:"apellidos"`
    Grado                 string   `json:"grado"`
    Telefono              *string  `json:"telefono"`
    Direccion             *string  `json:"direccion"`
    Barrio                *string  `json:"barrio"`
    NombreAcudiente       *string  `json:"nombre_acudiente"`
    TelefonoAcudiente     *string  `json:"telefono_acudiente"`
    EPS                   *string  `json:"eps"`
    CoordinadorAcademico  string   `json:"coordinador_academico"`
    Programa              *string  `json:"programa"`
    FechaInicio           *string  `json:"fecha_inicio"`
    FechaMatricula        *string  `json:"fecha_matricula"`
    ValorMatricula        *float64 `json:"valor_matricula"`
    MedioPagoMatricula    string   `json:"medio_pago_matricula"`
    ValorApoyoSemanal     float64  `json:"valor_apoyo_semanal"`
    HuellaIndiceDerecho   *string  `json:"huella_indice_derecho"`
    HuellaIndiceIzquierdo *string  `json:"huella_indice_izquierdo"`
}

type AttendanceIdentifyRequest struct {
    IDCurso             int    `json:"id_curso"`
    FingerprintTemplate string `json:"fingerprint_template"`
}

type StudentRecord struct {
    NumeroIdentificacion  string  `json:"numero_identificacion"`
    Nombres               string  `json:"nombres"`
    Apellidos             string  `json:"apellidos"`
    HuellaIndiceDerecho   *string `json:"huella_indice_derecho,omitempty"`
    HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo,omitempty"`
    CreatedAt             string  `json:"created_at,omitempty"`
}

// internal helper types used by services
type enrollmentRow struct {
    NumeroIdentificacion string          `json:"numero_identificacion"`
    Estudiantes          json.RawMessage `json:"estudiantes"`
}

type embeddedStudent struct {
    HuellaIndiceDerecho   *string `json:"huella_indice_derecho"`
    HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo"`
}
