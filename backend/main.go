package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/fxamacker/cbor/v2"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/jtejido/sourceafis"
	"github.com/jtejido/sourceafis/config"
	"github.com/jtejido/sourceafis/templates"
)

const (
	defaultPort        = "4000"
	defaultThreshold   = 40.0
	fingerprintDPI     = 500.0
	minFingerprintSize = 1024
)

type app struct {
	supabaseURL string
	serviceKey  string
	threshold   float64
	httpClient  *http.Client
	logger      *sourceafis.DefaultTransparencyLogger
}

type noopTransparency struct{}

func (n *noopTransparency) Accepts(string) bool { return false }
func (n *noopTransparency) Accept(string, string, []byte) error {
	return nil
}

type studentEnrollRequest struct {
	TipoIdentificacion   string   `json:"tipo_identificacion"`
	NumeroIdentificacion string   `json:"numero_identificacion"`
	NoMatricula          *string  `json:"no_matricula"`
	Nombres              string   `json:"nombres"`
	Apellidos            string   `json:"apellidos"`
	Grado                int      `json:"grado"`
	Telefono             *string  `json:"telefono"`
	Direccion            *string  `json:"direccion"`
	Barrio               *string  `json:"barrio"`
	NombreAcudiente      *string  `json:"nombre_acudiente"`
	TelefonoAcudiente    *string  `json:"telefono_acudiente"`
	Programa             *string  `json:"programa"`
	FechaInicio          *string  `json:"fecha_inicio"`
	FechaMatricula       *string  `json:"fecha_matricula"`
	ValorMatricula       *float64 `json:"valor_matricula"`
	MatriculaCancelada   bool     `json:"matricula_cancelada"`
	ValorApoyoSemanal    float64  `json:"valor_apoyo_semanal"`
	HuellaIndiceDerecho  *string  `json:"huella_indice_derecho"`
	HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo"`
}

type attendanceIdentifyRequest struct {
	IDCurso             int    `json:"id_curso"`
	FingerprintTemplate string `json:"fingerprint_template"`
}

type studentRecord struct {
	NumeroIdentificacion string  `json:"numero_identificacion"`
	Nombres              string  `json:"nombres"`
	Apellidos            string  `json:"apellidos"`
	HuellaIndiceDerecho  *string `json:"huella_indice_derecho,omitempty"`
	HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo,omitempty"`
	CreatedAt            string  `json:"created_at,omitempty"`
}

type enrollmentRow struct {
	NumeroIdentificacion string          `json:"numero_identificacion"`
	Estudiantes          json.RawMessage `json:"estudiantes"`
}

type embeddedStudent struct {
	HuellaIndiceDerecho   *string `json:"huella_indice_derecho"`
	HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo"`
}

type supabaseError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Hint    string `json:"hint"`
	Details string `json:"details"`
}

