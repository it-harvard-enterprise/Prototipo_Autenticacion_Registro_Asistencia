package services

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
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/fxamacker/cbor/v2"
	"github.com/jtejido/sourceafis"
	"github.com/jtejido/sourceafis/templates"
)

const (
	DefaultThreshold   = 40.0
	fingerprintDPI     = 500.0
	minFingerprintSize = 1024
	DefaultFingerprint = "PENDING_FINGERPRINT"
)

type App struct {
	SupabaseURL       string
	ServiceKey        string
	FrontendHealthURL string
	Threshold         float64
	HTTPClient        *http.Client
	Logger            *sourceafis.DefaultTransparencyLogger
}

type supabaseError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Hint    string `json:"hint"`
	Details string `json:"details"`
}

func NewApp(supabaseURL, serviceKey, frontendHealthURL string, threshold float64) *App {
	return &App{
		SupabaseURL:       strings.TrimSuffix(strings.TrimSpace(supabaseURL), "/"),
		ServiceKey:        strings.TrimSpace(serviceKey),
		FrontendHealthURL: strings.TrimSpace(frontendHealthURL),
		Threshold:         threshold,
		HTTPClient:        &http.Client{Timeout: 25 * time.Second},
		Logger:            sourceafis.NewTransparencyLogger(&noopTransparency{}),
	}
}

type noopTransparency struct{}

func (n *noopTransparency) Accepts(string) bool                 { return false }
func (n *noopTransparency) Accept(string, string, []byte) error { return nil }

