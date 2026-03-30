"use client";

import { useState } from "react";
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

import { createStudent } from "@/app/actions/students";
import { useDigitalPersonaFingerprintReader } from "@/lib/biometrics/digitalpersona";
import {
  IDENTIFICATION_TYPE_OPTIONS,
  IDENTIFICATION_TYPE_VALUES,
} from "@/lib/identification-types";
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

const studentSchema = z.object({
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
  grado: z
    .string()
    .min(1, "El grado es requerido")
    .refine(
      (val) =>
        Number.isInteger(Number(val)) && Number(val) >= 1 && Number(val) <= 11,
      {
        message: "El grado debe estar entre 1 y 11",
      },
    ),
  telefono: z.string().max(20).optional(),
  direccion: z.string().max(200).optional(),
  barrio: z.string().max(100).optional(),
  nombre_acudiente: z.string().max(200).optional(),
  telefono_acudiente: z.string().max(20).optional(),
  programa: z.string().max(100).optional(),
  fecha_inicio: z.string().optional(),
  fecha_matricula: z.string().optional(),
  valor_matricula: z
    .string()
    .optional()
    .refine((val) => !val || (parseCurrencyToNumber(val) ?? -1) >= 0, {
      message: "El valor de matrícula debe ser mayor o igual a 0",
    }),
  matricula_cancelada: z.boolean().optional(),
  valor_apoyo_semanal: z
    .string()
    .min(1, "El valor de apoyo semanal es requerido")
    .refine((val) => (parseCurrencyToNumber(val) ?? 0) > 0, {
      message: "El valor de apoyo semanal debe ser mayor que 0",
    }),
  huella_indice_derecho: z
    .string()
    .trim()
    .min(1, "Debe capturar la huella indice derecha"),
  huella_indice_izquierdo: z
    .string()
    .trim()
    .min(1, "Debe capturar la huella indice izquierda"),
});

type StudentFormValues = z.input<typeof studentSchema>;

export default function NewStudentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [capturingSide, setCapturingSide] = useState<
    "huella_indice_derecho" | "huella_indice_izquierdo" | null
  >(null);

  const {
    ready: readerReady,
    isCapturing,
    deviceStatus,
    captureStatus,
    lastQuality,
    capture,
  } = useDigitalPersonaFingerprintReader();

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      tipo_identificacion: "CC",
      numero_identificacion: "",
      no_matricula: "",
      nombres: "",
      apellidos: "",
      grado: "",
      telefono: "",
      direccion: "",
      barrio: "",
      nombre_acudiente: "",
      telefono_acudiente: "",
      programa: "",
      fecha_inicio: "",
      fecha_matricula: "",
      valor_matricula: "",
      matricula_cancelada: false,
      valor_apoyo_semanal: "",
      huella_indice_derecho: "",
      huella_indice_izquierdo: "",
    },
  });

  async function onSubmit(values: StudentFormValues) {
    const rightFingerprint = values.huella_indice_derecho?.trim() ?? "";
    const leftFingerprint = values.huella_indice_izquierdo?.trim() ?? "";
    if (!rightFingerprint || !leftFingerprint) {
      toast.error(
        "Debe capturar la huella indice derecha e izquierda antes de guardar",
      );
      return;
    }

    setIsLoading(true);

    const result = await createStudent({
      tipo_identificacion: values.tipo_identificacion,
      numero_identificacion: values.numero_identificacion,
      no_matricula: values.no_matricula || null,
      nombres: values.nombres,
      apellidos: values.apellidos,
      grado: Number(values.grado),
      telefono: values.telefono || null,
      direccion: values.direccion || null,
      barrio: values.barrio || null,
      nombre_acudiente: values.nombre_acudiente || null,
      telefono_acudiente: values.telefono_acudiente || null,
      programa: values.programa || null,
      fecha_inicio: values.fecha_inicio || null,
      fecha_matricula: values.fecha_matricula || null,
      valor_matricula: values.valor_matricula
        ? parseCurrencyToNumber(values.valor_matricula)
        : null,
      matricula_cancelada: values.matricula_cancelada ?? false,
      valor_apoyo_semanal:
        parseCurrencyToNumber(values.valor_apoyo_semanal) ?? 0,
      huella_indice_derecho: rightFingerprint,
      huella_indice_izquierdo: leftFingerprint,
    });

    if (result.success) {
      toast.success("Estudiante creado correctamente");
      router.replace("/dashboard/students");
    } else {
      toast.error(result.error ?? "Error al crear el estudiante");
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

  const rightFingerprintValue = form.watch("huella_indice_derecho");
  const leftFingerprintValue = form.watch("huella_indice_izquierdo");
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
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="grado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado (1-11) *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={11} {...field} />
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
                      <FormLabel>Programa</FormLabel>
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
                      <FormLabel>Teléfono</FormLabel>
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
                      <FormLabel>Dirección</FormLabel>
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
                      <FormLabel>Barrio</FormLabel>
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
                  name="nombre_acudiente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del acudiente</FormLabel>
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
                      <FormLabel>Teléfono del acudiente</FormLabel>
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
                  name="fecha_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de inicio</FormLabel>
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
                      <FormLabel>Fecha de matrícula</FormLabel>
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
                      <FormLabel>Valor matrícula</FormLabel>
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
                  name="matricula_cancelada"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matrícula cancelada</FormLabel>
                      <FormControl>
                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(event) =>
                              field.onChange(event.target.checked)
                            }
                          />
                          Marcar si ya pagó matrícula
                        </label>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Captura de huellas
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Captura en vivo con DigitalPersona U.are.U 4500 en formato
                    PNG base64 para procesamiento en backend.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  <div className="rounded-md border p-3 bg-white">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      Estado de captura
                    </p>
                    <p className="text-sm mt-1 text-gray-700">
                      {captureStatus}
                    </p>
                  </div>
                  <div className="rounded-md border p-3 bg-white">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      Calidad
                    </p>
                    <p className="text-sm mt-1 text-gray-700">
                      {typeof lastQuality === "number" ? lastQuality : "N/A"}
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
                <Button
                  type="submit"
                  disabled={isLoading || !hasBothFingerprints}
                >
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