func main() {
	_ = godotenv.Load()
	config.LoadDefaultConfig()

	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	serviceKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	if supabaseURL == "" || serviceKey == "" {
		log.Fatal("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")
	}

	threshold := defaultThreshold
	if value := strings.TrimSpace(os.Getenv("MATCH_THRESHOLD")); value != "" {
		if parsed, err := parseFloat(value); err == nil {
			threshold = parsed
		}
	}

	api := &app{
		supabaseURL: strings.TrimSuffix(supabaseURL, "/"),
		serviceKey:  serviceKey,
		threshold:   threshold,
		httpClient: &http.Client{
			Timeout: 25 * time.Second,
		},
		logger: sourceafis.NewTransparencyLogger(&noopTransparency{}),
	}

	router := gin.Default()
	router.Use(corsMiddleware(strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN"))))

	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true, "threshold": api.threshold})
	})
	router.HEAD("/api/health", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	router.POST("/api/students/enroll", api.enrollStudent)
	router.POST("/api/attendance/identify", api.identifyAttendance)

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = defaultPort
	}

	log.Printf("Biometric backend running on http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

func (a *app) enrollStudent(c *gin.Context) {
	var req studentEnrollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON payload"})
		return
	}

	req.NumeroIdentificacion = strings.TrimSpace(req.NumeroIdentificacion)
	req.TipoIdentificacion = strings.TrimSpace(req.TipoIdentificacion)
	req.Nombres = strings.TrimSpace(req.Nombres)
	req.Apellidos = strings.TrimSpace(req.Apellidos)

	validIdentificationTypes := map[string]struct{}{
		"CC": {},
		"TI": {},
		"CE": {},
		"RCN": {},
		"PASAPORTE": {},
		"PAS": {},
		"PPT": {},
	}

	if req.TipoIdentificacion == "" || req.NumeroIdentificacion == "" || req.Nombres == "" || req.Apellidos == "" || req.Grado < 1 || req.Grado > 11 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tipo_identificacion, numero_identificacion, nombres, apellidos y grado validos son requeridos"})
		return
	}

	if _, ok := validIdentificationTypes[req.TipoIdentificacion]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tipo_identificacion no valido"})
		return
	}

	if req.ValorApoyoSemanal <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valor_apoyo_semanal debe ser mayor que 0"})
		return
	}

	rightTemplate, err := a.extractTemplateIfPresent(req.HuellaIndiceDerecho)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Huella derecha invalida: " + err.Error()})
		return
	}

	leftTemplate, err := a.extractTemplateIfPresent(req.HuellaIndiceIzquierdo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Huella izquierda invalida: " + err.Error()})
		return
	}

	payload := map[string]any{
		"tipo_identificacion":     req.TipoIdentificacion,
		"numero_identificacion":   req.NumeroIdentificacion,
		"no_matricula":            normalizeOptional(req.NoMatricula),
		"nombres":                 req.Nombres,
		"apellidos":               req.Apellidos,
		"grado":                   req.Grado,
		"telefono":                normalizeOptional(req.Telefono),
		"direccion":               normalizeOptional(req.Direccion),
		"barrio":                  normalizeOptional(req.Barrio),
		"nombre_acudiente":        normalizeOptional(req.NombreAcudiente),
		"telefono_acudiente":      normalizeOptional(req.TelefonoAcudiente),
		"programa":                normalizeOptional(req.Programa),
		"fecha_inicio":            normalizeOptional(req.FechaInicio),
		"fecha_matricula":         normalizeOptional(req.FechaMatricula),
		"valor_matricula":         req.ValorMatricula,
		"matricula_cancelada":     req.MatriculaCancelada,
		"valor_apoyo_semanal":     req.ValorApoyoSemanal,
		"huella_indice_derecho":   rightTemplate,
		"huella_indice_izquierdo": leftTemplate,
	}

	rows, status, err := a.insertStudent(c.Request.Context(), payload)
	if err != nil {
		if status == http.StatusConflict {
			c.JSON(http.StatusConflict, gin.H{"error": "Error: En la base datos ya existe un usuario con el mismo número de identificación."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(rows) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se recibio respuesta de Supabase al crear el estudiante"})
		return
	}

	created := rows[0]
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"numero_identificacion": created.NumeroIdentificacion,
			"nombres":               created.Nombres,
			"apellidos":             created.Apellidos,
			"created_at":            created.CreatedAt,
		},
	})
}

func (a *app) identifyAttendance(c *gin.Context) {
	var req attendanceIdentifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid JSON payload"})
		return
	}

	if req.IDCurso <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "id_curso invalido"})
		return
	}

	_, probeTemplate, err := a.extractTemplate(req.FingerprintTemplate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	enrollments, err := a.listEnrolledStudentsWithTemplates(c.Request.Context(), req.IDCurso)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	if len(enrollments) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": true, "numero_identificacion": nil, "confidence": 0.0})
		return
	}

	matcher, err := sourceafis.NewMatcher(a.logger, probeTemplate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "No fue posible inicializar el matcher"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	bestID := ""
	bestScore := 0.0

	for _, enrollment := range enrollments {
		templatesToTry := []*string{enrollment.HuellaIndiceDerecho, enrollment.HuellaIndiceIzquierdo}
		for _, rawTemplate := range templatesToTry {
			if rawTemplate == nil || strings.TrimSpace(*rawTemplate) == "" {
				continue
			}

			candidate, err := deserializeTemplate(*rawTemplate)
			if err != nil {
				continue
			}

			score := matcher.Match(ctx, candidate)
			if bestID == "" || score > bestScore {
				bestID = enrollment.NumeroIdentificacion
				bestScore = score
			}
		}
	}

	if bestID == "" || bestScore < a.threshold {
		c.JSON(http.StatusOK, gin.H{
			"success":               true,
			"numero_identificacion": nil,
			"confidence":            normalizeConfidence(bestScore, a.threshold),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":               true,
		"numero_identificacion": bestID,
		"confidence":            normalizeConfidence(bestScore, a.threshold),
	})
}

func (a *app) extractTemplateIfPresent(value *string) (*string, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}

	serialized, _, err := a.extractTemplate(*value)
	if err != nil {
		return nil, err
	}

	return &serialized, nil
}

