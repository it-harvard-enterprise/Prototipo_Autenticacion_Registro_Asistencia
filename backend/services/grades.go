package services

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"fingerprint-backend/models"
	"github.com/go-pdf/fpdf"
)

type academicPeriodRecord struct {
	ID           int64
	PeriodLabel  string
	PeriodYear   int
	PeriodTerm   int
	FechaInicio  string
	FechaFin     string
	AutoGenerado bool
}

type gradeCourseRecord struct {
	IDCurso     int
	NombreCurso string
	HoraInicio  string
	HoraFin     string
	Salon       string
}

type gradeProfessorRecord struct {
	NumeroIdentificacion string
	TipoIdentificacion   string
	Nombres              string
	Apellidos            string
	FirmaDataURL         string
}

type gradeStudentRecord struct {
	NumeroIdentificacion          string
	TipoIdentificacion            string
	Nombres                       string
	Apellidos                     string
	InglesSpeaking1               *float64
	InglesSpeaking2               *float64
	InglesListening1              *float64
	InglesListening2              *float64
	InglesWriting1                *float64
	InglesWriting2                *float64
	InglesReading1                *float64
	InglesReading2                *float64
	InglesGrammar1                *float64
	InglesGrammar2                *float64
	InglesDefinitiva              *float64
	InglesComentariosDocente      string
	MatematicasPro                *float64
	MatematicasSol                *float64
	MatematicasCom                *float64
	MatematicasRaz                *float64
	MatematicasDefinitiva         *float64
	MatematicasComentariosDocente string
	SistemasDefinitiva            *float64
	SistemasNotasDocente          string
	ComentariosGeneralesDocente   string
}

type gradesRosterBundle struct {
	Period    academicPeriodRecord
	Course    gradeCourseRecord
	Professor *gradeProfessorRecord
	Students  []gradeStudentRecord
}

func periodLabel(year int, term int) string {
	return fmt.Sprintf("%04d-%d", year, term)
}

func firstSaturday(year int, month time.Month) time.Time {
	date := time.Date(year, month, 1, 0, 0, 0, 0, bogotaTZ)
	for date.Weekday() != time.Saturday {
		date = date.AddDate(0, 0, 1)
	}
	return date
}

func buildAcademicPeriodBounds(year int, term int) (time.Time, time.Time, error) {
	if year < 2000 || year > 3000 {
		return time.Time{}, time.Time{}, errors.New("year fuera de rango")
	}

	switch term {
	case 1:
		decSaturday := firstSaturday(year-1, time.December)
		junSaturday := firstSaturday(year, time.June)
		return decSaturday.AddDate(0, 0, 1), junSaturday, nil
	case 2:
		junSaturday := firstSaturday(year, time.June)
		decSaturday := firstSaturday(year, time.December)
		return junSaturday.AddDate(0, 0, 1), decSaturday, nil
	default:
		return time.Time{}, time.Time{}, errors.New("term invalido")
	}
}

func parseDateOnlyInBogota(raw string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, err
	}

	return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, bogotaTZ), nil
}

func nullableFloatFromAny(value any) *float64 {
	parsed, ok := asFloat(value)
	if !ok {
		return nil
	}

	rounded := math.Round(parsed*100) / 100
	return &rounded
}

func normalizeGradeValue(value *float64, fieldLabel string) (*float64, error) {
	if value == nil {
		return nil, nil
	}

	normalized := math.Round(*value*100) / 100
	if normalized < 0 || normalized > 5 {
		return nil, fmt.Errorf("%s debe estar entre 0.0 y 5.0", fieldLabel)
	}

	return &normalized, nil
}

func averageGrades(values ...*float64) *float64 {
	total := 0.0
	count := 0

	for _, value := range values {
		if value == nil {
			continue
		}
		total += *value
		count++
	}

	if count == 0 {
		return nil
	}

	avg := math.Round((total/float64(count))*100) / 100
	return &avg
}

