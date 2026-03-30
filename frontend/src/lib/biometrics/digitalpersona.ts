"use client";

import { useEffect, useRef, useState } from "react";

export type FingerCaptureMode = "enroll-right" | "enroll-left" | "attendance";

interface FingerprintEventPayload {
  samples?: unknown[];
  sample?: string;
}

interface FingerprintQualityPayload {
  quality?: number;
}

interface FingerprintErrorPayload {
  error?: string | number;
}

interface FingerprintReaderApi {
  on(event: string, handler: (payload: unknown) => void): void;
  off(): void;
  enumerateDevices(): Promise<unknown[]>;
  startAcquisition(sampleFormat: unknown): Promise<void>;
  stopAcquisition(): Promise<void>;
}

interface FingerprintSdk {
  FingerprintReader?: new () => FingerprintReaderApi;
  SampleFormat?: {
    PngImage?: unknown;
  };
}

interface UseFingerprintReaderResult {
  ready: boolean;
  isCapturing: boolean;
  deviceStatus: string;
  captureStatus: string;
  lastQuality: number | null;
  capture: (mode: FingerCaptureMode) => Promise<string | null>;
}

function extractPngSample(event: FingerprintEventPayload): string {
  const firstSample = event?.samples?.[0];
  let value = "";

  if (typeof firstSample === "string") {
    value = firstSample;
  } else if (firstSample && typeof firstSample === "object") {
    const sampleObject = firstSample as Record<string, unknown>;
    value =
      typeof sampleObject.Data === "string"
        ? sampleObject.Data
        : typeof sampleObject.data === "string"
          ? sampleObject.data
          : "";
  }

  if (!value && typeof event?.sample === "string") {
    value = event.sample;
  }

  return typeof value === "string" ? value.trim() : "";
}

export function useDigitalPersonaFingerprintReader(): UseFingerprintReaderResult {
  const [ready, setReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState("Inicializando lector...");
  const [captureStatus, setCaptureStatus] = useState("Sin captura activa");
  const [lastQuality, setLastQuality] = useState<number | null>(null);

  const readerRef = useRef<FingerprintReaderApi | null>(null);
  const sampleFormatRef = useRef<unknown>(null);
  const currentModeRef = useRef<FingerCaptureMode | null>(null);
  const pendingResolveRef = useRef<((value: string | null) => void) | null>(
    null,
  );

  useEffect(() => {
    let isUnmounted = false;
    let reader: FingerprintReaderApi | null = null;

    const initialize = async () => {
      try {
        if (!globalThis.WebSdk?.WebChannelClient) {
          throw new Error(
            "Runtime WebSdk no encontrado. Verifique los scripts en public/.",
          );
        }

        const sdk =
          (globalThis.dp?.devices as FingerprintSdk | undefined) ?? {};
        if (!sdk.FingerprintReader || !sdk.SampleFormat?.PngImage) {
          throw new Error(
            "Bundles de DigitalPersona no disponibles. Cargue dp.core.bundle.js y dp.devices.bundle.js.",
          );
        }

        reader = new sdk.FingerprintReader();
        if (isUnmounted) return;

        readerRef.current = reader;
        sampleFormatRef.current = sdk.SampleFormat.PngImage;

        reader.on("DeviceConnected", () => {
          setDeviceStatus("Lector conectado");
        });

        reader.on("DeviceDisconnected", () => {
          setDeviceStatus("Lector desconectado");
          setIsCapturing(false);
        });

        reader.on("AcquisitionStarted", () => {
          setIsCapturing(true);
          setCaptureStatus("Lector activo. Coloque el dedo sobre el sensor.");
        });

        reader.on("AcquisitionStopped", () => {
          setIsCapturing(false);
          setCaptureStatus("Captura detenida");
          currentModeRef.current = null;
        });

        reader.on("QualityReported", (event: FingerprintQualityPayload) => {
          const quality =
            typeof event?.quality === "number" ? event.quality : null;
          setLastQuality(quality);
        });

        reader.on("ErrorOccurred", (event: FingerprintErrorPayload) => {
          setCaptureStatus(
            `Error del lector: ${String(event?.error ?? "desconocido")}`,
          );
        });

        reader.on("CommunicationFailed", () => {
          setCaptureStatus(
            "Fallo de comunicacion con el lector. Verifique el servicio local de DigitalPersona.",
          );
        });

        reader.on("SamplesAcquired", async (event: FingerprintEventPayload) => {
          const sample = extractPngSample(event);
          if (!sample) {
            setCaptureStatus(
              "Se adquirio una muestra vacia. Verifique formato PNG y compatibilidad del lector.",
            );
            pendingResolveRef.current?.(null);
            pendingResolveRef.current = null;
            return;
          }

          setCaptureStatus(`Muestra capturada (${sample.length} caracteres)`);
          pendingResolveRef.current?.(sample);
          pendingResolveRef.current = null;

          try {
            await reader?.stopAcquisition();
          } catch {
            setIsCapturing(false);
            currentModeRef.current = null;
          }
        });

        const devices = await reader.enumerateDevices();
        if (!devices || devices.length === 0) {
          setDeviceStatus("No se detecto lector de huellas");
        } else {
          setDeviceStatus(`Lector listo (${devices.length} detectado/s)`);
        }

        setReady(true);
      } catch (error) {
        setReady(false);
        setDeviceStatus("No se pudo inicializar el lector");
        setCaptureStatus(
          error instanceof Error ? error.message : "Error de inicializacion",
        );
      }
    };

    initialize();

    return () => {
      isUnmounted = true;
      const cleanup = async () => {
        try {
          await reader?.stopAcquisition();
        } catch {
          // already stopped
        }
      };
      cleanup();
      reader?.off();
      pendingResolveRef.current = null;
      currentModeRef.current = null;
    };
  }, []);

  const capture = async (mode: FingerCaptureMode): Promise<string | null> => {
    const reader = readerRef.current;
    const sampleFormat = sampleFormatRef.current;

    if (!reader || !sampleFormat) {
      setCaptureStatus("El lector aun no esta listo");
      return null;
    }

    if (pendingResolveRef.current) {
      setCaptureStatus("Ya existe una captura en curso");
      return null;
    }

    currentModeRef.current = mode;

    return new Promise<string | null>(async (resolve) => {
      pendingResolveRef.current = resolve;

      try {
        await reader.startAcquisition(sampleFormat);
      } catch (error) {
        pendingResolveRef.current = null;
        currentModeRef.current = null;
        setCaptureStatus(
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la captura de huella",
        );
        resolve(null);
      }
    });
  };

  return {
    ready,
    isCapturing,
    deviceStatus,
    captureStatus,
    lastQuality,
    capture,
  };
}