func (a *app) extractTemplate(base64PNG string) (string, *templates.SearchTemplate, error) {
	pngBytes, err := decodePNGBase64(base64PNG)
	if err != nil {
		return "", nil, err
	}
	if len(pngBytes) < minFingerprintSize {
		zeroBytes(pngBytes)
		return "", nil, errors.New("fingerprintTemplate PNG demasiado pequena para ser valida")
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(pngBytes))
	if err != nil || format != "png" {
		zeroBytes(pngBytes)
		return "", nil, errors.New("fingerprintTemplate debe ser un PNG en base64 valido")
	}

	if cfg.Width < 80 || cfg.Height < 80 {
		zeroBytes(pngBytes)
		return "", nil, errors.New("el PNG de la huella es demasiado pequeno")
	}

	img, _, err := image.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		zeroBytes(pngBytes)
		return "", nil, errors.New("no se pudo decodificar el PNG")
	}

	sourceImage, err := sourceafis.NewFromImage(img, sourceafis.WithResolution(fingerprintDPI))
	if err != nil {
		zeroBytes(pngBytes)
		return "", nil, fmt.Errorf("error procesando imagen: %w", err)
	}

	creator := sourceafis.NewTemplateCreator(a.logger)
	template, err := creator.Template(sourceImage)
	if err != nil {
		zeroBytes(pngBytes)
		return "", nil, fmt.Errorf("no se pudo extraer la plantilla: %w", err)
	}

	serialized, err := cbor.Marshal(template)
	if err != nil {
		zeroBytes(pngBytes)
		return "", nil, fmt.Errorf("no se pudo serializar la plantilla: %w", err)
	}

	zeroBytes(pngBytes)
	return base64.StdEncoding.EncodeToString(serialized), template, nil
}

func deserializeTemplate(serialized string) (*templates.SearchTemplate, error) {
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(serialized))
	if err != nil {
		return nil, err
	}

	var template templates.SearchTemplate
	if err := cbor.Unmarshal(decoded, &template); err != nil {
		return nil, err
	}

	if len(template.Minutiae) == 0 {
		return nil, errors.New("empty template")
	}

	return &template, nil
}

func decodePNGBase64(input string) ([]byte, error) {
	value := strings.TrimSpace(input)
	if value == "" {
		return nil, errors.New("fingerprintTemplate es requerido")
	}

	if comma := strings.Index(value, ","); strings.HasPrefix(value, "data:image/") && comma > 0 {
		value = value[comma+1:]
	}

	value = strings.TrimSpace(value)
	decoders := []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	}

	for _, enc := range decoders {
		if decoded, err := enc.DecodeString(value); err == nil {
			return decoded, nil
		}
	}

	return nil, errors.New("fingerprintTemplate debe ser un PNG codificado en base64")
}

func zeroBytes(data []byte) {
	for i := range data {
		data[i] = 0
	}
}

