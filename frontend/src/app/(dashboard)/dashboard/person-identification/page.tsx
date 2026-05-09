"use client";

import { useMemo, useState } from "react";
import { Fingerprint, Loader2, Search, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";

import { useDigitalPersonaFingerprintReader } from "@/lib/biometrics/digitalpersona";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type IdentifyMode = "id" | "fingerprint";

type CourseInfo = {
  id_curso: number;
  nombre_curso: string;
  nivel_curso: string;
  salon: string | null;
  hora_inicio: string;
  hora_fin: string;
  fecha_inicio: string;
  fecha_fin: string;
};

type PersonRecord = {
  role: "ESTUDIANTE" | "PROFESOR";
  tipo_identificacion: string | null;
  numero_identificacion: string;
  nombres: string;
  apellidos: string;
  cursos: CourseInfo[];
};

type PersonLookupPayload = {
  found: boolean;
  numero_identificacion: string;
  records: PersonRecord[];
};

type IdentifyApiResponse = {
  success: boolean;
  mode?: IdentifyMode;
  found: boolean;
  confidence?: number;
  error?: string;
  person?: PersonLookupPayload;
};

type IdentificationResult = {
  source: IdentifyMode;
  found: boolean;
  confidence?: number;
  person: PersonLookupPayload | null;
};

function normalizeId(value: string): string {
  return value.trim().toUpperCase();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatHour(value: string): string {
  if (!value) return "N/A";
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function roleBadgeClass(role: PersonRecord["role"]): string {
  if (role === "PROFESOR") {
    return "bg-emerald-100 text-emerald-800 border-0";
  }

  return "bg-blue-100 text-blue-800 border-0";
}

function isCurrentCourse(course: CourseInfo, now: Date): boolean {
  const start = new Date(`${course.fecha_inicio}T00:00:00`);
  const end = new Date(`${course.fecha_fin}T23:59:59`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return start <= now && now <= end;
}

async function identifyPerson(
  body:
    | { mode: "id"; numeroIdentificacion: string }
    | { mode: "fingerprint"; fingerprintTemplate: string },
): Promise<IdentifyApiResponse> {
  try {
    const response = await fetch("/api/person-identification/identify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = (await response
      .json()
      .catch(() => null)) as IdentifyApiResponse | null;

    if (!response.ok) {
      return {
        success: false,
        found: false,
        error:
          payload?.error ??
          `No fue posible completar la identificacion (HTTP ${response.status})`,
      };
    }

    return (
      payload ?? {
        success: false,
        found: false,
        error: "Respuesta invalida del servidor",
      }
    );
  } catch {
    return {
      success: false,
      found: false,
      error: "No fue posible conectar con el servicio de identificacion",
    };
  }
}

export default function PersonIdentificationPage() {
  const [numeroIdentificacion, setNumeroIdentificacion] = useState("");
  const [isSearchingById, setIsSearchingById] = useState(false);
  const [isSearchingByFingerprint, setIsSearchingByFingerprint] =
    useState(false);
  const [result, setResult] = useState<IdentificationResult | null>(null);

  const {
    ready: readerReady,
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

  const normalizedInputId = useMemo(
    () => normalizeId(numeroIdentificacion),
    [numeroIdentificacion],
  );

  async function handleSearchByIdentification() {
    if (!normalizedInputId) {
      toast.error("Ingrese un numero de identificacion");
      return;
    }

    setIsSearchingById(true);
    const response = await identifyPerson({
      mode: "id",
      numeroIdentificacion: normalizedInputId,
    });
    setIsSearchingById(false);

    if (!response.success) {
      toast.error(response.error ?? "No fue posible identificar a la persona");
      return;
    }

    setResult({
      source: "id",
      found: response.found,
      confidence: response.confidence,
      person: response.person ?? null,
    });

    if (!response.found) {
      toast.info("No se encontro ninguna persona con esa identificacion");
      return;
    }

    toast.success("Persona identificada correctamente");
  }

  async function handleSearchByFingerprint() {
    if (!readerReady) {
      toast.error(
        "El lector no esta listo. Verifique la conexion y el servicio local.",
      );
      return;
    }

    setIsSearchingByFingerprint(true);
    const template = (await capture("attendance"))?.trim() ?? "";

    if (!template) {
      setIsSearchingByFingerprint(false);
      toast.error("No fue posible capturar la huella");
      return;
    }

    const response = await identifyPerson({
      mode: "fingerprint",
      fingerprintTemplate: template,
    });
    setIsSearchingByFingerprint(false);

    if (!response.success) {
      toast.error(response.error ?? "No fue posible validar la huella");
      return;
    }

    setResult({
      source: "fingerprint",
      found: response.found,
      confidence: response.confidence,
      person: response.person ?? null,
    });

    if (!response.found) {
      toast.info("No se encontro coincidencia para la huella capturada");
      return;
    }

    toast.success("Persona identificada por huella correctamente");
  }

  const now = useMemo(() => {
    const current = new Date();
    current.setHours(12, 0, 0, 0);
    return current;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#b92f2d]/10 p-2">
          <UserRoundSearch className="h-5 w-5 text-[#b92f2d]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Identificar Persona
          </h1>
          <p className="text-gray-500 mt-1">
            Identifique estudiantes o profesores por huella o numero de
            identificacion y consulte sus cursos vigentes.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Métodos de Identificación</CardTitle>
          <CardDescription>
            Puede buscar por número de identificación o realizar captura
            biométrica.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-md border p-4 bg-white space-y-3">
            <p className="text-sm font-medium text-gray-800">
              Buscar por número de identificación
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={numeroIdentificacion}
                onChange={(event) =>
                  setNumeroIdentificacion(event.target.value)
                }
                placeholder="Ingrese número de identificación"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearchByIdentification();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleSearchByIdentification}
                disabled={isSearchingById}
                className="bg-[#b92f2d] hover:bg-[#982725] text-white"
              >
                {isSearchingById ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-4 bg-white space-y-3">
            <p className="text-sm font-medium text-gray-800">
              Buscar por huella digital
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
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
              <div className="rounded-md border p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Captura
                </p>
                <p className="text-sm mt-1 text-gray-700">{captureStatus}</p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSearchByFingerprint}
              disabled={isSearchingByFingerprint || isReconnecting}
              className="w-full bg-[#b92f2d] hover:bg-[#982725] text-white"
            >
              {isSearchingByFingerprint ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Capturando y buscando...
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Capturar Huella e Identificar
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleReconnectReader}
              disabled={isSearchingByFingerprint || isReconnecting}
              className="w-full"
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
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado de Identificación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result.found ||
            !result.person ||
            result.person.records.length === 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No se encontró información para la búsqueda realizada.
              </div>
            ) : (
              result.person.records.map((record) => {
                const currentCourses = record.cursos.filter((course) =>
                  isCurrentCourse(course, now),
                );
                const coursesToDisplay =
                  currentCourses.length > 0 ? currentCourses : record.cursos;

                return (
                  <Card key={`${record.role}-${record.numero_identificacion}`}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">
                          {record.nombres} {record.apellidos}
                        </CardTitle>
                        <Badge className={roleBadgeClass(record.role)}>
                          {record.role}
                        </Badge>
                        {record.tipo_identificacion && (
                          <Badge variant="outline">
                            {record.tipo_identificacion}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        Número de identificación: {record.numero_identificacion}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-md border border-[#b92f2d]/20 bg-[#b92f2d]/5 px-3 py-2 text-sm text-[#982725]">
                        {currentCourses.length > 0
                          ? `Cursos vigentes encontrados: ${currentCourses.length}`
                          : record.cursos.length > 0
                            ? "No hay cursos vigentes hoy. Mostrando cursos asociados."
                            : "No tiene cursos asociados actualmente."}
                      </div>

                      {coursesToDisplay.length > 0 && (
                        <div className="rounded-md border bg-white overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50">
                                <TableHead>ID</TableHead>
                                <TableHead>Curso</TableHead>
                                <TableHead>Nivel</TableHead>
                                <TableHead>Salon</TableHead>
                                <TableHead>Horario</TableHead>
                                <TableHead>Vigencia</TableHead>
                                <TableHead>Estado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {coursesToDisplay.map((course) => {
                                const active = isCurrentCourse(course, now);

                                return (
                                  <TableRow
                                    key={`${record.numero_identificacion}-${course.id_curso}`}
                                  >
                                    <TableCell>{course.id_curso}</TableCell>
                                    <TableCell className="whitespace-normal">
                                      {course.nombre_curso}
                                    </TableCell>
                                    <TableCell>{course.nivel_curso}</TableCell>
                                    <TableCell>
                                      {course.salon || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {formatHour(course.hora_inicio)} -{" "}
                                      {formatHour(course.hora_fin)}
                                    </TableCell>
                                    <TableCell>
                                      {formatDate(course.fecha_inicio)} -{" "}
                                      {formatDate(course.fecha_fin)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        className={
                                          active
                                            ? "bg-emerald-100 text-emerald-800 border-0"
                                            : "bg-slate-100 text-slate-700 border-0"
                                        }
                                      >
                                        {active ? "VIGENTE" : "NO VIGENTE"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