func normalizeOptionalTextPointer(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func normalizeOptionalTextPointerAny(value *string) any {
	trimmed := normalizeOptionalTextPointer(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func formatGradeValue(value *float64) string {
	if value == nil {
		return "N/A"
	}
	return fmt.Sprintf("%.2f", *value)
}

func formatHourLabel(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) >= 5 {
		return trimmed[:5]
	}
	if trimmed == "" {
		return "N/A"
	}
	return trimmed
}

func parseAcademicPeriodRows(rows []map[string]any) []academicPeriodRecord {
	parsed := make([]academicPeriodRecord, 0, len(rows))

	for _, row := range rows {
		id, idOK := asInt(row["id"])
		label, labelOK := asString(row["period_label"])
		year, yearOK := asInt(row["period_year"])
		term, termOK := asInt(row["period_term"])
		inicio, inicioOK := asString(row["fecha_inicio"])
		fin, finOK := asString(row["fecha_fin"])
		if !idOK || !labelOK || !yearOK || !termOK || !inicioOK || !finOK {
			continue
		}

		autoGenerado, _ := asBool(row["auto_generado"])
		parsed = append(parsed, academicPeriodRecord{
			ID:           int64(id),
			PeriodLabel:  strings.TrimSpace(label),
			PeriodYear:   year,
			PeriodTerm:   term,
			FechaInicio:  strings.TrimSpace(inicio),
			FechaFin:     strings.TrimSpace(fin),
			AutoGenerado: autoGenerado,
		})
	}

	sort.Slice(parsed, func(i, j int) bool {
		if parsed[i].PeriodYear != parsed[j].PeriodYear {
			return parsed[i].PeriodYear > parsed[j].PeriodYear
		}
		return parsed[i].PeriodTerm > parsed[j].PeriodTerm
	})

	return parsed
}

func resolveSelectedPeriodID(periods []academicPeriodRecord) int64 {
	if len(periods) == 0 {
		return 0
	}

	today := time.Now().In(bogotaTZ)
	currentDate := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, bogotaTZ)

	for _, period := range periods {
		startDate, startErr := parseDateOnlyInBogota(period.FechaInicio)
		endDate, endErr := parseDateOnlyInBogota(period.FechaFin)
		if startErr != nil || endErr != nil {
			continue
		}

		if (currentDate.Equal(startDate) || currentDate.After(startDate)) &&
			(currentDate.Equal(endDate) || currentDate.Before(endDate)) {
			return period.ID
		}
	}

	return periods[0].ID
}

func (a *App) listAcademicPeriodRecords(ctx context.Context) ([]academicPeriodRecord, int, error) {
	query := url.Values{}
	query.Set("select", "id,period_label,period_year,period_term,fecha_inicio,fecha_fin,auto_generado")
	query.Set("order", "period_year.desc,period_term.desc")

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/periodos_academicos", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return parseAcademicPeriodRows(rows), http.StatusOK, nil
}

func (a *App) EnsureAcademicPeriods(ctx context.Context) (int, int, error) {
	periods, status, err := a.listAcademicPeriodRecords(ctx)
	if err != nil {
		return 0, status, err
	}

	existing := map[string]bool{}

	for _, period := range periods {
		label := periodLabel(period.PeriodYear, period.PeriodTerm)
		existing[label] = true
	}

	currentYear := time.Now().In(bogotaTZ).Year()
	targetStartYear := currentYear
	targetEndYear := currentYear + 5

	createdCount := 0

	for year := targetStartYear; year <= targetEndYear; year++ {
		for term := 1; term <= 2; term++ {
			label := periodLabel(year, term)
			if existing[label] {
				continue
			}

			fechaInicio, fechaFin, boundsErr := buildAcademicPeriodBounds(year, term)
			if boundsErr != nil {
				continue
			}

			payload := map[string]any{
				"period_label":  label,
				"period_year":   year,
				"period_term":   term,
				"fecha_inicio":  fechaInicio.Format("2006-01-02"),
				"fecha_fin":     fechaFin.Format("2006-01-02"),
				"auto_generado": true,
				"created_at":    time.Now().UTC().Format(time.RFC3339Nano),
				"updated_at":    time.Now().UTC().Format(time.RFC3339Nano),
			}

			_, insertStatus, insertErr := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/periodos_academicos", nil, payload, false)
			if insertErr != nil {
				if insertStatus == http.StatusConflict {
					existing[label] = true
					continue
				}
				return createdCount, insertStatus, insertErr
			}

			existing[label] = true
			createdCount++
		}
	}

	return createdCount, http.StatusOK, nil
}

func (a *App) GetAcademicPeriods(ctx context.Context) (map[string]any, int, error) {
	_, status, err := a.EnsureAcademicPeriods(ctx)
	if err != nil {
		return nil, status, err
	}

	periods, status, err := a.listAcademicPeriodRecords(ctx)
	if err != nil {
		return nil, status, err
	}

	rows := make([]map[string]any, 0, len(periods))
	for _, period := range periods {
		rows = append(rows, map[string]any{
			"id":            period.ID,
			"period_label":  period.PeriodLabel,
			"period_year":   period.PeriodYear,
			"period_term":   period.PeriodTerm,
			"fecha_inicio":  period.FechaInicio,
			"fecha_fin":     period.FechaFin,
			"auto_generado": period.AutoGenerado,
		})
	}

	selectedID := resolveSelectedPeriodID(periods)

	return map[string]any{
		"periods":            rows,
		"selected_period_id": selectedID,
	}, http.StatusOK, nil
}

func (a *App) CreateAcademicPeriod(ctx context.Context, year int, term int, createdBy string) (map[string]any, int, error) {
	if year < 2000 || year > 3000 {
		return nil, http.StatusBadRequest, errors.New("year invalido")
	}
	if term != 1 && term != 2 {
		return nil, http.StatusBadRequest, errors.New("term invalido")
	}

	label := periodLabel(year, term)
	fechaInicio, fechaFin, err := buildAcademicPeriodBounds(year, term)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	existingQuery := url.Values{}
	existingQuery.Set("select", "id,period_label,period_year,period_term,fecha_inicio,fecha_fin,auto_generado")
	existingQuery.Set("period_year", fmt.Sprintf("eq.%d", year))
	existingQuery.Set("period_term", fmt.Sprintf("eq.%d", term))
	existingQuery.Set("limit", "1")

	existingBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/periodos_academicos", existingQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	existingRows, err := unmarshalRows(existingBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(existingRows) > 0 {
		_, _, _ = a.EnsureAcademicPeriods(ctx)
		return existingRows[0], http.StatusOK, nil
	}

	var createdByValue any
	if strings.TrimSpace(createdBy) != "" {
		createdByValue = strings.TrimSpace(createdBy)
	}

	insertPayload := map[string]any{
		"period_label":  label,
		"period_year":   year,
		"period_term":   term,
		"fecha_inicio":  fechaInicio.Format("2006-01-02"),
		"fecha_fin":     fechaFin.Format("2006-01-02"),
		"auto_generado": false,
		"creado_por":    createdByValue,
	}

	insertQuery := url.Values{}
	insertQuery.Set("select", "id,period_label,period_year,period_term,fecha_inicio,fecha_fin,auto_generado")

	insertBody, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/periodos_academicos", insertQuery, insertPayload, true)
	if err != nil {
		if status == http.StatusConflict {
			conflictBody, conflictStatus, conflictErr := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/periodos_academicos", existingQuery, nil, false)
			if conflictErr != nil {
				return nil, conflictStatus, conflictErr
			}
			conflictRows, decodeErr := unmarshalRows(conflictBody)
			if decodeErr != nil {
				return nil, http.StatusInternalServerError, decodeErr
			}
			if len(conflictRows) > 0 {
				_, _, _ = a.EnsureAcademicPeriods(ctx)
				return conflictRows[0], http.StatusOK, nil
			}
		}
		return nil, status, err
	}

	createdRows, err := unmarshalRows(insertBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(createdRows) == 0 {
		return nil, http.StatusInternalServerError, errors.New("no se pudo crear el periodo academico")
	}

	_, _, _ = a.EnsureAcademicPeriods(ctx)
	return createdRows[0], http.StatusCreated, nil
}

func (a *App) getAcademicPeriodByID(ctx context.Context, periodID int64) (academicPeriodRecord, int, error) {
	if periodID <= 0 {
		return academicPeriodRecord{}, http.StatusBadRequest, errors.New("period_id invalido")
	}

	query := url.Values{}
	query.Set("select", "id,period_label,period_year,period_term,fecha_inicio,fecha_fin,auto_generado")
	query.Set("id", fmt.Sprintf("eq.%d", periodID))
	query.Set("limit", "1")

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/periodos_academicos", query, nil, false)
	if err != nil {
		return academicPeriodRecord{}, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return academicPeriodRecord{}, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return academicPeriodRecord{}, http.StatusNotFound, errors.New("periodo academico no encontrado")
	}

	periods := parseAcademicPeriodRows(rows)
	if len(periods) == 0 {
		return academicPeriodRecord{}, http.StatusInternalServerError, errors.New("periodo academico invalido")
	}

	return periods[0], http.StatusOK, nil
}

func (a *App) loadGradesRosterBundle(ctx context.Context, idCurso int, periodID int64) (gradesRosterBundle, int, error) {
	if idCurso <= 0 {
		return gradesRosterBundle{}, http.StatusBadRequest, errors.New("id_curso invalido")
	}

	period, status, err := a.getAcademicPeriodByID(ctx, periodID)
	if err != nil {
		return gradesRosterBundle{}, status, err
	}

	course, status, err := a.GetCourseByID(ctx, idCurso)
	if err != nil {
		return gradesRosterBundle{}, status, err
	}

	courseRecord := gradeCourseRecord{IDCurso: idCurso}
	if nombreCurso, ok := asString(course["nombre_curso"]); ok {
		courseRecord.NombreCurso = strings.TrimSpace(nombreCurso)
	}
	if horaInicio, ok := asString(course["hora_inicio"]); ok {
		courseRecord.HoraInicio = strings.TrimSpace(horaInicio)
	}
	if horaFin, ok := asString(course["hora_fin"]); ok {
		courseRecord.HoraFin = strings.TrimSpace(horaFin)
	}
	if salon, ok := asString(course["salon"]); ok {
		courseRecord.Salon = strings.TrimSpace(salon)
	}

	professorQuery := url.Values{}
	professorQuery.Set("select", "numero_identificacion,profesores(numero_identificacion,tipo_identificacion,nombres,apellidos,firma_docente_data_url)")
	professorQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	professorQuery.Set("order", "numero_identificacion.asc")

	professorsBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_profesores", professorQuery, nil, false)
	if err != nil {
		return gradesRosterBundle{}, status, err
	}

	professorRows, err := unmarshalRows(professorsBody)
	if err != nil {
		return gradesRosterBundle{}, http.StatusInternalServerError, err
	}

	var professorRecord *gradeProfessorRecord
	if len(professorRows) > 0 {
		embedded := extractEmbeddedRow(professorRows[0]["profesores"])
		if len(embedded) > 0 {
			candidate := &gradeProfessorRecord{}
			if numero, ok := asString(embedded["numero_identificacion"]); ok {
				candidate.NumeroIdentificacion = strings.TrimSpace(numero)
			}
			if tipo, ok := asString(embedded["tipo_identificacion"]); ok {
				candidate.TipoIdentificacion = strings.TrimSpace(tipo)
			}
			if nombres, ok := asString(embedded["nombres"]); ok {
				candidate.Nombres = strings.TrimSpace(nombres)
			}
			if apellidos, ok := asString(embedded["apellidos"]); ok {
				candidate.Apellidos = strings.TrimSpace(apellidos)
			}
			if firma, ok := asString(embedded["firma_docente_data_url"]); ok {
				candidate.FirmaDataURL = strings.TrimSpace(firma)
			}
			professorRecord = candidate
		}
	}

	enrolledQuery := url.Values{}
	enrolledQuery.Set("select", "numero_identificacion,estudiantes(numero_identificacion,tipo_identificacion,nombres,apellidos)")
	enrolledQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	enrolledQuery.Set("order", "numero_identificacion.asc")

	enrolledBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", enrolledQuery, nil, false)
	if err != nil {
		return gradesRosterBundle{}, status, err
	}

	enrolledRows, err := unmarshalRows(enrolledBody)
	if err != nil {
		return gradesRosterBundle{}, http.StatusInternalServerError, err
	}

	studentIDs := make([]string, 0, len(enrolledRows))
	studentsBasic := map[string]map[string]any{}
	for _, row := range enrolledRows {
		numero, ok := asString(row["numero_identificacion"])
		if !ok {
			continue
		}
		numero = strings.TrimSpace(numero)
		if numero == "" {
			continue
		}
		studentIDs = append(studentIDs, numero)
		studentsBasic[numero] = extractEmbeddedRow(row["estudiantes"])
	}

	gradesByStudent := map[string]map[string]any{}
	if len(studentIDs) > 0 {
		gradesQuery := url.Values{}
		gradesQuery.Set("select", "*")
		gradesQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
		gradesQuery.Set("period_id", fmt.Sprintf("eq.%d", periodID))
		gradesQuery.Set("numero_identificacion", buildStringInFilter(normalizeIdentificationIDs(studentIDs)))

		gradesBody, gradesStatus, gradesErr := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/calificaciones_estudiantes", gradesQuery, nil, false)
		if gradesErr != nil {
			return gradesRosterBundle{}, gradesStatus, gradesErr
		}

		gradeRows, decodeErr := unmarshalRows(gradesBody)
		if decodeErr != nil {
			return gradesRosterBundle{}, http.StatusInternalServerError, decodeErr
		}

		for _, gradeRow := range gradeRows {
			numero, ok := asString(gradeRow["numero_identificacion"])
			if !ok {
				continue
			}
			numero = strings.TrimSpace(numero)
			if numero == "" {
				continue
			}
			gradesByStudent[numero] = gradeRow
		}
	}

	students := make([]gradeStudentRecord, 0, len(studentIDs))
	for _, studentID := range studentIDs {
		basic := studentsBasic[studentID]
		grade := gradesByStudent[studentID]

		record := gradeStudentRecord{
			NumeroIdentificacion: studentID,
		}
		if tipo, ok := asString(basic["tipo_identificacion"]); ok {
			record.TipoIdentificacion = strings.TrimSpace(tipo)
		}
		if nombres, ok := asString(basic["nombres"]); ok {
			record.Nombres = strings.TrimSpace(nombres)
		}
		if apellidos, ok := asString(basic["apellidos"]); ok {
			record.Apellidos = strings.TrimSpace(apellidos)
		}

		record.InglesSpeaking1 = nullableFloatFromAny(grade["ingles_speaking_1"])
		record.InglesSpeaking2 = nullableFloatFromAny(grade["ingles_speaking_2"])
		record.InglesListening1 = nullableFloatFromAny(grade["ingles_listening_1"])
		record.InglesListening2 = nullableFloatFromAny(grade["ingles_listening_2"])
		record.InglesWriting1 = nullableFloatFromAny(grade["ingles_writing_1"])
		record.InglesWriting2 = nullableFloatFromAny(grade["ingles_writing_2"])
		record.InglesReading1 = nullableFloatFromAny(grade["ingles_reading_1"])
		record.InglesReading2 = nullableFloatFromAny(grade["ingles_reading_2"])
		record.InglesGrammar1 = nullableFloatFromAny(grade["ingles_grammar_1"])
		record.InglesGrammar2 = nullableFloatFromAny(grade["ingles_grammar_2"])
		record.InglesDefinitiva = nullableFloatFromAny(grade["ingles_definitiva"])
		record.MatematicasPro = nullableFloatFromAny(grade["matematicas_pro"])
		record.MatematicasSol = nullableFloatFromAny(grade["matematicas_sol"])
		record.MatematicasCom = nullableFloatFromAny(grade["matematicas_com"])
		record.MatematicasRaz = nullableFloatFromAny(grade["matematicas_raz"])
		record.MatematicasDefinitiva = nullableFloatFromAny(grade["matematicas_definitiva"])
		record.SistemasDefinitiva = nullableFloatFromAny(grade["sistemas_definitiva"])

		if value, ok := asString(grade["ingles_comentarios_docente"]); ok {
			record.InglesComentariosDocente = strings.TrimSpace(value)
		}
		if value, ok := asString(grade["matematicas_comentarios_docente"]); ok {
			record.MatematicasComentariosDocente = strings.TrimSpace(value)
		}
		if value, ok := asString(grade["sistemas_notas_docente"]); ok {
			record.SistemasNotasDocente = strings.TrimSpace(value)
		}
		if value, ok := asString(grade["comentarios_generales_docente"]); ok {
			record.ComentariosGeneralesDocente = strings.TrimSpace(value)
		}

		students = append(students, record)
	}

	sort.Slice(students, func(i, j int) bool {
		if students[i].Apellidos != students[j].Apellidos {
			return students[i].Apellidos < students[j].Apellidos
		}
		if students[i].Nombres != students[j].Nombres {
			return students[i].Nombres < students[j].Nombres
		}
		return students[i].NumeroIdentificacion < students[j].NumeroIdentificacion
	})

	return gradesRosterBundle{
		Period:    period,
		Course:    courseRecord,
		Professor: professorRecord,
		Students:  students,
	}, http.StatusOK, nil
}

func (a *App) GetGradesRoster(ctx context.Context, idCurso int, periodID int64) (map[string]any, int, error) {
	bundle, status, err := a.loadGradesRosterBundle(ctx, idCurso, periodID)
	if err != nil {
		return nil, status, err
	}

	students := make([]map[string]any, 0, len(bundle.Students))
	for _, student := range bundle.Students {
		students = append(students, map[string]any{
			"numero_identificacion":           student.NumeroIdentificacion,
			"tipo_identificacion":             nullableString(student.TipoIdentificacion),
			"nombres":                         student.Nombres,
			"apellidos":                       student.Apellidos,
			"ingles_speaking_1":               student.InglesSpeaking1,
			"ingles_speaking_2":               student.InglesSpeaking2,
			"ingles_listening_1":              student.InglesListening1,
			"ingles_listening_2":              student.InglesListening2,
			"ingles_writing_1":                student.InglesWriting1,
			"ingles_writing_2":                student.InglesWriting2,
			"ingles_reading_1":                student.InglesReading1,
			"ingles_reading_2":                student.InglesReading2,
			"ingles_grammar_1":                student.InglesGrammar1,
			"ingles_grammar_2":                student.InglesGrammar2,
			"ingles_definitiva":               student.InglesDefinitiva,
			"ingles_comentarios_docente":      nullableString(student.InglesComentariosDocente),
			"matematicas_pro":                 student.MatematicasPro,
			"matematicas_sol":                 student.MatematicasSol,
			"matematicas_com":                 student.MatematicasCom,
			"matematicas_raz":                 student.MatematicasRaz,
			"matematicas_definitiva":          student.MatematicasDefinitiva,
			"matematicas_comentarios_docente": nullableString(student.MatematicasComentariosDocente),
			"sistemas_definitiva":             student.SistemasDefinitiva,
			"sistemas_notas_docente":          nullableString(student.SistemasNotasDocente),
			"comentarios_generales_docente":   nullableString(student.ComentariosGeneralesDocente),
		})
	}

	response := map[string]any{
		"period": map[string]any{
			"id":            bundle.Period.ID,
			"period_label":  bundle.Period.PeriodLabel,
			"period_year":   bundle.Period.PeriodYear,
			"period_term":   bundle.Period.PeriodTerm,
			"fecha_inicio":  bundle.Period.FechaInicio,
			"fecha_fin":     bundle.Period.FechaFin,
			"auto_generado": bundle.Period.AutoGenerado,
		},
		"course": map[string]any{
			"id_curso":     bundle.Course.IDCurso,
			"nombre_curso": bundle.Course.NombreCurso,
			"hora_inicio":  bundle.Course.HoraInicio,
			"hora_fin":     bundle.Course.HoraFin,
			"salon":        nullableString(bundle.Course.Salon),
		},
		"students": students,
	}

	if bundle.Professor != nil {
		response["professor"] = map[string]any{
			"numero_identificacion":  bundle.Professor.NumeroIdentificacion,
			"tipo_identificacion":    nullableString(bundle.Professor.TipoIdentificacion),
			"nombres":                bundle.Professor.Nombres,
			"apellidos":              bundle.Professor.Apellidos,
			"firma_docente_data_url": nullableString(bundle.Professor.FirmaDataURL),
		}
	} else {
		response["professor"] = nil
	}

	return response, http.StatusOK, nil
}

func (a *App) SaveGrades(ctx context.Context, req models.GradeSaveRequest) (map[string]any, int, error) {
	if req.IDCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso invalido")
	}
	if req.PeriodID <= 0 {
		return nil, http.StatusBadRequest, errors.New("period_id invalido")
	}

	_, status, err := a.getAcademicPeriodByID(ctx, req.PeriodID)
	if err != nil {
		return nil, status, err
	}

	courseExists, err := a.CourseExists(ctx, req.IDCurso)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if !courseExists {
		return nil, http.StatusBadRequest, errors.New("el id_curso no existe")
	}

	normalizedRows := make([]models.GradeSaveRow, 0, len(req.Rows))
	requestedIDs := make([]string, 0, len(req.Rows))

	for _, row := range req.Rows {
		numero := normalizeUpper(row.NumeroIdentificacion)
		if numero == "" {
			continue
		}
		row.NumeroIdentificacion = numero
		normalizedRows = append(normalizedRows, row)
		requestedIDs = append(requestedIDs, numero)
	}

	requestedIDs = normalizeIdentificationIDs(requestedIDs)
	if len(requestedIDs) == 0 {
		return nil, http.StatusBadRequest, errors.New("no hay estudiantes para guardar")
	}

	enrolledQuery := url.Values{}
	enrolledQuery.Set("select", "numero_identificacion")
	enrolledQuery.Set("id_curso", fmt.Sprintf("eq.%d", req.IDCurso))
	enrolledQuery.Set("numero_identificacion", buildStringInFilter(requestedIDs))

	enrolledBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", enrolledQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	enrolledRows, err := unmarshalRows(enrolledBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	enrolledSet := map[string]bool{}
	for _, row := range enrolledRows {
		numero, ok := asString(row["numero_identificacion"])
		if !ok {
			continue
		}
		enrolledSet[strings.TrimSpace(numero)] = true
	}

	missingIDs := make([]string, 0)
	for _, requestedID := range requestedIDs {
		if !enrolledSet[requestedID] {
			missingIDs = append(missingIDs, requestedID)
		}
	}
	if len(missingIDs) > 0 {
		return nil, http.StatusBadRequest, fmt.Errorf("estos estudiantes no estan inscritos en el curso: %s", strings.Join(missingIDs, ", "))
	}

	existingQuery := url.Values{}
	existingQuery.Set("select", "id,numero_identificacion,ingles_definitiva,matematicas_definitiva,sistemas_definitiva")
	existingQuery.Set("id_curso", fmt.Sprintf("eq.%d", req.IDCurso))
	existingQuery.Set("period_id", fmt.Sprintf("eq.%d", req.PeriodID))
	existingQuery.Set("numero_identificacion", buildStringInFilter(requestedIDs))

	existingBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/calificaciones_estudiantes", existingQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	existingRows, err := unmarshalRows(existingBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	existingByStudent := map[string]map[string]any{}
	for _, row := range existingRows {
		numero, ok := asString(row["numero_identificacion"])
		if !ok {
			continue
		}
		numero = strings.TrimSpace(numero)
		if numero == "" {
			continue
		}
		existingByStudent[numero] = row
	}

	var updatedByValue any
	if req.UpdatedBy != nil {
		trimmed := strings.TrimSpace(*req.UpdatedBy)
		if trimmed != "" {
			updatedByValue = trimmed
		}
	}

	savedCount := 0

	for _, row := range normalizedRows {
		numero := row.NumeroIdentificacion
		existing := existingByStudent[numero]

		inglesSpeaking1, gradeErr := normalizeGradeValue(row.InglesSpeaking1, "ingles_speaking_1")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesSpeaking2, gradeErr := normalizeGradeValue(row.InglesSpeaking2, "ingles_speaking_2")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesListening1, gradeErr := normalizeGradeValue(row.InglesListening1, "ingles_listening_1")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesListening2, gradeErr := normalizeGradeValue(row.InglesListening2, "ingles_listening_2")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesWriting1, gradeErr := normalizeGradeValue(row.InglesWriting1, "ingles_writing_1")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesWriting2, gradeErr := normalizeGradeValue(row.InglesWriting2, "ingles_writing_2")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesReading1, gradeErr := normalizeGradeValue(row.InglesReading1, "ingles_reading_1")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesReading2, gradeErr := normalizeGradeValue(row.InglesReading2, "ingles_reading_2")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesGrammar1, gradeErr := normalizeGradeValue(row.InglesGrammar1, "ingles_grammar_1")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesGrammar2, gradeErr := normalizeGradeValue(row.InglesGrammar2, "ingles_grammar_2")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		inglesDefinitiva, gradeErr := normalizeGradeValue(row.InglesDefinitiva, "ingles_definitiva")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}

		matematicasPro, gradeErr := normalizeGradeValue(row.MatematicasPro, "matematicas_pro")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		matematicasSol, gradeErr := normalizeGradeValue(row.MatematicasSol, "matematicas_sol")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		matematicasCom, gradeErr := normalizeGradeValue(row.MatematicasCom, "matematicas_com")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		matematicasRaz, gradeErr := normalizeGradeValue(row.MatematicasRaz, "matematicas_raz")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}
		matematicasDefinitiva, gradeErr := normalizeGradeValue(row.MatematicasDefinitiva, "matematicas_definitiva")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}

		sistemasDefinitiva, gradeErr := normalizeGradeValue(row.SistemasDefinitiva, "sistemas_definitiva")
		if gradeErr != nil {
			return nil, http.StatusBadRequest, gradeErr
		}

		existingInglesDefinitiva := nullableFloatFromAny(existing["ingles_definitiva"])
		existingMatematicasDefinitiva := nullableFloatFromAny(existing["matematicas_definitiva"])
		existingSistemasDefinitiva := nullableFloatFromAny(existing["sistemas_definitiva"])

		autoInglesDefinitiva := averageGrades(
			inglesSpeaking1,
			inglesSpeaking2,
			inglesListening1,
			inglesListening2,
			inglesWriting1,
			inglesWriting2,
			inglesReading1,
			inglesReading2,
			inglesGrammar1,
			inglesGrammar2,
		)

		autoMatematicasDefinitiva := averageGrades(
			matematicasPro,
			matematicasSol,
			matematicasCom,
			matematicasRaz,
		)

		if req.UpdateDefinitivas {
			if inglesDefinitiva == nil {
				inglesDefinitiva = autoInglesDefinitiva
			}
			if matematicasDefinitiva == nil {
				matematicasDefinitiva = autoMatematicasDefinitiva
			}
			if sistemasDefinitiva == nil {
				sistemasDefinitiva = existingSistemasDefinitiva
			}
		} else {
			inglesDefinitiva = existingInglesDefinitiva
			matematicasDefinitiva = existingMatematicasDefinitiva
			sistemasDefinitiva = existingSistemasDefinitiva
		}

		payload := map[string]any{
			"period_id":                       req.PeriodID,
			"id_curso":                        req.IDCurso,
			"numero_identificacion":           numero,
			"ingles_speaking_1":               inglesSpeaking1,
			"ingles_speaking_2":               inglesSpeaking2,
			"ingles_listening_1":              inglesListening1,
			"ingles_listening_2":              inglesListening2,
			"ingles_writing_1":                inglesWriting1,
			"ingles_writing_2":                inglesWriting2,
			"ingles_reading_1":                inglesReading1,
			"ingles_reading_2":                inglesReading2,
			"ingles_grammar_1":                inglesGrammar1,
			"ingles_grammar_2":                inglesGrammar2,
			"ingles_definitiva":               inglesDefinitiva,
			"ingles_comentarios_docente":      normalizeOptionalTextPointerAny(row.InglesComentariosDocente),
			"matematicas_pro":                 matematicasPro,
			"matematicas_sol":                 matematicasSol,
			"matematicas_com":                 matematicasCom,
			"matematicas_raz":                 matematicasRaz,
			"matematicas_definitiva":          matematicasDefinitiva,
			"matematicas_comentarios_docente": normalizeOptionalTextPointerAny(row.MatematicasComentariosDocente),
			"sistemas_definitiva":             sistemasDefinitiva,
			"sistemas_notas_docente":          normalizeOptionalTextPointerAny(row.SistemasNotasDocente),
			"comentarios_generales_docente":   normalizeOptionalTextPointerAny(row.ComentariosGeneralesDocente),
			"updated_by":                      updatedByValue,
		}

		if existing == nil {
			insertQuery := url.Values{}
			insertQuery.Set("select", "id")
			insertBody, insertStatus, insertErr := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/calificaciones_estudiantes", insertQuery, payload, true)
			if insertErr != nil {
				return nil, insertStatus, insertErr
			}

			insertRows, decodeErr := unmarshalRows(insertBody)
			if decodeErr != nil {
				return nil, http.StatusInternalServerError, decodeErr
			}
			if len(insertRows) == 0 {
				continue
			}
			savedCount++
			continue
		}

		existingID, ok := asInt(existing["id"])
		if !ok || existingID <= 0 {
			continue
		}

		updateQuery := url.Values{}
		updateQuery.Set("id", fmt.Sprintf("eq.%d", existingID))
		updateQuery.Set("select", "id")
		updateBody, updateStatus, updateErr := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/calificaciones_estudiantes", updateQuery, payload, true)
		if updateErr != nil {
			return nil, updateStatus, updateErr
		}

		updateRows, decodeErr := unmarshalRows(updateBody)
		if decodeErr != nil {
			return nil, http.StatusInternalServerError, decodeErr
		}
		if len(updateRows) == 0 {
			continue
		}
		savedCount++
	}

	return map[string]any{
		"savedCount":          savedCount,
		"definitives_updated": req.UpdateDefinitivas,
	}, http.StatusOK, nil
}

