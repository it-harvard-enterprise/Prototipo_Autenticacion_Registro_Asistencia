package services

// SMS notifications via Twilio Programmable Messaging.
//
// Design notes:
//   - Three independent toggles (one per case) plus a master ENABLED switch
//     and a DRY_RUN flag. Dry-run logs the would-be SMS to stdout and does
//     NOT hit the Twilio API, so the feature can ship safely before the
//     Twilio account is upgraded out of trial.
//   - Every Notify* method is best-effort and never returns an error. Callers
//     are expected to wrap them in `go` so they do not block the originating
//     HTTP request, and to pass `context.Background()` (not the request ctx)
//     so the goroutine survives the response being written.
//   - Failures (network, 4xx/5xx from Twilio, missing/invalid phone) are
//     logged with a consistent [SMS][...][...] tag and discarded; they NEVER
//     bubble back to the business logic (no payment or attendance save will
//     be rolled back because an SMS failed).
//   - Templates are intentionally short (~1 segment / 160 chars) to keep
//     per-message cost predictable.

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

const (
	envSMSEnabled       = "SMS_NOTIFICATIONS_ENABLED"
	envSMSDryRun        = "SMS_NOTIFICATIONS_DRY_RUN"
	envSMSNotifyPayment = "SMS_NOTIFY_PAYMENT"
	envSMSNotifyPresent = "SMS_NOTIFY_ATTENDANCE_PRESENT"
	envSMSNotifyAbsent  = "SMS_NOTIFY_ATTENDANCE_ABSENT"
	envTwilioAccountSid = "TWILIO_ACCOUNT_SID"
	envTwilioAuthToken  = "TWILIO_AUTH_TOKEN"
	envTwilioMsgSvcSid  = "TWILIO_MESSAGING_SERVICE_SID"
)

const smsHTTPTimeout = 10 * time.Second

// SMSPaymentEvent carries the minimum fields needed to render and send the
// payment confirmation SMS. Callers populate it from the result of
// ProcessStudentPayment (student record + payment row + resolved admin name).
type SMSPaymentEvent struct {
	TelefonoAcudiente  string
	EstudianteFullName string  // "JUAN PEREZ" or empty
	EstudianteNumeroID string  // fallback display when full name is empty
	PaymentID          string  // UUID of the pago row
	PaymentValue       float64 // in COP
	Clases             int
	MetodoPago         string  // "EFECTIVO" | "TRANSFERENCIA" | ...
	AdminName          string  // resolved name of the admin who registered the payment
}

// SMSAttendanceEvent carries the minimum fields needed for present/absent
// notifications. One event per (student, day) is produced by SaveAttendance.
type SMSAttendanceEvent struct {
	TelefonoAcudiente  string
	EstudianteFullName string
	EstudianteNumeroID string
	CourseName         string
	Date               string // YYYY-MM-DD (Bogotá day)
}

// ----- Public API on *App -----

func (a *App) NotifyPaymentConfirmation(ctx context.Context, event SMSPaymentEvent) {
	const kind = "PAYMENT"
	if !smsMasterOn() {
		return
	}
	if !envBool(envSMSNotifyPayment, false) {
		logSMSSkipped(kind, "toggle "+envSMSNotifyPayment+"=false")
		return
	}
	to := normalizePhoneE164(event.TelefonoAcudiente)
	if to == "" {
		logSMSSkipped(kind, "missing or invalid telefono_acudiente")
		return
	}
	sendOrLog(ctx, kind, to, buildPaymentBody(event))
}

func (a *App) NotifyAttendancePresent(ctx context.Context, event SMSAttendanceEvent) {
	const kind = "PRESENT"
	if !smsMasterOn() {
		return
	}
	if !envBool(envSMSNotifyPresent, false) {
		logSMSSkipped(kind, "toggle "+envSMSNotifyPresent+"=false")
		return
	}
	to := normalizePhoneE164(event.TelefonoAcudiente)
	if to == "" {
		logSMSSkipped(kind, "missing or invalid telefono_acudiente")
		return
	}
	sendOrLog(ctx, kind, to, buildAttendancePresentBody(event))
}

func (a *App) NotifyAttendanceAbsent(ctx context.Context, event SMSAttendanceEvent) {
	const kind = "ABSENT"
	if !smsMasterOn() {
		return
	}
	if !envBool(envSMSNotifyAbsent, false) {
		logSMSSkipped(kind, "toggle "+envSMSNotifyAbsent+"=false")
		return
	}
	to := normalizePhoneE164(event.TelefonoAcudiente)
	if to == "" {
		logSMSSkipped(kind, "missing or invalid telefono_acudiente")
		return
	}
	sendOrLog(ctx, kind, to, buildAttendanceAbsentBody(event))
}

// ----- Configuration helpers -----

func smsMasterOn() bool {
	return envBool(envSMSEnabled, false)
}

// envBool returns true when the env var is one of {true,1,yes,on}
// (case-insensitive). Empty value falls back to defaultValue.
func envBool(key string, defaultValue bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		return defaultValue
	}
	switch v {
	case "true", "1", "yes", "on":
		return true
	case "false", "0", "no", "off":
		return false
	}
	return defaultValue
}

// ----- Phone normalization (Colombia-first) -----

var nonDigitRE = regexp.MustCompile(`\D+`)

