package middleware

import (
    "net/http"
    "net/url"
    "strings"
)

import "github.com/gin-gonic/gin"

func CorsMiddleware(originList string) gin.HandlerFunc {
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
        if c.Request.URL.Path == "/api/health" || c.Request.URL.Path == "/health" {
            c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
        } else {
            originAllowed := len(allowed) == 0 || allowed[origin] || (allowAnyLoopbackOrigin && isLoopbackOrigin(origin))
            if origin != "" && originAllowed {
                c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
                c.Writer.Header().Set("Vary", "Origin")
            }
        }

        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, X-Backend-Access-Key, X-Frontend-Origin")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")

        if c.Request.Method == http.MethodOptions {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }

        c.Next()
    }
}

func FrontendOnlyMiddleware(originList string, sharedKey string) gin.HandlerFunc {
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

    isAllowedOrigin := func(origin string) bool {
        if origin == "" {
            return false
        }
        if len(allowed) == 0 {
            return true
        }
        return allowed[origin] || (allowAnyLoopbackOrigin && isLoopbackOrigin(origin))
    }

    originFromReferer := func(referer string) string {
        u, err := url.Parse(strings.TrimSpace(referer))
        if err != nil || u.Scheme == "" || u.Host == "" {
            return ""
        }
        return u.Scheme + "://" + u.Host
    }

    return func(c *gin.Context) {
        path := c.Request.URL.Path
        if path == "/health" || path == "/api/health" || !strings.HasPrefix(path, "/api/") {
            c.Next()
            return
        }

        providedKey := strings.TrimSpace(c.GetHeader("X-Backend-Access-Key"))
        if sharedKey != "" && providedKey != "" && subtleConstantTimeCompare(providedKey, sharedKey) {
            c.Next()
            return
        }

        origin := strings.TrimSpace(c.GetHeader("Origin"))
        if isAllowedOrigin(origin) {
            c.Next()
            return
        }

        forwardedOrigin := strings.TrimSpace(c.GetHeader("X-Frontend-Origin"))
        if isAllowedOrigin(forwardedOrigin) {
            c.Next()
            return
        }

        refererOrigin := originFromReferer(c.GetHeader("Referer"))
        if isAllowedOrigin(refererOrigin) {
            c.Next()
            return
        }

        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
            "error": "Forbidden: endpoint accesible solo desde el frontend autorizado",
        })
    }
}

// small helper to avoid importing crypto/subtle in this package for tests
func subtleConstantTimeCompare(a, b string) bool {
    if len(a) != len(b) {
        return false
    }
    var res byte
    for i := 0; i < len(a); i++ {
        res |= a[i] ^ b[i]
    }
    return res == 0
}