func normalizeOptional(value *string) any {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func parseFloat(value string) (float64, error) {
	var out float64
	_, err := fmt.Sscanf(value, "%f", &out)
	return out, err
}

func normalizeConfidence(score float64, threshold float64) float64 {
	if threshold <= 0 {
		return 0
	}
	confidence := score / threshold
	if confidence < 0 {
		return 0
	}
	if confidence > 1 {
		return 1
	}
	return round4(confidence)
}

func round4(value float64) float64 {
	return float64(int(value*10000+0.5)) / 10000
}

func corsMiddleware(originList string) gin.HandlerFunc {
	allowed := map[string]bool{}
	allowAnyLoopbackOrigin := false

	for _, origin := range strings.Split(originList, ",") {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}

		allowed[origin] = true
		if strings.Contains(origin, "localhost") {
			allowed[strings.Replace(origin, "localhost", "127.0.0.1", 1)] = true
			allowAnyLoopbackOrigin = true
		}
		if strings.Contains(origin, "127.0.0.1") {
			allowed[strings.Replace(origin, "127.0.0.1", "localhost", 1)] = true
			allowAnyLoopbackOrigin = true
		}
	}

	isLoopbackOrigin := func(origin string) bool {
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		host := strings.Split(u.Host, ":")[0]
		return host == "localhost" || host == "127.0.0.1"
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if c.Request.URL.Path == "/api/health" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else {
			originAllowed := len(allowed) == 0 || allowed[origin] || (allowAnyLoopbackOrigin && isLoopbackOrigin(origin))
			if origin != "" && originAllowed {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				c.Writer.Header().Set("Vary", "Origin")
			}
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func (a *app) insertStudent(ctx context.Context, payload map[string]any) ([]studentRecord, int, error) {
	query := url.Values{}
	query.Set("select", "numero_identificacion,nombres,apellidos,created_at")

	body, status, err := a.callSupabase(ctx, http.MethodPost, "/rest/v1/estudiantes", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	rows := make([]studentRecord, 0)
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return rows, status, nil
}

func (a *app) listEnrolledStudentsWithTemplates(ctx context.Context, idCurso int) ([]struct {
	NumeroIdentificacion string
	HuellaIndiceDerecho  *string
	HuellaIndiceIzquierdo *string
}, error) {
	query := url.Values{}
	query.Set("select", "numero_identificacion,estudiantes(huella_indice_derecho,huella_indice_izquierdo)")
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	body, _, err := a.callSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", query, nil, false)
	if err != nil {
		return nil, err
	}

	rows := make([]enrollmentRow, 0)
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, err
	}

	templatesByStudent := make([]struct {
		NumeroIdentificacion string
		HuellaIndiceDerecho  *string
		HuellaIndiceIzquierdo *string
	}, 0, len(rows))

	for _, row := range rows {
		student, err := parseEmbeddedStudent(row.Estudiantes)
		if err != nil || student == nil {
			continue
		}

		templatesByStudent = append(templatesByStudent, struct {
			NumeroIdentificacion string
			HuellaIndiceDerecho  *string
			HuellaIndiceIzquierdo *string
		}{
			NumeroIdentificacion: row.NumeroIdentificacion,
			HuellaIndiceDerecho:  student.HuellaIndiceDerecho,
			HuellaIndiceIzquierdo: student.HuellaIndiceIzquierdo,
		})
	}

	return templatesByStudent, nil
}

func parseEmbeddedStudent(raw json.RawMessage) (*embeddedStudent, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}

	var asObject embeddedStudent
	if err := json.Unmarshal(raw, &asObject); err == nil {
		return &asObject, nil
	}

	var asArray []embeddedStudent
	if err := json.Unmarshal(raw, &asArray); err == nil {
		if len(asArray) == 0 {
			return nil, nil
		}
		return &asArray[0], nil
	}

	return nil, errors.New("invalid embedded student payload")
}

func (a *app) callSupabase(ctx context.Context, method, path string, query url.Values, payload any, returnRepresentation bool) ([]byte, int, error) {
	requestURL := a.supabaseURL + path
	if len(query) > 0 {
		requestURL += "?" + query.Encode()
	}

	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}
		body = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	req.Header.Set("apikey", a.serviceKey)
	req.Header.Set("Authorization", "Bearer "+a.serviceKey)
	req.Header.Set("Content-Type", "application/json")
	if returnRepresentation {
		req.Header.Set("Prefer", "return=representation")
	}

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return respBody, resp.StatusCode, nil
	}

	var sbErr supabaseError
	_ = json.Unmarshal(respBody, &sbErr)
	if sbErr.Code == "23505" {
		return nil, http.StatusConflict, errors.New(sbErr.Message)
	}
	if sbErr.Message != "" {
		return nil, resp.StatusCode, fmt.Errorf("supabase error: %s", sbErr.Message)
	}

	return nil, resp.StatusCode, fmt.Errorf("supabase request failed with status %d", resp.StatusCode)
}