func decodeDataURLImage(dataURL string) ([]byte, string, string, error) {
	trimmed := strings.TrimSpace(dataURL)
	if trimmed == "" {
		return nil, "", "", errors.New("firma vacia")
	}

	parts := strings.SplitN(trimmed, ",", 2)
	if len(parts) != 2 {
		return nil, "", "", errors.New("firma invalida")
	}

	header := strings.ToLower(strings.TrimSpace(parts[0]))
	if !strings.HasPrefix(header, "data:image/") || !strings.Contains(header, ";base64") {
		return nil, "", "", errors.New("firma invalida")
	}

	mime := strings.TrimPrefix(strings.SplitN(header, ";", 2)[0], "data:")
	imageType := ""
	canonicalMime := ""

	switch {
	case strings.HasPrefix(mime, "image/jpeg") || strings.HasPrefix(mime, "image/jpg"):
		imageType = "JPG"
		canonicalMime = "image/jpeg"
	case strings.HasPrefix(mime, "image/png"):
		imageType = "PNG"
		canonicalMime = "image/png"
	default:
		return nil, "", "", errors.New("formato de firma no soportado; use PNG o JPG")
	}

	payload := strings.TrimSpace(parts[1])
	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return nil, "", "", errors.New("firma en base64 invalida")
		}
	}

	if len(decoded) == 0 {
		return nil, "", "", errors.New("firma vacia")
	}

	return decoded, imageType, canonicalMime, nil
}

