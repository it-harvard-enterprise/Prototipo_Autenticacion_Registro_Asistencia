package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"fingerprint-backend/models"
	"fingerprint-backend/services"
	"github.com/gin-gonic/gin"
)

func jsonError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"success": false, "error": message})
}

func parseIntParam(c *gin.Context, key string) (int, bool) {
	value := strings.TrimSpace(c.Param(key))
	parsed, err := strconv.Atoi(value)
	if err != nil {
		jsonError(c, http.StatusBadRequest, key+" invalido")
		return 0, false
	}
	return parsed, true
}

func parseIntQuery(c *gin.Context, key string) (int, bool) {
	value := strings.TrimSpace(c.Query(key))
	parsed, err := strconv.Atoi(value)
	if err != nil {
		jsonError(c, http.StatusBadRequest, key+" invalido")
		return 0, false
	}
	return parsed, true
}

func normalizeOptionalUpper(value *string) any {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return strings.ToUpper(trimmed)
}

func buildStudentInsertPayload(app *services.App, req *models.StudentEnrollRequest) (map[string]any, error) {
	req.NumeroIdentificacion = strings.ToUpper(strings.TrimSpace(req.NumeroIdentificacion))
	req.TipoIdentificacion = strings.ToUpper(strings.TrimSpace(req.TipoIdentificacion))
	req.Nombres = strings.ToUpper(strings.TrimSpace(req.Nombres))
	req.Apellidos = strings.ToUpper(strings.TrimSpace(req.Apellidos))
	req.Grado = strings.ToUpper(strings.TrimSpace(req.Grado))
	req.CoordinadorAcademico = strings.ToUpper(strings.TrimSpace(req.CoordinadorAcademico))
	req.MedioPagoMatricula = strings.ToUpper(strings.TrimSpace(req.MedioPagoMatricula))

	if req.TipoIdentificacion == "" || req.NumeroIdentificacion == "" || req.Nombres == "" || req.Apellidos == "" || req.Grado == "" {
		return nil, errors.New("tipo_identificacion, numero_identificacion, nombres, apellidos y grado validos son requeridos")
	}

	var rightPNG, leftPNG *string
	if req.HuellaIndiceDerecho_Encrypted != nil {
		decrypted, err := app.DecryptPNG(req.HuellaIndiceDerecho_Encrypted)
		if err != nil {
			return nil, err
		}
		rightPNG = &decrypted
	} else if req.HuellaIndiceDerecho != nil {
		rightPNG = req.HuellaIndiceDerecho
	}

	if req.HuellaIndiceIzquierdo_Encrypted != nil {
		decrypted, err := app.DecryptPNG(req.HuellaIndiceIzquierdo_Encrypted)
		if err != nil {
			return nil, err
		}
		leftPNG = &decrypted
	} else if req.HuellaIndiceIzquierdo != nil {
		leftPNG = req.HuellaIndiceIzquierdo
	}

	rightTemplate, err := app.ResolveStoredFingerprintTemplate(rightPNG)
	if err != nil {
		return nil, err
	}

	leftTemplate, err := app.ResolveStoredFingerprintTemplate(leftPNG)
	if err != nil {
		return nil, err
	}

	var rightEncrypted any
	if rightTemplate != services.DefaultFingerprint {
		encPayload, err := app.EncryptTemplate(rightTemplate)
		if err != nil {
			return nil, err
		}
		rightEncrypted = encPayload
	}

	var leftEncrypted any
	if leftTemplate != services.DefaultFingerprint {
		encPayload, err := app.EncryptTemplate(leftTemplate)
		if err != nil {
			return nil, err
		}
		leftEncrypted = encPayload
	}

	payload := map[string]any{
		"tipo_identificacion":     req.TipoIdentificacion,
		"numero_identificacion":   req.NumeroIdentificacion,
		"no_matricula":            normalizeOptionalUpper(req.NoMatricula),
		"nombres":                 req.Nombres,
		"apellidos":               req.Apellidos,
		"email":                   app.NormalizeOptional(req.Email),
		"grado":                   req.Grado,
		"telefono":                normalizeOptionalUpper(req.Telefono),
		"direccion":               normalizeOptionalUpper(req.Direccion),
		"barrio":                  normalizeOptionalUpper(req.Barrio),
		"nombre_acudiente":        normalizeOptionalUpper(req.NombreAcudiente),
		"telefono_acudiente":      normalizeOptionalUpper(req.TelefonoAcudiente),
		"eps":                     normalizeOptionalUpper(req.EPS),
		"coordinador_academico":   req.CoordinadorAcademico,
		"programa":                normalizeOptionalUpper(req.Programa),
		"fecha_inicio":            app.NormalizeOptional(req.FechaInicio),
		"fecha_matricula":         app.NormalizeOptional(req.FechaMatricula),
		"valor_matricula":         req.ValorMatricula,
		"medio_pago_matricula":    req.MedioPagoMatricula,
		"valor_apoyo_semanal":     req.ValorApoyoSemanal,
		"huella_indice_derecho":   rightEncrypted,
		"huella_indice_izquierdo": leftEncrypted,
	}

	return payload, nil
}

func CreateStudentHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.StudentEnrollRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		numeroIdentificacion := strings.ToUpper(strings.TrimSpace(req.NumeroIdentificacion))
		tipoIdentificacion := strings.ToUpper(strings.TrimSpace(req.TipoIdentificacion))
		email := strings.ToLower(strings.TrimSpace(""))
		if req.Email != nil {
			email = strings.ToLower(strings.TrimSpace(*req.Email))
		}

		if numeroIdentificacion == "" {
			jsonError(c, http.StatusBadRequest, "El número de identificación es obligatorio.")
			return
		}
		if email == "" {
			jsonError(c, http.StatusBadRequest, "El correo electrónico del estudiante es obligatorio.")
			return
		}

		userID, alreadyRegistered, err := app.CreateManagedAuthUser(c.Request.Context(), models.ManagedAuthUserParams{
			Email:                email,
			Password:             numeroIdentificacion,
			Role:                 "estudiante",
			Nombres:              req.Nombres,
			Apellidos:            req.Apellidos,
			TipoIdentificacion:   tipoIdentificacion,
			NumeroIdentificacion: numeroIdentificacion,
			ApprovedByAdmin:      true,
		})
		if err != nil {
			if alreadyRegistered {
				jsonError(c, http.StatusBadRequest, "El correo ya está registrado en autenticación.")
				return
			}
			jsonError(c, http.StatusBadRequest, err.Error())
			return
		}

		payload, err := buildStudentInsertPayload(app, &req)
		if err != nil {
			_ = app.DeleteManagedAuthUser(c.Request.Context(), userID)
			jsonError(c, http.StatusBadRequest, "Error preparando el estudiante: "+err.Error())
			return
		}
		payload["auth_user_id"] = userID

		rows, status, err := app.InsertStudent(c.Request.Context(), payload)
		if err != nil {
			_ = app.DeleteManagedAuthUser(c.Request.Context(), userID)
			if status == http.StatusConflict {
				jsonError(c, http.StatusConflict, "Error: En la base datos ya existe un usuario con el mismo número de identificación.")
				return
			}
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		if len(rows) == 0 {
			_ = app.DeleteManagedAuthUser(c.Request.Context(), userID)
			jsonError(c, http.StatusInternalServerError, "No se recibio respuesta de Supabase al crear el estudiante")
			return
		}

		created := rows[0]
		c.JSON(http.StatusCreated, gin.H{
			"success":                  true,
			"data":                     created,
			"auth_user_id":             userID,
			"requires_password_change": true,
		})
	}
}

func ListStudentsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		students, err := app.ListStudents(c.Request.Context())
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": students})
	}
}

func GetStudentByNumeroHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		numero := c.Param("numero_identificacion")
		student, status, err := app.GetStudentByNumero(c.Request.Context(), numero)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": student})
	}
}

func StudentExistsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.StudentExistsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		exists, err := app.StudentExists(c.Request.Context(), req.NumeroIdentificacion)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "exists": exists})
	}
}

func UpdateStudentHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.StudentUpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		student, status, err := app.UpdateStudentRecord(c.Request.Context(), req.NumeroIdentificacion, req.Data)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": student})
	}
}

func DeleteStudentHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.StudentDeleteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		_, err := app.DeleteStudentRecord(c.Request.Context(), req.NumeroIdentificacion)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func CreateProfessorHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ProfessorCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		numeroIdentificacion := strings.ToUpper(strings.TrimSpace(req.NumeroIdentificacion))
		email := strings.ToLower(strings.TrimSpace(req.Email))
		if numeroIdentificacion == "" {
			jsonError(c, http.StatusBadRequest, "El número de identificación es obligatorio.")
			return
		}
		if email == "" {
			jsonError(c, http.StatusBadRequest, "El correo electrónico del profesor es obligatorio.")
			return
		}

		userID, alreadyRegistered, err := app.CreateManagedAuthUser(c.Request.Context(), models.ManagedAuthUserParams{
			Email:                email,
			Password:             numeroIdentificacion,
			Role:                 "profesor",
			Nombres:              req.Nombres,
			Apellidos:            req.Apellidos,
			TipoIdentificacion:   req.TipoIdentificacion,
			NumeroIdentificacion: numeroIdentificacion,
			ApprovedByAdmin:      true,
		})
		if err != nil {
			if alreadyRegistered {
				jsonError(c, http.StatusBadRequest, "El correo ya está registrado en autenticación.")
				return
			}
			jsonError(c, http.StatusBadRequest, err.Error())
			return
		}

		created, status, err := app.CreateProfessorRecord(c.Request.Context(), req, userID)
		if err != nil {
			_ = app.DeleteManagedAuthUser(c.Request.Context(), userID)
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"success": true,
			"data":    created,
		})
	}
}

func ListProfessorsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		professors, err := app.ListProfessors(c.Request.Context())
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": professors})
	}
}

func GetProfessorByNumeroHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		numero := c.Param("numero_identificacion")
		professor, status, err := app.GetProfessorByNumero(c.Request.Context(), numero)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": professor})
	}
}

func ProfessorExistsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ProfessorExistsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		exists, err := app.ProfessorExists(c.Request.Context(), req.NumeroIdentificacion)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "exists": exists})
	}
}

func UpdateProfessorHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ProfessorUpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		professor, status, err := app.UpdateProfessorRecord(c.Request.Context(), req.NumeroIdentificacion, req.Data)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": professor})
	}
}

func DeleteProfessorHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ProfessorDeleteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		_, err := app.DeleteProfessorRecord(c.Request.Context(), req.NumeroIdentificacion)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func ListCoursesHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		courses, err := app.ListCourses(c.Request.Context())
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": courses})
	}
}

func GetCourseByIDHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntParam(c, "id_curso")
		if !ok {
			return
		}

		course, status, err := app.GetCourseByID(c.Request.Context(), idCurso)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": course})
	}
}

func CourseExistsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CourseExistsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		exists, err := app.CourseExists(c.Request.Context(), req.IDCurso)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "exists": exists})
	}
}

func CreateCourseHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var data map[string]any
		if err := c.ShouldBindJSON(&data); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		course, status, err := app.CreateCourseRecord(c.Request.Context(), data)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusCreated, gin.H{"success": true, "data": course})
	}
}

func UpdateCourseHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CourseUpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		course, status, err := app.UpdateCourseRecord(c.Request.Context(), req.IDCurso, req.Data)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": course})
	}
}

func DeleteCourseHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CourseDeleteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		_, err := app.DeleteCourseRecord(c.Request.Context(), req.IDCurso)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func ListCourseOptionsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		options, err := app.ListCourseOptions(c.Request.Context())
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": options})
	}
}

func LookupParticipantsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ParticipantLookupRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		rows, status, err := app.LookupParticipantsByIdentification(c.Request.Context(), req.ParticipantIDs)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": rows})
	}
}

func AssociateParticipantsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ParticipantMutationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		result, status, err := app.AssociateParticipantsToCourse(c.Request.Context(), req.IDCurso, req.ParticipantIDs)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
	}
}

func DissociateParticipantsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ParticipantMutationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		result, status, err := app.DissociateParticipantsFromCourse(c.Request.Context(), req.IDCurso, req.ParticipantIDs)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
	}
}

func GetParticipantsByCourseIDHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntParam(c, "id_curso")
		if !ok {
			return
		}

		participants, status, err := app.GetParticipantsByCourseID(c.Request.Context(), idCurso)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": participants})
	}
}

func GetStudentsByCourseIDHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntParam(c, "id_curso")
		if !ok {
			return
		}

		students, status, err := app.GetStudentsByCourseID(c.Request.Context(), idCurso)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": students})
	}
}

func GetAttendanceRosterHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntQuery(c, "id_curso")
		if !ok {
			return
		}
		date := strings.TrimSpace(c.Query("date"))
		if date == "" {
			jsonError(c, http.StatusBadRequest, "date es requerido")
			return
		}

		rows, status, err := app.GetAttendanceRoster(c.Request.Context(), idCurso, date)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": rows})
	}
}

func SaveAttendanceHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AttendanceSaveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		result, status, err := app.SaveAttendance(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
	}
}

func DeleteAttendanceHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AttendanceDeleteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		result, status, err := app.DeleteAttendance(c.Request.Context(), req.IDCurso, req.Date)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
	}
}

func ExportAttendanceHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntQuery(c, "id_curso")
		if !ok {
			return
		}
		date := strings.TrimSpace(c.Query("date"))
		if date == "" {
			jsonError(c, http.StatusBadRequest, "date es requerido")
			return
		}

		rows, status, err := app.GetAttendanceExport(c.Request.Context(), idCurso, date)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": rows})
	}
}

func DashboardSummaryHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		summary, err := app.GetDashboardSummary(c.Request.Context())
		if err != nil {
			jsonError(c, http.StatusInternalServerError, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": summary})
	}
}

func PersonLookupByIDHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		numero := c.Param("numero_identificacion")
		person, status, err := app.LookupPersonByID(c.Request.Context(), numero)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": person})
	}
}

func ResolveAccessHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ResolveAccessRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		resolved, status, err := app.ResolveAccessByUserID(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": resolved})
	}
}

func AuthSignInHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AuthSignInRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.AuthSignIn(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func AuthSignUpHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AuthSignUpRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.AuthSignUp(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func AuthRecoverHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AuthRecoverRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.AuthRecover(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func AuthVerifyOTPHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AuthVerifyOTPRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.AuthVerifyOTP(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func AuthSessionUserHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AuthAccessTokenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.AuthSessionUser(c.Request.Context(), req.AccessToken)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func AuthUpdatePasswordHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AuthUpdatePasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.AuthUpdatePassword(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func AuthSignOutHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AuthAccessTokenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.AuthSignOut(c.Request.Context(), req.AccessToken)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}