// normalizePhoneE164 returns the E.164 representation of the given raw phone
// string, or "" if it cannot be confidently interpreted. It handles the
// common shapes used in `estudiantes.telefono_acudiente`:
//
//	"3187677436"       -> "+573187677436"
//	"318 767 7436"     -> "+573187677436"
//	"+57 318 767 7436" -> "+573187677436"
//	"573187677436"     -> "+573187677436"
//	"+12025551234"     -> "+12025551234"   (already E.164, passes through)
//	""                 -> ""               (skip)
//	"1234"             -> ""               (too short, skip)
func normalizePhoneE164(raw string) string {
	trimmed := strings.TrimSpace(raw)
	digits := nonDigitRE.ReplaceAllString(trimmed, "")
	if digits == "" {
		return ""
	}

	// Preserve an explicit + prefix (any country, basic length sanity check).
	if strings.HasPrefix(trimmed, "+") {
		if len(digits) >= 10 && len(digits) <= 15 {
			return "+" + digits
		}
		return ""
	}

	// Colombian cellular: 10 digits starting with 3.
	if len(digits) == 10 && strings.HasPrefix(digits, "3") {
		return "+57" + digits
	}

	// Colombian cellular prefixed with country code (12 digits, 57...).
	if len(digits) == 12 && strings.HasPrefix(digits, "57") {
		return "+" + digits
	}

	return ""
}

// ----- Display helpers -----

func studentLabel(fullName, numeroID string) string {
	if name := strings.TrimSpace(fullName); name != "" {
		return name
	}
	if id := strings.TrimSpace(numeroID); id != "" {
		return id
	}
	return "Estudiante"
}

func adminLabel(name string) string {
	if n := strings.TrimSpace(name); n != "" {
		return n
	}
	return "Administrador"
}

// formatAttendanceDate converts a YYYY-MM-DD string into DD/MM/YYYY for the
// SMS body. If parsing fails, the original string is returned so we never
// produce a confusing empty placeholder.
func formatAttendanceDate(yyyymmdd string) string {
	t, err := time.Parse("2006-01-02", strings.TrimSpace(yyyymmdd))
	if err != nil {
		return strings.TrimSpace(yyyymmdd)
	}
	return t.Format("02/01/2006")
}

// formatCOP renders a Colombian peso amount as "$1.234.567" (no decimals,
// thousands separator with periods).
func formatCOP(v float64) string {
	whole := int64(v)
	negative := whole < 0
	if negative {
		whole = -whole
	}
	digits := fmt.Sprintf("%d", whole)
	if len(digits) <= 3 {
		if negative {
			return "$-" + digits
		}
		return "$" + digits
	}
	// Insert "." every 3 digits from the right.
	out := make([]byte, 0, len(digits)+len(digits)/3)
	for i, c := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, byte(c))
	}
	if negative {
		return "$-" + string(out)
	}
	return "$" + string(out)
}

func shortenID(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// ----- Templates -----

func buildPaymentBody(event SMSPaymentEvent) string {
	return fmt.Sprintf(
		"Harvard Enterprise: Recibimos pago de %s (%d clase(s), %s) para %s. Procesado por: %s el %s. ID: %s",
		formatCOP(event.PaymentValue),
		event.Clases,
		strings.TrimSpace(event.MetodoPago),
		studentLabel(event.EstudianteFullName, event.EstudianteNumeroID),
		adminLabel(event.AdminName),
		time.Now().In(bogotaTZ).Format("02/01/2006"),
		shortenID(event.PaymentID, 8),
	)
}

func buildAttendancePresentBody(event SMSAttendanceEvent) string {
	return fmt.Sprintf(
		"Harvard Enterprise: %s fue marcado/a PRESENTE en %s hoy %s.",
		studentLabel(event.EstudianteFullName, event.EstudianteNumeroID),
		strings.TrimSpace(event.CourseName),
		formatAttendanceDate(event.Date),
	)
}

func buildAttendanceAbsentBody(event SMSAttendanceEvent) string {
	return fmt.Sprintf(
		"Harvard Enterprise: %s NO se presentó a %s hoy %s. Si fue justificado, contacte al coordinador.",
		studentLabel(event.EstudianteFullName, event.EstudianteNumeroID),
		strings.TrimSpace(event.CourseName),
		formatAttendanceDate(event.Date),
	)
}

// ----- Low-level send / log -----

// sendOrLog decides between dry-run logging and actually POSTing to Twilio.
// It NEVER returns an error: it logs and swallows. Intended to be called
// from a `go` goroutine in the originating handler.
func sendOrLog(ctx context.Context, kind, to, body string) {
	if envBool(envSMSDryRun, true) {
		log.Printf("[SMS][DRY_RUN][%s] to=%s body_len=%d body=%q", kind, to, len(body), body)
		return
	}

	sid := strings.TrimSpace(os.Getenv(envTwilioAccountSid))
	token := strings.TrimSpace(os.Getenv(envTwilioAuthToken))
	msgSvc := strings.TrimSpace(os.Getenv(envTwilioMsgSvcSid))
	if sid == "" || token == "" || msgSvc == "" {
		log.Printf(
			"[SMS][CONFIG_ERROR][%s] missing Twilio env vars (account_sid_set=%v auth_token_set=%v msg_svc_set=%v), would send to=%s",
			kind, sid != "", token != "", msgSvc != "", to,
		)
		return
	}

	form := url.Values{}
	form.Set("To", to)
	form.Set("MessagingServiceSid", msgSvc)
	form.Set("Body", body)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", sid),
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		log.Printf("[SMS][ERROR][%s] could not build request: %v", kind, err)
		return
	}
	req.SetBasicAuth(sid, token)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: smsHTTPTimeout}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[SMS][NETWORK_ERROR][%s] to=%s err=%v", kind, to, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[SMS][SENT][%s] to=%s status=%d", kind, to, resp.StatusCode)
		return
	}
	log.Printf("[SMS][FAILED][%s] to=%s status=%d", kind, to, resp.StatusCode)
}

func logSMSSkipped(kind, reason string) {
	log.Printf("[SMS][SKIPPED][%s] reason=%q", kind, reason)
}