func (a *App) UpdateProfessorSignature(ctx context.Context, req models.ProfessorSignatureUpdateRequest) (map[string]any, int, error) {
	numero := normalizeUpper(req.NumeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	_, status, err := a.GetProfessorByNumero(ctx, numero)
	if err != nil {
		return nil, status, err
	}

	var updatedByValue any
	if req.UpdatedBy != nil {
		trimmed := strings.TrimSpace(*req.UpdatedBy)
		if trimmed != "" {
			updatedByValue = trimmed
		}
	}

	payload := map[string]any{
		"firma_docente_data_url":        nil,
		"firma_docente_actualizada_en":  time.Now().UTC().Format(time.RFC3339Nano),
		"firma_docente_actualizada_por": updatedByValue,
	}

	if req.SignatureDataURL != nil {
		signatureData := strings.TrimSpace(*req.SignatureDataURL)
		if signatureData != "" {
			signatureBytes, _, canonicalMime, decodeErr := decodeDataURLImage(signatureData)
			if decodeErr != nil {
				return nil, http.StatusBadRequest, decodeErr
			}
			if len(signatureBytes) > 1024*1024 {
				return nil, http.StatusBadRequest, errors.New("la firma supera el limite de 1 MB")
			}
			payload["firma_docente_data_url"] = fmt.Sprintf(
				"data:%s;base64,%s",
				canonicalMime,
				base64.StdEncoding.EncodeToString(signatureBytes),
			)
		}
	}

	query := url.Values{}
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	query.Set("select", "numero_identificacion,firma_docente_data_url,firma_docente_actualizada_en")

	body, status, err := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/profesores", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("no se encontro el profesor")
	}

	return rows[0], http.StatusOK, nil
}

