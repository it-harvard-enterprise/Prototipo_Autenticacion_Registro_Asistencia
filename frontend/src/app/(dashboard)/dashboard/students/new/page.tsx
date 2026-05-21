"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  CircleDollarSign,
  Fingerprint,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// Use API route instead of importing server action directly from client
import { useDigitalPersonaFingerprintReader } from "@/lib/biometrics/digitalpersona";
import {
  deriveKeyFromPassphrase,
  encryptAESGCM,
  type EncryptedPayload,
} from "@/lib/crypto/aes-gcm";
import { translateErrorMessage } from "@/lib/error-messages";
import {
  IDENTIFICATION_TYPE_OPTIONS,
  IDENTIFICATION_TYPE_VALUES,
} from "@/lib/identification-types";
import {
  COLOMBIA_EPS_OPTIONS,
  EPS_OTHER_OPTION,
  PAYMENT_METHOD_OPTIONS,
  STUDENT_GRADE_OPTIONS,
} from "@/lib/student-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseCurrencyToNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrencyInput(value: string): string {
  const parsed = parseCurrencyToNumber(value);
  if (parsed === null) return "";
  return currencyFormatter.format(parsed);
}

const TEMP_FINGERPRINT_PLACEHOLDER = "PENDING_FINGERPRINT";

interface AdminCoordinator {
  id: string;
  nombres: string;
  apellidos: string;
}

const studentSchema = z
  .object({
    tipo_identificacion: z.enum(IDENTIFICATION_TYPE_VALUES, {
      message: "Debe seleccionar un tipo de identificacion",
    }),
    numero_identificacion: z
      .string()
      .min(1, "La identificación es requerida")
      .max(20),
    no_matricula: z.string().max(20).optional(),
    nombres: z.string().min(2, "Los nombres son requeridos").max(100),
    apellidos: z.string().min(2, "Los apellidos son requeridos").max(100),
    email: z.string().email("Ingrese un correo electrónico válido"),
    grado: z.enum(STUDENT_GRADE_OPTIONS, {
      message: "Debe seleccionar un grado válido",
    }),
    telefono: z.string().min(1, "El teléfono es requerido").max(20),
    direccion: z.string().min(1, "La dirección es requerida").max(200),
    barrio: z.string().min(1, "El barrio es requerido").max(100),
    nombre_acudiente: z
      .string()
      .min(1, "El nombre del acudiente es requerido")
      .max(200),
    telefono_acudiente: z
      .string()
      .min(1, "El teléfono del acudiente es requerido")
      .max(20),
    eps_select: z.string().min(1, "Debe seleccionar una EPS"),
    eps_otra: z.string().optional(),
    coordinador_academico: z
      .string()
      .min(1, "Debe seleccionar un coordinador académico"),
    programa: z.string().min(1, "El programa es requerido").max(100),
    fecha_inicio: z.string().min(1, "La fecha de inicio es requerida"),
    fecha_matricula: z.string().min(1, "La fecha de matrícula es requerida"),
    valor_matricula: z
      .string()
      .min(1, "El valor de matrícula es requerido")
      .refine((val) => (parseCurrencyToNumber(val) ?? -1) >= 0, {
        message: "El valor de matrícula debe ser mayor o igual a 0",
      }),
    medio_pago_matricula: z.enum(
      PAYMENT_METHOD_OPTIONS.map((item) => item.value) as [
        "EFECTIVO",
        "TRANSFERENCIA",
        "NEQUI",
        "DAVIPLATA",
        "OTRO",
      ],
      {
        message: "Debe seleccionar el medio de pago de matrícula",
      },
    ),
    valor_apoyo_semanal: z
      .string()
      .min(1, "El valor de apoyo semanal es requerido")
      .refine((val) => (parseCurrencyToNumber(val) ?? 0) > 0, {
        message: "El valor de apoyo semanal debe ser mayor que 0",
      }),
    huella_indice_derecho: z.string().trim().optional(),
    huella_indice_izquierdo: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.eps_select === EPS_OTHER_OPTION &&
      (!data.eps_otra || data.eps_otra.trim().length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eps_otra"],
        message: "Debe escribir la EPS cuando selecciona 'Otro'",
      });
    }
  });

