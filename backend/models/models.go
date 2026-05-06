package models

import "encoding/json"

// EncryptedPayload represents an AES-GCM encrypted value with IV and ciphertext.
type EncryptedPayload struct {
    IV         string `json:"iv"`         // base64-encoded IV (12 bytes)
    Ciphertext string `json:"ciphertext"` // base64-encoded ciphertext with GCM tag
}

type StudentEnrollRequest struct {
    TipoIdentificacion    string   `json:"tipo_identificacion"`
    NumeroIdentificacion  string   `json:"numero_identificacion"`
    NoMatricula           *string  `json:"no_matricula"`
    Nombres               string   `json:"nombres"`
    Apellidos             string   `json:"apellidos"`
    Email                 *string  `json:"email"`
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
    ValorApoyoSemanal     float64          `json:"valor_apoyo_semanal"`
    // Old plaintext fields (for backward compatibility; prefer encrypted versions)
    HuellaIndiceDerecho   *string          `json:"huella_indice_derecho"`
    HuellaIndiceIzquierdo *string          `json:"huella_indice_izquierdo"`
    // New encrypted fields (AES-GCM encrypted PNG)
    HuellaIndiceDerecho_Encrypted   *EncryptedPayload `json:"huella_indice_derecho_encrypted"`
    HuellaIndiceIzquierdo_Encrypted *EncryptedPayload `json:"huella_indice_izquierdo_encrypted"`
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
