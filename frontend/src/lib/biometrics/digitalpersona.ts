"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  on(event: string, handler: (payload: any) => void): void;
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

const FingerprintReaderContext =
  createContext<UseFingerprintReaderResult | null>(null);

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

function useDigitalPersonaFingerprintReaderState(): UseFingerprintReaderResult {
  const INIT_RETRY_MIN_DELAY_MS = 1000;
  const INIT_RETRY_MAX_DELAY_MS = 8000;
  const RECONNECT_MIN_DELAY_MS = 1500;
  const RECONNECT_MAX_DELAY_MS = 10000;

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
  const initRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRetryDelayRef = useRef(INIT_RETRY_MIN_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_MIN_DELAY_MS);

  const clearPendingCapture = (reason?: string) => {
    if (reason) {
      setCaptureStatus(reason);
    }

    pendingResolveRef.current?.(null);
    pendingResolveRef.current = null;
    currentModeRef.current = null;
    setIsCapturing(false);
  };

  useEffect(() => {
    let isUnmounted = false;
    let reader: FingerprintReaderApi | null = null;

    const clearInitRetryTimer = () => {
      if (initRetryTimerRef.current) {
        clearTimeout(initRetryTimerRef.current);
        initRetryTimerRef.current = null;
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleInitializeRetry = () => {
      if (isUnmounted || initRetryTimerRef.current) {
        return;
      }

      const delay = initRetryDelayRef.current;
      initRetryTimerRef.current = setTimeout(() => {
        initRetryTimerRef.current = null;
        void initialize();
      }, delay);
    };

    const runDeviceCheck = async (currentReader: FingerprintReaderApi) => {
      const devices = await currentReader.enumerateDevices();

      if (!devices || devices.length === 0) {
        setReady(false);
        setDeviceStatus("No se detecto lector de huellas");
        return false;
      }

      setReady(true);
      setDeviceStatus(`Lector listo (${devices.length} detectado/s)`);
      reconnectDelayRef.current = RECONNECT_MIN_DELAY_MS;
      return true;
    };

    const scheduleReconnect = () => {
      if (isUnmounted || reconnectTimerRef.current) {
        return;
      }

      const delay = reconnectDelayRef.current;
      reconnectTimerRef.current = setTimeout(async () => {
        reconnectTimerRef.current = null;
        const activeReader = readerRef.current;

        if (isUnmounted) {
          return;
        }

        if (!activeReader) {
          setReady(false);
          setDeviceStatus("Reconectando lector...");
          scheduleInitializeRetry();
          return;
        }

        try {
          const found = await runDeviceCheck(activeReader);
          if (!found) {
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 2,
              RECONNECT_MAX_DELAY_MS,
            );
            scheduleReconnect();
          }
        } catch {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            RECONNECT_MAX_DELAY_MS,
          );
          setReady(false);
          setDeviceStatus("Reconectando lector...");
          scheduleReconnect();
        }
      }, delay);
    };

    const initialize = async () => {
      try {
        const existingReader = readerRef.current;
        if (existingReader) {
          await runDeviceCheck(existingReader);
          return;
        }

        if (!globalThis.WebSdk?.WebChannelClient) {
          setReady(false);
          setDeviceStatus("Esperando runtime WebSdk...");
          setCaptureStatus(
            "Inicializando runtime del lector. Reintentando automaticamente...",
          );
          initRetryDelayRef.current = Math.min(
            initRetryDelayRef.current * 2,
            INIT_RETRY_MAX_DELAY_MS,
          );
          scheduleInitializeRetry();
          return;
        }

        const sdk =
          (globalThis.dp?.devices as FingerprintSdk | undefined) ?? {};
        if (!sdk.FingerprintReader || !sdk.SampleFormat?.PngImage) {
          setReady(false);
          setDeviceStatus("Esperando modulos de DigitalPersona...");
          setCaptureStatus(
            "Cargando bundles de DigitalPersona. Reintentando automaticamente...",
          );
          initRetryDelayRef.current = Math.min(
            initRetryDelayRef.current * 2,
            INIT_RETRY_MAX_DELAY_MS,
          );
          scheduleInitializeRetry();
          return;
        }

        clearInitRetryTimer();
        initRetryDelayRef.current = INIT_RETRY_MIN_DELAY_MS;

        reader = new sdk.FingerprintReader();
        if (isUnmounted) return;

        readerRef.current = reader;
        sampleFormatRef.current = sdk.SampleFormat.PngImage;

        reader.on("DeviceConnected", () => {
          const connectedReader = reader;
          if (!connectedReader) return;

          setDeviceStatus("Lector conectado");
          reconnectDelayRef.current = RECONNECT_MIN_DELAY_MS;
          clearReconnectTimer();
          void runDeviceCheck(connectedReader).catch(() => {
            setReady(false);
            setDeviceStatus("Reconectando lector...");
            scheduleReconnect();
          });
        });

        reader.on("DeviceDisconnected", () => {
          setReady(false);
          setDeviceStatus("Lector desconectado");
          clearPendingCapture(
            "Lector desconectado. Vuelva a conectar el dispositivo.",
          );
          scheduleReconnect();
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
          setReady(false);
          setCaptureStatus(
            "Fallo de comunicacion con el lector. Verifique el servicio local de DigitalPersona.",
          );
          setDeviceStatus("Reconectando lector...");
          scheduleReconnect();
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

        await runDeviceCheck(reader);
      } catch (error) {
        setReady(false);
        setDeviceStatus("No se pudo inicializar el lector");
        setCaptureStatus(
          error instanceof Error ? error.message : "Error de inicializacion",
        );
        initRetryDelayRef.current = Math.min(
          initRetryDelayRef.current * 2,
          INIT_RETRY_MAX_DELAY_MS,
        );
        scheduleInitializeRetry();
      }
    };

    const checkOnWindowFocus = () => {
      const activeReader = readerRef.current;
      if (isUnmounted) return;

      if (!activeReader) {
        void initialize();
        return;
      }

      void runDeviceCheck(activeReader).catch(() => {
        setReady(false);
        setDeviceStatus("Reconectando lector...");
        scheduleReconnect();
      });
    };

    const checkOnVisibility = () => {
      if (document.visibilityState !== "visible") return;
      checkOnWindowFocus();
    };

    initialize();
    window.addEventListener("focus", checkOnWindowFocus);
    document.addEventListener("visibilitychange", checkOnVisibility);

    return () => {
      isUnmounted = true;
      clearInitRetryTimer();
      clearReconnectTimer();
      window.removeEventListener("focus", checkOnWindowFocus);
      document.removeEventListener("visibilitychange", checkOnVisibility);
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

export function DigitalPersonaFingerprintProvider({
  children,
}: {
  children: ReactNode;
}) {
  const reader = useDigitalPersonaFingerprintReaderState();

  return createElement(FingerprintReaderContext.Provider, {
    value: reader,
    children,
  });
}

export function useDigitalPersonaFingerprintReader(): UseFingerprintReaderResult {
  const context = useContext(FingerprintReaderContext);

  if (!context) {
    throw new Error(
      "useDigitalPersonaFingerprintReader debe usarse dentro de DigitalPersonaFingerprintProvider.",
    );
  }

  return context;
}