type StudentFormValues = z.input<typeof studentSchema>;

export default function NewStudentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [coordinatorOptions, setCoordinatorOptions] = useState<string[]>([]);
  const [isLoadingCoordinators, setIsLoadingCoordinators] = useState(true);
  const [capturingSide, setCapturingSide] = useState<
    "huella_indice_derecho" | "huella_indice_izquierdo" | null
  >(null);

  const {
    ready: readerReady,
    isCapturing,
    isReconnecting,
    deviceStatus,
    captureStatus,
    lastQuality,
    capture,
    reconnect,
  } = useDigitalPersonaFingerprintReader();

  async function handleReconnectReader() {
    const reconnected = await reconnect();
    if (reconnected) {
      toast.success("Lector reconectado correctamente");
    } else {
      toast.error("No fue posible reconectar el lector");
    }
  }

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      tipo_identificacion: "CC",
      numero_identificacion: "",
      no_matricula: "",
      nombres: "",
      apellidos: "",
      email: "",
      grado: "1",
      telefono: "",
      direccion: "",
      barrio: "",
      nombre_acudiente: "",
      telefono_acudiente: "",
      eps_select: "NUEVA EPS",
      eps_otra: "",
      coordinador_academico: "",
      huella_indice_derecho: "",
      huella_indice_izquierdo: "",
      programa: "",
      fecha_inicio: "",
      fecha_matricula: "",
      valor_matricula: "",
      medio_pago_matricula: "EFECTIVO",
      valor_apoyo_semanal: "",
    },
  });

  useEffect(() => {
    void fetch("/api/start-service").catch(() => {
      // Keep this fire-and-forget on page load.
    });
  }, []);

  useEffect(() => {
    async function fetchCoordinators() {
      setIsLoadingCoordinators(true);

      try {
        const res = await fetch("/api/admins", { method: "GET" });
        const result = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: AdminCoordinator[];
          error?: string;
        } | null;

        if (!res.ok || !result?.success) {
          toast.error(
            result?.error ?? "No fue posible cargar coordinadores académicos",
          );
          setCoordinatorOptions([]);
          return;
        }

        const options = (result.data ?? [])
          .map((admin) => `${admin.nombres ?? ""} ${admin.apellidos ?? ""}`)
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
          .sort((a, b) => a.localeCompare(b, "es"));

        setCoordinatorOptions(options);

        if (!form.getValues("coordinador_academico") && options.length > 0) {
          form.setValue("coordinador_academico", options[0], {
            shouldValidate: true,
          });
        }
      } catch {
        toast.error("No fue posible cargar coordinadores académicos");
        setCoordinatorOptions([]);
      } finally {
        setIsLoadingCoordinators(false);
      }
    }

    void fetchCoordinators();
  }, [form]);

  async function onSubmit(values: StudentFormValues) {
    const epsValue =
      values.eps_select === EPS_OTHER_OPTION
        ? (values.eps_otra ?? "").trim()
        : values.eps_select;

    if (!epsValue) {
      toast.error("Debe seleccionar o escribir la EPS");
      return;
    }

    const rightFingerprint = values.huella_indice_derecho?.trim() ?? "";
    const leftFingerprint = values.huella_indice_izquierdo?.trim() ?? "";

    setIsLoading(true);

    try {
      const frontendPassphrase =
        process.env.NEXT_PUBLIC_BIOMETRIC_PASSPHRASE_PNG?.trim() ?? "";
      if (!frontendPassphrase) {
        toast.error(
          "Falta NEXT_PUBLIC_BIOMETRIC_PASSPHRASE_PNG en el entorno del frontend.",
        );
        setIsLoading(false);
        return;
      }

      const encryptionKey = await deriveKeyFromPassphrase(frontendPassphrase);
      const rightEncrypted: EncryptedPayload | null = rightFingerprint
        ? await encryptAESGCM(rightFingerprint, encryptionKey)
        : null;
      const leftEncrypted: EncryptedPayload | null = leftFingerprint
        ? await encryptAESGCM(leftFingerprint, encryptionKey)
        : null;

      const res = await fetch(`/api/students/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo_identificacion: values.tipo_identificacion,
          numero_identificacion: values.numero_identificacion,
          no_matricula: values.no_matricula || null,
          nombres: values.nombres,
          apellidos: values.apellidos,
          email: values.email,
          grado: values.grado,
          telefono: values.telefono,
          direccion: values.direccion,
          barrio: values.barrio,
          nombre_acudiente: values.nombre_acudiente,
          telefono_acudiente: values.telefono_acudiente,
          eps: epsValue,
          coordinador_academico: values.coordinador_academico,
          programa: values.programa,
          fecha_inicio: values.fecha_inicio,
          fecha_matricula: values.fecha_matricula,
          valor_matricula: parseCurrencyToNumber(values.valor_matricula) ?? 0,
          medio_pago_matricula: values.medio_pago_matricula,
          valor_apoyo_semanal:
            parseCurrencyToNumber(values.valor_apoyo_semanal) ?? 0,
          ...(rightEncrypted && {
            huella_indice_derecho_encrypted: rightEncrypted,
          }),
          ...(leftEncrypted && {
            huella_indice_izquierdo_encrypted: leftEncrypted,
          }),
        }),
      });

      const result = await res
        .json()
        .catch(() => ({ success: false, error: "No response" }));

      if (res.ok && result?.success) {
        toast.success("Estudiante creado correctamente");
        router.replace(
          `/dashboard/students/${encodeURIComponent(values.numero_identificacion)}?autogenerate_pdf=1`,
        );
      } else {
        toast.error(
          translateErrorMessage(result.error, "Error al crear el estudiante"),
        );
        setIsLoading(false);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Error creando estudiante: ${translateErrorMessage(err.message)}`
          : "Error desconocido creando estudiante",
      );
      setIsLoading(false);
    }
  }

  async function handleCaptureFingerprint(
    side: "huella_indice_derecho" | "huella_indice_izquierdo",
  ) {
    if (!readerReady) {
      toast.error(
        "El lector no esta listo. Verifique la conexion y el servicio de DigitalPersona.",
      );
      return;
    }

    setCapturingSide(side);
    const mode =
      side === "huella_indice_derecho" ? "enroll-right" : "enroll-left";
    const sample = await capture(mode);
    setCapturingSide(null);

    if (!sample) {
      toast.error("No fue posible capturar la huella. Intente nuevamente.");
      return;
    }

    form.setValue(side, sample, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    toast.success("Huella capturada correctamente");
  }

  const rightFingerprintValue = form.watch("huella_indice_derecho") ?? "";
  const leftFingerprintValue = form.watch("huella_indice_izquierdo") ?? "";
  const hasBothFingerprints =
    rightFingerprintValue.trim().length > 0 &&
    leftFingerprintValue.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/students">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Estudiante</h1>
        </div>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">Registro de estudiante</CardTitle>
          <CardDescription>
            Complete los campos obligatorios y opcionales para crear un
            estudiante nuevo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo_identificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de identificación *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                        >
                          {IDENTIFICATION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero_identificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de identificación *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="no_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. matrícula</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Opcional (se autogenera si está vacío)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombres"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombres *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="apellidos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellidos *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="estudiante@correo.com"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="grado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                        >
                          {STUDENT_GRADE_OPTIONS.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="programa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Programa *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barrio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barrio *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="nombre_acudiente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del acudiente *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefono_acudiente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono del acudiente *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eps_select"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EPS *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                        >
                          {COLOMBIA_EPS_OPTIONS.map((eps) => (
                            <option key={eps} value={eps}>
                              {eps}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="coordinador_academico"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coordinador académico *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          disabled={isLoadingCoordinators}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                        >
                          {isLoadingCoordinators && (
                            <option value="">Cargando coordinadores...</option>
                          )}
                          {!isLoadingCoordinators &&
                            coordinatorOptions.map((coordinator) => (
                              <option key={coordinator} value={coordinator}>
                                {coordinator}
                              </option>
                            ))}
                          {!isLoadingCoordinators &&
                            coordinatorOptions.length === 0 && (
                              <option value="">
                                No hay administradores disponibles
                              </option>
                            )}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("eps_select") === EPS_OTHER_OPTION && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="eps_otra"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escriba la EPS *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Mi EPS" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fecha_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de inicio *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fecha_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de matrícula *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="valor_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor matrícula *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="Ej: 1.234.567,89"
                            className="pl-10"
                            value={field.value ?? ""}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                            onBlur={() => {
                              field.onChange(
                                formatCurrencyInput(field.value ?? ""),
                              );
                              field.onBlur();
                            }}
                            name={field.name}
                            ref={field.ref}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor_apoyo_semanal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor apoyo semanal *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="Ej: 45.000,00"
                            className="pl-10"
                            value={field.value ?? ""}
                            onChange={(event) =>
                              field.onChange(event.target.value)
                            }
                            onBlur={() => {
                              field.onChange(
                                formatCurrencyInput(field.value ?? ""),
                              );
                              field.onBlur();
                            }}
                            name={field.name}
                            ref={field.ref}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="medio_pago_matricula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medio de pago matrícula *</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                        >
                          {PAYMENT_METHOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Captura de Huellas
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-md border p-3 bg-white">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      Lector
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        readerReady ? "text-green-700" : "text-[#982725]"
                      }`}
                    >
                      {deviceStatus}
                    </p>
                  </div>
                  <div className="rounded-md border p-3 bg-white h-[88px] flex flex-col">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      Estado de captura
                    </p>
                    <p className="text-sm mt-1 text-gray-700 flex-1 overflow-y-auto break-words leading-5 pr-1">
                      {captureStatus}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-dashed border-gray-300">
                    <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
                      <div
                        className={`rounded-full p-3 ${
                          rightFingerprintValue
                            ? "bg-green-500/10"
                            : "bg-[#b92f2d]/10"
                        }`}
                      >
                        <Fingerprint
                          className={`h-7 w-7 ${
                            rightFingerprintValue
                              ? "text-green-600"
                              : "text-[#b92f2d]"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Huella índice derecho
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {rightFingerprintValue
                            ? "Huella capturada"
                            : "Sin captura"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          handleCaptureFingerprint("huella_indice_derecho")
                        }
                        disabled={
                          isLoading ||
                          isReconnecting ||
                          isCapturing ||
                          capturingSide === "huella_indice_izquierdo"
                        }
                      >
                        {isCapturing &&
                        capturingSide === "huella_indice_derecho"
                          ? "Capturando..."
                          : rightFingerprintValue
                            ? "Capturar Huella Otra vez"
                            : "Capturar Huella"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed border-gray-300">
                    <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
                      <div
                        className={`rounded-full p-3 ${
                          leftFingerprintValue
                            ? "bg-green-500/10"
                            : "bg-[#b92f2d]/10"
                        }`}
                      >
                        <Fingerprint
                          className={`h-7 w-7 ${
                            leftFingerprintValue
                              ? "text-green-600"
                              : "text-[#b92f2d]"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Huella índice izquierdo
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {leftFingerprintValue
                            ? "Huella capturada"
                            : "Sin captura"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          handleCaptureFingerprint("huella_indice_izquierdo")
                        }
                        disabled={
                          isLoading ||
                          isReconnecting ||
                          isCapturing ||
                          capturingSide === "huella_indice_derecho"
                        }
                      >
                        {isCapturing &&
                        capturingSide === "huella_indice_izquierdo"
                          ? "Capturando..."
                          : leftFingerprintValue
                            ? "Capturar Huella Otra vez"
                            : "Capturar Huella"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-start">
                  <Button
                    type="button"
                    className="bg-[#b92f2d] hover:bg-[#982725] text-white"
                    onClick={handleReconnectReader}
                    disabled={isLoading || isCapturing || isReconnecting}
                  >
                    {isReconnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Reconectando...
                      </>
                    ) : (
                      "Reconectar lector"
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={isLoading}
                >
                  <Link href="/dashboard/students">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Estudiante"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