func writeReportKeyValue(pdf *fpdf.Fpdf, label string, value string) {
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(58, 5, label+":", "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.MultiCell(0, 5, value, "", "L", false)
}

func writeReportSection(pdf *fpdf.Fpdf, title string, rows []string, commentLabel string, commentValue string) {
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(0, 6, title, "", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	for _, row := range rows {
		pdf.MultiCell(0, 4.5, row, "", "L", false)
	}

	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(0, 5, commentLabel+":", "", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	if strings.TrimSpace(commentValue) == "" {
		pdf.MultiCell(0, 4.5, "N/A", "", "L", false)
	} else {
		pdf.MultiCell(0, 4.5, commentValue, "", "L", false)
	}

	pdf.Ln(1)
}

var invalidReportFilePartPattern = regexp.MustCompile(`[^\p{L}\p{N}_-]+`)
var repeatedUnderscorePattern = regexp.MustCompile(`_+`)

func sanitizeReportFilePart(value string, fallback string) string {
	joined := strings.Join(strings.Fields(strings.TrimSpace(value)), "_")
	cleaned := invalidReportFilePartPattern.ReplaceAllString(joined, "_")
	cleaned = repeatedUnderscorePattern.ReplaceAllString(cleaned, "_")
	cleaned = strings.Trim(cleaned, "_-")

	if cleaned == "" {
		return fallback
	}

	return cleaned
}

func studentReportFileBaseName(student gradeStudentRecord) string {
	idPart := sanitizeReportFilePart(student.NumeroIdentificacion, "SIN_ID")
	fullNamePart := sanitizeReportFilePart(strings.TrimSpace(student.Nombres+" "+student.Apellidos), "SIN_NOMBRE")
	idTypePart := sanitizeReportFilePart(student.TipoIdentificacion, "SIN_TIPO")

	return fmt.Sprintf("%s_%s_%s", idPart, fullNamePart, idTypePart)
}

func buildStudentGradeReportPDF(bundle gradesRosterBundle, student gradeStudentRecord, signatureBytes []byte, signatureType string, generatedAtLabel string) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(12, 12, 12)
	pdf.SetAutoPageBreak(true, 16)
	pdf.AddPage()

	pdf.SetFillColor(61, 16, 15)
	pdf.Rect(0, 0, 210, 18, "F")
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 13)
	pdf.SetXY(12, 6)
	pdf.CellFormat(0, 6, fmt.Sprintf("Boletin Academico para el Periodo %s!", bundle.Period.PeriodLabel), "", 1, "L", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	pdf.SetY(22)
	writeReportKeyValue(pdf, "Nombre del Estudiante", strings.TrimSpace(student.Nombres+" "+student.Apellidos))
	writeReportKeyValue(pdf, "Curso", bundle.Course.NombreCurso)
	writeReportKeyValue(pdf, "Codigo de curso", strconv.Itoa(bundle.Course.IDCurso))
	writeReportKeyValue(pdf, "Horario", fmt.Sprintf("%s - %s", formatHourLabel(bundle.Course.HoraInicio), formatHourLabel(bundle.Course.HoraFin)))

	docenteNombre := "N/A"
	docenteIdentificacion := "N/A"
	if bundle.Professor != nil {
		docenteNombre = strings.TrimSpace(bundle.Professor.Nombres + " " + bundle.Professor.Apellidos)
		if docenteNombre == "" {
			docenteNombre = "N/A"
		}
		if strings.TrimSpace(bundle.Professor.NumeroIdentificacion) != "" {
			docenteIdentificacion = strings.TrimSpace(bundle.Professor.NumeroIdentificacion)
		}
	}

	writeReportKeyValue(pdf, "Nombre del Docente", docenteNombre)
	writeReportKeyValue(pdf, "Nombre Completo del Estudiante", strings.TrimSpace(student.Nombres+" "+student.Apellidos))
	writeReportKeyValue(pdf, "Tipo de Identificacion del Estudiante", func() string {
		if strings.TrimSpace(student.TipoIdentificacion) == "" {
			return "N/A"
		}
		return student.TipoIdentificacion
	}())
	writeReportKeyValue(pdf, "Numero de Identificacion del Estudiante", student.NumeroIdentificacion)

	pdf.Ln(1)
	writeReportSection(
		pdf,
		"Desempeno Ingles",
		[]string{
			"Speaking 1: " + formatGradeValue(student.InglesSpeaking1),
			"Speaking 2: " + formatGradeValue(student.InglesSpeaking2),
			"Listening 1: " + formatGradeValue(student.InglesListening1),
			"Listening 2: " + formatGradeValue(student.InglesListening2),
			"Writing 1: " + formatGradeValue(student.InglesWriting1),
			"Writing 2: " + formatGradeValue(student.InglesWriting2),
			"Reading 1: " + formatGradeValue(student.InglesReading1),
			"Reading 2: " + formatGradeValue(student.InglesReading2),
			"Grammar 1: " + formatGradeValue(student.InglesGrammar1),
			"Grammar 2: " + formatGradeValue(student.InglesGrammar2),
			"Definitiva del Estudiante: " + formatGradeValue(student.InglesDefinitiva),
		},
		"Comentarios del Docente al Estudiante",
		student.InglesComentariosDocente,
	)

	writeReportSection(
		pdf,
		"Desempeno Matematicas",
		[]string{
			"PRO: " + formatGradeValue(student.MatematicasPro),
			"SOL: " + formatGradeValue(student.MatematicasSol),
			"COM: " + formatGradeValue(student.MatematicasCom),
			"RAZ: " + formatGradeValue(student.MatematicasRaz),
			"Definitiva del Estudiante: " + formatGradeValue(student.MatematicasDefinitiva),
		},
		"Comentarios del Docente al Estudiante",
		student.MatematicasComentariosDocente,
	)

	writeReportSection(
		pdf,
		"Desempeno Sistemas",
		[]string{
			"Definitiva del Estudiante: " + formatGradeValue(student.SistemasDefinitiva),
		},
		"Notas del Docente al Estudiante",
		student.SistemasNotasDocente,
	)

	writeReportSection(
		pdf,
		"Comentarios Generales del Docente al Estudiante",
		[]string{},
		"Comentarios",
		student.ComentariosGeneralesDocente,
	)

	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(0, 5, "Firma del Docente:", "", 1, "L", false, 0, "")
	if len(signatureBytes) > 0 && signatureType != "" {
		imageName := "docente-signature"
		imageOptions := fpdf.ImageOptions{ImageType: signatureType, ReadDpi: true}
		pdf.RegisterImageOptionsReader(imageName, imageOptions, bytes.NewReader(signatureBytes))
		currentY := pdf.GetY()
		pdf.ImageOptions(imageName, 12, currentY+1, 50, 18, false, imageOptions, 0, "")
		pdf.Ln(21)
	} else {
		pdf.SetFont("Arial", "", 9)
		pdf.CellFormat(0, 5, "Firma no registrada", "", 1, "L", false, 0, "")
	}

	pdf.SetFont("Arial", "", 9)
	pdf.CellFormat(0, 5, "Nombre del docente: "+docenteNombre, "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 5, "Numero de identificacion del docente: "+docenteIdentificacion, "", 1, "L", false, 0, "")

	pdf.SetY(-15)
	pdf.SetFont("Arial", "I", 8)
	pdf.CellFormat(0, 4, "Generado el "+generatedAtLabel, "", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.CellFormat(0, 4, "Calle 19 #7-12 LINCOLN SOACHA Tel. 3013419462.", "", 1, "L", false, 0, "")

	var output bytes.Buffer
	if err := pdf.Output(&output); err != nil {
		return nil, err
	}

	return output.Bytes(), nil
}

func (a *App) GenerateGradeReportPDF(ctx context.Context, idCurso int, periodID int64, numeroIdentificacion string) ([]byte, string, string, int, error) {
	bundle, status, err := a.loadGradesRosterBundle(ctx, idCurso, periodID)
	if err != nil {
		return nil, "", "", status, err
	}

	filteredStudents := make([]gradeStudentRecord, 0, len(bundle.Students))
	targetNumero := normalizeUpper(numeroIdentificacion)
	if targetNumero == "" {
		filteredStudents = append(filteredStudents, bundle.Students...)
	} else {
		for _, student := range bundle.Students {
			if normalizeUpper(student.NumeroIdentificacion) == targetNumero {
				filteredStudents = append(filteredStudents, student)
				break
			}
		}
	}

	if len(filteredStudents) == 0 {
		if targetNumero != "" {
			return nil, "", "", http.StatusNotFound, errors.New("el estudiante no esta inscrito en el curso seleccionado")
		}
		return nil, "", "", http.StatusNotFound, errors.New("no hay estudiantes para generar boletin")
	}

	var signatureBytes []byte
	signatureType := ""
	if bundle.Professor != nil && strings.TrimSpace(bundle.Professor.FirmaDataURL) != "" {
		decoded, imageType, _, decodeErr := decodeDataURLImage(bundle.Professor.FirmaDataURL)
		if decodeErr == nil {
			signatureBytes = decoded
			signatureType = imageType
		}
	}

	generatedAt := time.Now().In(bogotaTZ)
	generatedAtLabel := generatedAt.Format("2006-01-02 15:04:05")

	if targetNumero == "" {
		var zipBuffer bytes.Buffer
		zipWriter := zip.NewWriter(&zipBuffer)

		for _, student := range filteredStudents {
			pdfBytes, renderErr := buildStudentGradeReportPDF(bundle, student, signatureBytes, signatureType, generatedAtLabel)
			if renderErr != nil {
				_ = zipWriter.Close()
				return nil, "", "", http.StatusInternalServerError, renderErr
			}

			entryName := studentReportFileBaseName(student) + ".pdf"
			entryWriter, zipErr := zipWriter.Create(entryName)
			if zipErr != nil {
				_ = zipWriter.Close()
				return nil, "", "", http.StatusInternalServerError, zipErr
			}

			if _, writeErr := entryWriter.Write(pdfBytes); writeErr != nil {
				_ = zipWriter.Close()
				return nil, "", "", http.StatusInternalServerError, writeErr
			}
		}

		if closeErr := zipWriter.Close(); closeErr != nil {
			return nil, "", "", http.StatusInternalServerError, closeErr
		}

		zipFileName := fmt.Sprintf(
			"boletines_%s_curso_%d.zip",
			sanitizeReportFilePart(bundle.Period.PeriodLabel, "PERIODO"),
			bundle.Course.IDCurso,
		)

		return zipBuffer.Bytes(), zipFileName, "application/zip", http.StatusOK, nil
	}

	student := filteredStudents[0]
	pdfBytes, renderErr := buildStudentGradeReportPDF(bundle, student, signatureBytes, signatureType, generatedAtLabel)
	if renderErr != nil {
		return nil, "", "", http.StatusInternalServerError, renderErr
	}

	pdfFileName := studentReportFileBaseName(student) + ".pdf"
	return pdfBytes, pdfFileName, "application/pdf", http.StatusOK, nil
}
