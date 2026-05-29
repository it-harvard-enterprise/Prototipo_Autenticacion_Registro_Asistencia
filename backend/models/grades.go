package models

type AcademicPeriodCreateRequest struct {
	Year      int     `json:"year"`
	Term      int     `json:"term"`
	CreatedBy *string `json:"created_by"`
}

type GradeSaveRow struct {
	NumeroIdentificacion          string   `json:"numero_identificacion"`
	InglesSpeaking1               *float64 `json:"ingles_speaking_1"`
	InglesSpeaking2               *float64 `json:"ingles_speaking_2"`
	InglesListening1              *float64 `json:"ingles_listening_1"`
	InglesListening2              *float64 `json:"ingles_listening_2"`
	InglesWriting1                *float64 `json:"ingles_writing_1"`
	InglesWriting2                *float64 `json:"ingles_writing_2"`
	InglesReading1                *float64 `json:"ingles_reading_1"`
	InglesReading2                *float64 `json:"ingles_reading_2"`
	InglesGrammar1                *float64 `json:"ingles_grammar_1"`
	InglesGrammar2                *float64 `json:"ingles_grammar_2"`
	InglesDefinitiva              *float64 `json:"ingles_definitiva"`
	InglesComentariosDocente      *string  `json:"ingles_comentarios_docente"`
	MatematicasPro                *float64 `json:"matematicas_pro"`
	MatematicasSol                *float64 `json:"matematicas_sol"`
	MatematicasCom                *float64 `json:"matematicas_com"`
	MatematicasRaz                *float64 `json:"matematicas_raz"`
	MatematicasDefinitiva         *float64 `json:"matematicas_definitiva"`
	MatematicasComentariosDocente *string  `json:"matematicas_comentarios_docente"`
	SistemasDefinitiva            *float64 `json:"sistemas_definitiva"`
	SistemasNotasDocente          *string  `json:"sistemas_notas_docente"`
	ComentariosGeneralesDocente   *string  `json:"comentarios_generales_docente"`
}

type GradeSaveRequest struct {
	IDCurso           int            `json:"id_curso"`
	PeriodID          int64          `json:"period_id"`
	Rows              []GradeSaveRow `json:"rows"`
	UpdatedBy         *string        `json:"updated_by"`
	UpdateDefinitivas bool           `json:"update_definitivas"`
}

type ProfessorSignatureUpdateRequest struct {
	NumeroIdentificacion string  `json:"numero_identificacion"`
	SignatureDataURL     *string `json:"signature_data_url"`
	UpdatedBy            *string `json:"updated_by"`
}

type GradeReportRequest struct {
	IDCurso              int     `json:"id_curso"`
	PeriodID             int64   `json:"period_id"`
	NumeroIdentificacion *string `json:"numero_identificacion"`
	GeneratedBy          *string `json:"generated_by"`
}
