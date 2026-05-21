package models

type EntityDataRequest struct {
	Data map[string]any `json:"data"`
}

type StudentUpdateRequest struct {
	NumeroIdentificacion string         `json:"numero_identificacion"`
	Data                 map[string]any `json:"data"`
}

type StudentDeleteRequest struct {
	NumeroIdentificacion string `json:"numero_identificacion"`
}

type StudentExistsRequest struct {
	NumeroIdentificacion string `json:"numero_identificacion"`
}

type ProfessorCreateRequest struct {
	TipoIdentificacion         string `json:"tipo_identificacion"`
	NumeroIdentificacion       string `json:"numero_identificacion"`
	Nombres                    string `json:"nombres"`
	Apellidos                  string `json:"apellidos"`
	Telefono                   string `json:"telefono"`
	Direccion                  string `json:"direccion"`
	Barrio                     string `json:"barrio"`
	NombreContactoEmergencia   string `json:"nombre_contacto_emergencia"`
	TelefonoContactoEmergencia string `json:"telefono_contacto_emergencia"`
	EPS                        string `json:"eps"`
	Email                      string `json:"email"`
}

type ProfessorUpdateRequest struct {
	NumeroIdentificacion string         `json:"numero_identificacion"`
	Data                 map[string]any `json:"data"`
}

type ProfessorDeleteRequest struct {
	NumeroIdentificacion string `json:"numero_identificacion"`
}

type ProfessorExistsRequest struct {
	NumeroIdentificacion string `json:"numero_identificacion"`
}

type CourseUpdateRequest struct {
	IDCurso int            `json:"id_curso"`
	Data    map[string]any `json:"data"`
}

type CourseDeleteRequest struct {
	IDCurso int `json:"id_curso"`
}

type CourseExistsRequest struct {
	IDCurso int `json:"id_curso"`
}

type ParticipantLookupRequest struct {
	ParticipantIDs []string `json:"participant_ids"`
}

type ParticipantMutationRequest struct {
	IDCurso        int      `json:"id_curso"`
	ParticipantIDs []string `json:"participant_ids"`
}

type AttendanceSaveRow struct {
	NumeroIdentificacion string  `json:"numero_identificacion"`
	Asistio              bool    `json:"asistio"`
	Saldo                *string `json:"saldo"`
	MetodoPago           *string `json:"metodo_pago"`
	MarcadoEn            *string `json:"marcado_en"`
}

type AttendanceSaveRequest struct {
	IDCurso          int                 `json:"id_curso"`
	Date             string              `json:"date"`
	Rows             []AttendanceSaveRow `json:"rows"`
	SaveTimestampISO *string             `json:"save_timestamp_iso"`
	RegistradoPor    *string             `json:"registrado_por"`
}

type ProcessStudentPaymentRequest struct {
	NumeroIdentificacion string  `json:"numero_identificacion"`
	RegistradoPor        string  `json:"registrado_por"`
	MetodoPago           string  `json:"metodo_pago"`
	Modalidad            string  `json:"modalidad"`
	Clases               int     `json:"clases"`
	Notas                *string `json:"notas"`
	IDCurso              *int    `json:"id_curso"`
}

type ManualStudentPaymentStatusUpdateRequest struct {
	NumeroIdentificacion string  `json:"numero_identificacion"`
	ClasesAdeudadas      int     `json:"clases_adeudadas"`
	ClasesAdelantadas    int     `json:"clases_adelantadas"`
	Notas                *string `json:"notas"`
}

type AttendanceDeleteRequest struct {
	IDCurso int    `json:"id_curso"`
	Date    string `json:"date"`
}

type PersonLookupByIDRequest struct {
	NumeroIdentificacion string `json:"numero_identificacion"`
}

type ResolveAccessRequest struct {
	UserID       string         `json:"user_id"`
	Email        string         `json:"email"`
	UserMetadata map[string]any `json:"user_metadata"`
}

type AuthSignInRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthSignUpRequest struct {
	Email           string         `json:"email"`
	Password        string         `json:"password"`
	Metadata        map[string]any `json:"metadata"`
	EmailRedirectTo *string        `json:"email_redirect_to"`
}

type AuthRecoverRequest struct {
	Email      string  `json:"email"`
	RedirectTo *string `json:"redirect_to"`
}

type AuthVerifyOTPRequest struct {
	Type      string `json:"type"`
	TokenHash string `json:"token_hash"`
}

type AuthAccessTokenRequest struct {
	AccessToken string `json:"access_token"`
}

type AuthUpdatePasswordRequest struct {
	AccessToken string         `json:"access_token"`
	Password    string         `json:"password"`
	Data        map[string]any `json:"data"`
}

type CourseMaterialsSnapshotRequest struct {
	IDCurso int    `json:"id_curso"`
	UserID  string `json:"user_id"`
}

type CourseMaterialCreateFolderRequest struct {
	IDCurso        int    `json:"id_curso"`
	ParentFolderID *int   `json:"parent_folder_id"`
	Name           string `json:"name"`
	UserID         string `json:"user_id"`
}

type CourseMaterialDeleteFileRequest struct {
	ID     int    `json:"id"`
	UserID string `json:"user_id"`
}

type CourseMaterialCreateYouTubeLinkRequest struct {
	IDCurso  int    `json:"id_curso"`
	FolderID int    `json:"folder_id"`
	URL      string `json:"url"`
	Title    string `json:"title"`
	UserID   string `json:"user_id"`
}

type ManagedAuthUserParams struct {
	Email                string
	Password             string
	Role                 string
	Nombres              string
	Apellidos            string
	TipoIdentificacion   string
	NumeroIdentificacion string
	ApprovedByAdmin      bool
}

type PersonCourseInfo struct {
	IDCurso     int     `json:"id_curso"`
	NombreCurso string  `json:"nombre_curso"`
	NivelCurso  string  `json:"nivel_curso"`
	Salon       *string `json:"salon"`
	HoraInicio  string  `json:"hora_inicio"`
	HoraFin     string  `json:"hora_fin"`
}

type PersonRecord struct {
	Role                 string             `json:"role"`
	TipoIdentificacion   *string            `json:"tipo_identificacion"`
	NumeroIdentificacion string             `json:"numero_identificacion"`
	Nombres              string             `json:"nombres"`
	Apellidos            string             `json:"apellidos"`
	Cursos               []PersonCourseInfo `json:"cursos"`
}
