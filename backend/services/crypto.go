package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"golang.org/x/crypto/pbkdf2"
	"fingerprint-backend/models"
)

const (
	// AES-256-GCM: 32-byte key
	encryptionKeySize = 32
	// GCM standard nonce/IV size: 12 bytes
	nonceSize = 12
)

// DeriveKeyFromPassphrase derives a 256-bit AES key from a passphrase using PBKDF2.
func DeriveKeyFromPassphrase(passphrase string, iterations int) ([]byte, error) {
	salt := []byte("student-biometric-salt") // In production, use a per-tenant or random salt
	if len(passphrase) == 0 {
		return nil, errors.New("passphrase cannot be empty")
	}
	key := pbkdf2.Key([]byte(passphrase), salt, iterations, encryptionKeySize, sha256.New)
	return key, nil
}

// EncryptPNG encrypts a base64-encoded PNG string using AES-256-GCM.
// Returns the encrypted payload (IV + ciphertext as base64).
func (a *App) EncryptPNG(pngBase64 string) (*models.EncryptedPayload, error) {
	// Derive encryption key (in production, fetch from KMS)
	encryptionKey, err := DeriveKeyFromPassphrase("student-biometric-default-key", 100000)
	if err != nil {
		return nil, err
	}

	return a.encryptWithKey([]byte(pngBase64), encryptionKey)
}

// DecryptPNG decrypts an encrypted payload back to the original PNG base64 string.
func (a *App) DecryptPNG(payload *models.EncryptedPayload) (string, error) {
	if payload == nil {
		return "", errors.New("encrypted payload is nil")
	}

	// Derive the same encryption key used during encryption
	encryptionKey, err := DeriveKeyFromPassphrase("student-biometric-default-key", 100000)
	if err != nil {
		return "", err
	}

	decrypted, err := a.decryptWithKey(payload, encryptionKey)
	if err != nil {
		return "", err
	}

	return string(decrypted), nil
}

// EncryptTemplate encrypts a base64-encoded CBOR template for storage in DB.
// Returns the encrypted payload (IV + ciphertext as base64).
func (a *App) EncryptTemplate(templateBase64 string) (*models.EncryptedPayload, error) {
	// Derive encryption key (same passphrase for now; ideally use KMS with tenant isolation)
	encryptionKey, err := DeriveKeyFromPassphrase("student-biometric-template-key", 100000)
	if err != nil {
		return nil, err
	}

	return a.encryptWithKey([]byte(templateBase64), encryptionKey)
}

// DecryptTemplate decrypts an encrypted template payload back to base64 string.
func (a *App) DecryptTemplate(payload *models.EncryptedPayload) (string, error) {
	if payload == nil {
		return "", errors.New("encrypted payload is nil")
	}

	encryptionKey, err := DeriveKeyFromPassphrase("student-biometric-template-key", 100000)
	if err != nil {
		return "", err
	}

	decrypted, err := a.decryptWithKey(payload, encryptionKey)
	if err != nil {
		return "", err
	}

	return string(decrypted), nil
}

// encryptWithKey is a helper that encrypts plaintext with AES-256-GCM.
func (a *App) encryptWithKey(plaintext []byte, key []byte) (*models.EncryptedPayload, error) {
	if len(key) != encryptionKeySize {
		return nil, fmt.Errorf("invalid key size: expected %d bytes, got %d", encryptionKeySize, len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// Generate a random nonce (IV)
	nonce := make([]byte, nonceSize)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	// Encrypt plaintext; GCM automatically appends the authentication tag
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	return &models.EncryptedPayload{
		IV:         base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
	}, nil
}

// decryptWithKey is a helper that decrypts an AES-256-GCM encrypted payload.
func (a *App) decryptWithKey(payload *models.EncryptedPayload, key []byte) ([]byte, error) {
	if len(key) != encryptionKeySize {
		return nil, fmt.Errorf("invalid key size: expected %d bytes, got %d", encryptionKeySize, len(key))
	}

	// Decode base64 IV and ciphertext
	nonce, err := base64.StdEncoding.DecodeString(payload.IV)
	if err != nil {
		return nil, fmt.Errorf("invalid IV encoding: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(payload.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("invalid ciphertext encoding: %w", err)
	}

	if len(nonce) != nonceSize {
		return nil, fmt.Errorf("invalid nonce size: expected %d bytes, got %d", nonceSize, len(nonce))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// Decrypt ciphertext (GCM verifies the authentication tag)
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	return plaintext, nil
}