func (a *App) CallSupabase(ctx context.Context, method, path string, query url.Values, payload any, returnRepresentation bool) ([]byte, int, error) {
	requestURL := a.SupabaseURL + path
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

	req.Header.Set("apikey", a.ServiceKey)
	req.Header.Set("Authorization", "Bearer "+a.ServiceKey)
	req.Header.Set("Content-Type", "application/json")
	if returnRepresentation {
		req.Header.Set("Prefer", "return=representation")
	}

	resp, err := a.HTTPClient.Do(req)
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

func (a *App) CheckFrontendHealth(ctx context.Context) (string, string) {
	base := strings.TrimSpace(a.FrontendHealthURL)
	if base == "" {
		return "unknown", "FRONTEND_HEALTH_URL not configured"
	}

	requestURL := strings.TrimSuffix(base, "/") + "/health?scope=frontend"
	checkCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(checkCtx, http.MethodHead, requestURL, nil)
	if err != nil {
		return "down", "invalid FRONTEND_HEALTH_URL"
	}

	resp, err := a.HTTPClient.Do(req)
	if err != nil {
		return "down", "unreachable"
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return "ok", fmt.Sprintf("status:%d", resp.StatusCode)
	}

	return "down", fmt.Sprintf("status:%d", resp.StatusCode)
}

func (a *App) DecodePNGBase64(input string) ([]byte, error) {
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

func (a *App) ZeroBytes(data []byte) {
	for i := range data {
		data[i] = 0
	}
}

func (a *App) ExtractTemplate(base64PNG string) (string, *templates.SearchTemplate, error) {
	pngBytes, err := a.DecodePNGBase64(base64PNG)
	if err != nil {
		return "", nil, err
	}
	if len(pngBytes) < minFingerprintSize {
		a.ZeroBytes(pngBytes)
		return "", nil, errors.New("fingerprintTemplate PNG demasiado pequena para ser valida")
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(pngBytes))
	if err != nil || format != "png" {
		a.ZeroBytes(pngBytes)
		return "", nil, errors.New("fingerprintTemplate debe ser un PNG en base64 valido")
	}

	if cfg.Width < 80 || cfg.Height < 80 {
		a.ZeroBytes(pngBytes)
		return "", nil, errors.New("el PNG de la huella es demasiado pequeno")
	}

	img, _, err := image.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		a.ZeroBytes(pngBytes)
		return "", nil, errors.New("no se pudo decodificar el PNG")
	}

	sourceImage, err := sourceafis.NewFromImage(img, sourceafis.WithResolution(fingerprintDPI))
	if err != nil {
		a.ZeroBytes(pngBytes)
		return "", nil, fmt.Errorf("error procesando imagen: %w", err)
	}

	creator := sourceafis.NewTemplateCreator(a.Logger)
	template, err := creator.Template(sourceImage)
	if err != nil {
		a.ZeroBytes(pngBytes)
		return "", nil, fmt.Errorf("no se pudo extraer la plantilla: %w", err)
	}

	serialized, err := cbor.Marshal(template)
	if err != nil {
		a.ZeroBytes(pngBytes)
		return "", nil, fmt.Errorf("no se pudo serializar la plantilla: %w", err)
	}

	a.ZeroBytes(pngBytes)
	return base64.StdEncoding.EncodeToString(serialized), template, nil
}

func (a *App) DeserializeTemplate(serialized string) (*templates.SearchTemplate, error) {
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

func (a *App) NormalizeOptional(value *string) any {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func (a *App) ParseFloat(value string) (float64, error) {
	var out float64
	_, err := fmt.Sscanf(value, "%f", &out)
	return out, err
}

// ParseFloatStatic is a convenience static helper used by main during startup.
func ParseFloatStatic(value string) (float64, error) {
	var out float64
	_, err := fmt.Sscanf(value, "%f", &out)
	return out, err
}

func (a *App) NormalizeConfidence(score float64, threshold float64) float64 {
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
	return a.Round4(confidence)
}

func (a *App) Round4(value float64) float64 {
	return float64(int(value*10000+0.5)) / 10000
}

func (a *App) InsertStudent(ctx context.Context, payload map[string]any) ([]map[string]any, int, error) {
	query := url.Values{}
	query.Set("select", "numero_identificacion,nombres,apellidos,created_at")

	body, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/estudiantes", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return rows, status, nil
}

func (a *App) UpdateStudentByNumero(ctx context.Context, numeroIdentificacion string, payload map[string]any) ([]map[string]any, int, error) {
	query := url.Values{}
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", strings.TrimSpace(numeroIdentificacion)))
	query.Set("select", "numero_identificacion,huella_indice_derecho,huella_indice_izquierdo,updated_at")

	body, status, err := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/estudiantes", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	var rows []map[string]any
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return rows, status, nil
}

func (a *App) ListEnrolledStudentsWithTemplates(ctx context.Context, idCurso int) ([]struct {
	NumeroIdentificacion  string
	HuellaIndiceDerecho   *string
	HuellaIndiceIzquierdo *string
}, error) {
	query := url.Values{}
	query.Set("select", "numero_identificacion,estudiantes(huella_indice_derecho,huella_indice_izquierdo)")
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", query, nil, false)
	if err != nil {
		return nil, err
	}

	var rows []struct {
		NumeroIdentificacion string          `json:"numero_identificacion"`
		Estudiantes          json.RawMessage `json:"estudiantes"`
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, err
	}

	out := make([]struct {
		NumeroIdentificacion  string
		HuellaIndiceDerecho   *string
		HuellaIndiceIzquierdo *string
	}, 0, len(rows))

	for _, row := range rows {
		student, err := a.ParseEmbeddedStudent(row.Estudiantes)
		if err != nil || student == nil {
			continue
		}
		out = append(out, struct {
			NumeroIdentificacion  string
			HuellaIndiceDerecho   *string
			HuellaIndiceIzquierdo *string
		}{
			NumeroIdentificacion:  row.NumeroIdentificacion,
			HuellaIndiceDerecho:   student.HuellaIndiceDerecho,
			HuellaIndiceIzquierdo: student.HuellaIndiceIzquierdo,
		})
	}

	return out, nil
}

func (a *App) ListStudentsWithTemplates(ctx context.Context) ([]struct {
	NumeroIdentificacion  string
	HuellaIndiceDerecho   *string
	HuellaIndiceIzquierdo *string
}, error) {
	query := url.Values{}
	query.Set("select", "numero_identificacion,huella_indice_derecho,huella_indice_izquierdo")
	query.Set("or", "(huella_indice_derecho.not.is.null,huella_indice_izquierdo.not.is.null)")

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", query, nil, false)
	if err != nil {
		return nil, err
	}

	var rows []struct {
		NumeroIdentificacion  string  `json:"numero_identificacion"`
		HuellaIndiceDerecho   *string `json:"huella_indice_derecho"`
		HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo"`
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, err
	}

	out := make([]struct {
		NumeroIdentificacion  string
		HuellaIndiceDerecho   *string
		HuellaIndiceIzquierdo *string
	}, 0, len(rows))

	for _, row := range rows {
		hasRight := row.HuellaIndiceDerecho != nil && strings.TrimSpace(*row.HuellaIndiceDerecho) != ""
		hasLeft := row.HuellaIndiceIzquierdo != nil && strings.TrimSpace(*row.HuellaIndiceIzquierdo) != ""
		if !hasRight && !hasLeft {
			continue
		}

		out = append(out, struct {
			NumeroIdentificacion  string
			HuellaIndiceDerecho   *string
			HuellaIndiceIzquierdo *string
		}{
			NumeroIdentificacion:  row.NumeroIdentificacion,
			HuellaIndiceDerecho:   row.HuellaIndiceDerecho,
			HuellaIndiceIzquierdo: row.HuellaIndiceIzquierdo,
		})
	}

	return out, nil
}

func (a *App) ParseEmbeddedStudent(raw json.RawMessage) (*struct {
	HuellaIndiceDerecho   *string `json:"huella_indice_derecho"`
	HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo"`
}, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}

	var asObject struct {
		HuellaIndiceDerecho   *string `json:"huella_indice_derecho"`
		HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo"`
	}
	if err := json.Unmarshal(raw, &asObject); err == nil {
		return &asObject, nil
	}

	var asArray []struct {
		HuellaIndiceDerecho   *string `json:"huella_indice_derecho"`
		HuellaIndiceIzquierdo *string `json:"huella_indice_izquierdo"`
	}
	if err := json.Unmarshal(raw, &asArray); err == nil {
		if len(asArray) == 0 {
			return nil, nil
		}
		return &asArray[0], nil
	}

	return nil, errors.New("invalid embedded student payload")
}

func (a *App) ExtractTemplateIfPresent(value *string) (*string, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}

	serialized, _, err := a.ExtractTemplate(*value)
	if err != nil {
		return nil, err
	}

	return &serialized, nil
}

func (a *App) ResolveStoredFingerprintTemplate(raw *string) (string, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return DefaultFingerprint, nil
	}

	trimmed := strings.TrimSpace(*raw)
	if strings.EqualFold(trimmed, DefaultFingerprint) {
		return DefaultFingerprint, nil
	}

	template, err := a.ExtractTemplateIfPresent(&trimmed)
	if err != nil {
		return "", err
	}

	if template == nil || strings.TrimSpace(*template) == "" {
		return DefaultFingerprint, nil
	}

	return *template, nil
}

// InviteUserByEmail sends an invitation email using Supabase Admin API
// This creates an auth user with a temporary password and sends an invitation email
func (a *App) InviteUserByEmail(ctx context.Context, email string, metadata map[string]interface{}) (map[string]interface{}, error) {
	if strings.TrimSpace(email) == "" {
		return nil, errors.New("email is required")
	}

	payload := map[string]interface{}{
		"email": strings.TrimSpace(email),
		"data":  metadata,
	}

	requestURL := a.SupabaseURL + "/auth/v1/admin/invite"

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", a.ServiceKey)
	req.Header.Set("Authorization", "Bearer "+a.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send invitation: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read invitation response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var sbErr supabaseError
		_ = json.Unmarshal(respBody, &sbErr)
		if sbErr.Message != "" {
			return nil, fmt.Errorf("supabase error: %s", sbErr.Message)
		}
		return nil, fmt.Errorf("invitation request failed with status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse invitation response: %w", err)
	}

	return result, nil
}
