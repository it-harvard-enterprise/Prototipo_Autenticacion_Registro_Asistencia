"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

import {
  getPaymentsReport,
  getStudentPaymentStatus,
  processStudentPayment,
  type PaymentMethod,
  type PaymentMode,
  type PaymentReportRow,
} from "@/app/actions/payments";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/student-options";
import { Student } from "@/lib/types";
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

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function resolvePaymentStatusLabel(student: Student): string {
  const estado = String(student.estado_pago ?? "AL_DIA").toUpperCase();
  const deuda = Number(student.deuda_actual ?? 0);
  const clasesAdelantadas = Number(student.clases_adelantadas ?? 0);

  if (estado === "DEBE" || deuda > 0) {
    return `Debe - ${formatCurrency(deuda)}`;
  }

  if (estado === "ADELANTADO" || clasesAdelantadas > 0) {
    return `Adelantado (${clasesAdelantadas} clases)`;
  }

  return "Al día";
}

function resolvePaymentModeLabel(mode: PaymentMode): string {
  if (mode === "DEUDA_TOTAL") return "Pago de deuda total";
  if (mode === "DEUDA_PARCIAL") return "Pago de deuda parcial";
  return "Pago adelantado";
}

function resolvePaymentMethodLabel(method: PaymentMethod): string {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ??
    method
  );
}

async function generatePaymentConfirmationPdf(params: {
  student: Student;
  payment: Record<string, unknown> | undefined;
  modalidad: PaymentMode;
  metodoPago: PaymentMethod;
  clases: number;
  valor: number;
  notas: string;
}) {
  const { student, payment, modalidad, metodoPago, clases, valor, notas } =
    params;

  const paymentId = toStringOrNull(payment?.id) ?? "N/A";
  const paymentDateRaw =
    toStringOrNull(payment?.fecha_pago) ?? new Date().toISOString();
  const paymentDateLabel = new Date(paymentDateRaw).toLocaleString("es-CO");
  const paymentMethod =
    toStringOrNull(payment?.metodo_pago) ??
    resolvePaymentMethodLabel(metodoPago);
  const paymentType =
    toStringOrNull(payment?.tipo_pago) ?? resolvePaymentModeLabel(modalidad);
  const paymentValue = toNumber(payment?.valor) ?? valor;
  const paymentNotes = (toStringOrNull(payment?.notas) ?? notas) || "N/A";
  const registradoPorNombre =
    toStringOrNull(payment?.registrado_por_nombre) ?? "N/A";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const horizontalPadding = 16;
  const headerHeight = 28;
  const headerRed = { r: 61, g: 16, b: 15 };
  const headerRedDark = { r: 185, g: 28, b: 28 };
  let y = 20;

  const logoDataUrl = await fetch("/logos/LogoCircular_HE.PNG")
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("No se pudo cargar el logo"));
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => null);

  doc.setFillColor(headerRed.r, headerRed.g, headerRed.b);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setDrawColor(headerRedDark.r, headerRedDark.g, headerRedDark.b);
  doc.line(0, headerHeight, pageWidth, headerHeight);

  if (logoDataUrl) {
    doc.addImage(
      logoDataUrl,
      "PNG",
      pageWidth - horizontalPadding - 18,
      6,
      18,
      18,
    );
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Confirmación de Pago", horizontalPadding, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Harvard Enterprise", horizontalPadding, 19);

  y = 38;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${student.nombres} ${student.apellidos}`, horizontalPadding, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Identificación: ${student.numero_identificacion}`,
    horizontalPadding,
    y,
  );

  y += 7;
  doc.text(
    `Fecha de emisión: ${new Date().toLocaleString("es-CO")}`,
    horizontalPadding,
    y,
  );

  y += 8;
  doc.setDrawColor(229, 231, 235);
  doc.line(horizontalPadding, y, pageWidth - horizontalPadding, y);
  y += 8;

  const rows: Array<[string, string]> = [
    ["ID de pago", paymentId],
    ["Fecha de pago", paymentDateLabel],
    ["Modalidad", resolvePaymentModeLabel(modalidad)],
    ["Tipo de pago", paymentType],
    ["Método de pago", paymentMethod],
    ["Clases registradas", String(clases)],
    ["Valor pagado", formatCurrency(paymentValue)],
    ["Registrado por", registradoPorNombre],
    ["Grado", student.grado ?? "N/A"],
    ["No. matrícula", student.no_matricula ?? "N/A"],
    ["Notas", paymentNotes],
  ];

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(`${label}:`, horizontalPadding, y);
    y += 4.5;

    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(
      value && value.trim() !== "" ? value : "N/A",
      pageWidth - horizontalPadding * 2,
    );
    doc.text(lines, horizontalPadding, y);
    y += lines.length * 4.5 + 3;
  });

  const safeDate = paymentDateRaw.slice(0, 10).replaceAll("-", "");
  doc.save(
    `confirmacion-pago-${student.numero_identificacion}-${safeDate}.pdf`,
  );
}

function inferPaymentModeFromType(tipoPago: string): PaymentMode {
  const normalized = tipoPago.trim().toLowerCase();
  if (normalized === "adelanto") {
    return "ADELANTO";
  }
  return "DEUDA_PARCIAL";
}

export default function ProcessPaymentPage() {
  const [numeroIdentificacion, setNumeroIdentificacion] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<PaymentReportRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshingReport, setIsRefreshingReport] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [modalidad, setModalidad] = useState<PaymentMode>("DEUDA_TOTAL");
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>("EFECTIVO");
  const [clasesInput, setClasesInput] = useState(1);
  const [notas, setNotas] = useState("");

  const clasesAdeudadas = Number(student?.clases_adeudadas ?? 0);
  const clasesAdelantadas = Number(student?.clases_adelantadas ?? 0);
  const valorApoyoSemanal = Number(student?.valor_apoyo_semanal ?? 0);

  const clasesCalculadas = useMemo(() => {
    if (modalidad === "DEUDA_TOTAL") {
      return clasesAdeudadas;
    }
    return Math.max(0, Math.trunc(clasesInput));
  }, [modalidad, clasesAdeudadas, clasesInput]);

  const valorCalculado = useMemo(() => {
    if (!Number.isFinite(valorApoyoSemanal) || valorApoyoSemanal <= 0) {
      return 0;
    }
    return clasesCalculadas * valorApoyoSemanal;
  }, [clasesCalculadas, valorApoyoSemanal]);

  const canSubmitPayment =
    !!student &&
    valorCalculado > 0 &&
    clasesCalculadas > 0 &&
    (modalidad !== "DEUDA_PARCIAL" || clasesCalculadas <= clasesAdeudadas);

  async function refreshReport(targetId: string) {
    setIsRefreshingReport(true);
    const reportResult = await getPaymentsReport({
      numeroIdentificacion: targetId,
      limit: 20,
    });
    setIsRefreshingReport(false);

    if (!reportResult.success) {
      toast.error(reportResult.error ?? "No fue posible cargar el reporte");
      return;
    }

    setPayments(reportResult.data ?? []);
  }

  async function handleSearchStudent() {
    const normalized = numeroIdentificacion.trim().toUpperCase();
    if (!normalized) {
      toast.error("Ingrese un número de identificación válido");
      return;
    }

    setIsSearching(true);
    const result = await getStudentPaymentStatus(normalized);
    setIsSearching(false);

    if (!result.success || !result.data?.student) {
      setStudent(null);
      setPayments([]);
      toast.error(result.error ?? "No se encontró el estudiante");
      return;
    }

    setStudent(result.data.student);
    setPayments(result.data.recent_payments ?? []);
    setModalidad("DEUDA_TOTAL");
    setClasesInput(1);
    setNotas("");

    if (!result.data.recent_payments) {
      await refreshReport(normalized);
    }

    toast.success("Estado de pagos cargado correctamente");
  }

  async function handleProcessPayment() {
    if (!student) {
      toast.error("Primero debe buscar un estudiante");
      return;
    }

    if (modalidad === "DEUDA_TOTAL" && clasesAdeudadas <= 0) {
      toast.error("El estudiante no tiene clases adeudadas para pagar");
      return;
    }

    if (modalidad === "DEUDA_PARCIAL" && clasesCalculadas > clasesAdeudadas) {
      toast.error("No puede pagar más clases de las adeudadas");
      return;
    }

    if (clasesCalculadas <= 0 || valorCalculado <= 0) {
      toast.error("La cantidad de clases a pagar debe ser mayor que 0");
      return;
    }

    const submittedModalidad = modalidad;
    const submittedMetodoPago = metodoPago;
    const submittedClases = clasesCalculadas;
    const submittedValor = valorCalculado;
    const submittedNotas = notas.trim();

    setIsProcessing(true);
    const result = await processStudentPayment({
      numeroIdentificacion: student.numero_identificacion,
      modalidad: submittedModalidad,
      metodoPago: submittedMetodoPago,
      clases: submittedClases,
      notas,
    });
    setIsProcessing(false);

    if (!result.success || !result.data?.student) {
      toast.error(result.error ?? "No fue posible registrar el pago");
      return;
    }

    setStudent(result.data.student);
    setNotas("");
    setClasesInput(1);
    await refreshReport(result.data.student.numero_identificacion);

    try {
      await generatePaymentConfirmationPdf({
        student: result.data.student,
        payment: result.data.payment,
        modalidad: submittedModalidad,
        metodoPago: submittedMetodoPago,
        clases: submittedClases,
        valor: submittedValor,
        notas: submittedNotas,
      });
    } catch {
      toast.warning("Pago registrado, pero no fue posible generar el PDF");
    }

    toast.success("Pago registrado correctamente");
  }

  async function handleGeneratePaymentPdfFromReport(payment: PaymentReportRow) {
    if (!student) {
      toast.error("Primero debe buscar un estudiante");
      return;
    }

    const fallbackMode = inferPaymentModeFromType(payment.tipo_pago ?? "");
    const fallbackMethod =
      (payment.metodo_pago as PaymentMethod | undefined) ?? "OTRO";

    try {
      await generatePaymentConfirmationPdf({
        student,
        payment: payment as unknown as Record<string, unknown>,
        modalidad: fallbackMode,
        metodoPago: fallbackMethod,
        clases:
          payment.tipo_pago === "adelanto"
            ? Math.max(0, Number(payment.clases_adelantadas ?? 0))
            : Math.max(
                1,
                Math.round(
                  Number(payment.valor ?? 0) /
                    Math.max(1, Number(student.valor_apoyo_semanal ?? 0)),
                ),
              ),
        valor: Number(payment.valor ?? 0),
        notas: payment.notas ?? "",
      });
    } catch {
      toast.error("No fue posible generar el PDF de ese pago");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Procesar pago</h1>
        <p className="text-gray-500 mt-1">
          Busque un estudiante por identificación y registre pago de deuda
          total, pago parcial o clases adelantadas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buscar estudiante</CardTitle>
          <CardDescription>
            Ingrese el número de identificación para cargar estado y valor de
            apoyo semanal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:max-w-sm">
            <label className="text-sm font-medium text-gray-700">
              Número de identificación
            </label>
            <Input
              value={numeroIdentificacion}
              onChange={(event) => setNumeroIdentificacion(event.target.value)}
              placeholder="Ej: 1234567890"
            />
          </div>
          <Button onClick={handleSearchStudent} disabled={isSearching}>
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Consultando...
              </>
            ) : (
              "Buscar"
            )}
          </Button>
        </CardContent>
      </Card>

      {student && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estado actual</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Estudiante
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {student.nombres} {student.apellidos}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Identificación
                </p>
                <p className="text-sm font-mono text-gray-900">
                  {student.numero_identificacion}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Estado de pagos
                </p>
                <p
                  className={`text-sm font-semibold ${
                    clasesAdeudadas > 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {resolvePaymentStatusLabel(student)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Clases adeudadas
                </p>
                <p className="text-sm text-gray-900">{clasesAdeudadas}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Clases adelantadas
                </p>
                <p className="text-sm text-gray-900">{clasesAdelantadas}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Valor apoyo semanal
                </p>
                <p className="text-sm text-gray-900">
                  {formatCurrency(valorApoyoSemanal)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registrar pago</CardTitle>
              <CardDescription>
                Seleccione la modalidad y confirme el valor calculado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Modalidad
                  </label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={modalidad}
                    onChange={(event) => {
                      setModalidad(event.target.value as PaymentMode);
                      setClasesInput(1);
                    }}
                  >
                    <option value="DEUDA_TOTAL">Pagar deuda completa</option>
                    <option value="DEUDA_PARCIAL">
                      Pagar clases adeudadas
                    </option>
                    <option value="ADELANTO">Pagar clases adelantadas</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Método de pago
                  </label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={metodoPago}
                    onChange={(event) =>
                      setMetodoPago(event.target.value as PaymentMethod)
                    }
                  >
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Clases a pagar
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={
                      modalidad === "DEUDA_TOTAL"
                        ? clasesAdeudadas
                        : clasesInput
                    }
                    onChange={(event) =>
                      setClasesInput(Number(event.target.value || 0))
                    }
                    disabled={modalidad === "DEUDA_TOTAL"}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Notas (opcional)
                </label>
                <Input
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  placeholder="Ej: Pago en caja sede principal"
                />
              </div>

              <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">
                  Clases seleccionadas: <strong>{clasesCalculadas}</strong>
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Valor a registrar:{" "}
                  <strong>{formatCurrency(valorCalculado)}</strong>
                </p>
                {modalidad === "DEUDA_PARCIAL" &&
                  clasesCalculadas > clasesAdeudadas && (
                    <p className="mt-2 text-sm text-red-600">
                      No puede pagar más clases de las que el estudiante adeuda.
                    </p>
                  )}
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-[#b92f2d] hover:bg-[#982725] text-white"
                  onClick={handleProcessPayment}
                  disabled={!canSubmitPayment || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando pago...
                    </>
                  ) : (
                    "Registrar pago"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Reporte reciente de pagos
              </CardTitle>
              <CardDescription>
                Últimos movimientos registrados para este estudiante.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isRefreshingReport && (
                <div className="mb-3 flex items-center text-sm text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando reporte...
                </div>
              )}

              {payments.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay pagos registrados para este estudiante.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">
                          Clases adelantadas
                        </TableHead>
                        <TableHead>Registrado por</TableHead>
                        <TableHead>Notas</TableHead>
                        <TableHead className="text-right">
                          Comprobante
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {new Date(payment.fecha_pago).toLocaleString(
                              "es-CO",
                            )}
                          </TableCell>
                          <TableCell>{payment.tipo_pago}</TableCell>
                          <TableCell>{payment.metodo_pago}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(payment.valor ?? 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.clases_adelantadas ?? 0}
                          </TableCell>
                          <TableCell>
                            {payment.registrado_por_nombre?.trim() || "—"}
                          </TableCell>
                          <TableCell>{payment.notas ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void handleGeneratePaymentPdfFromReport(payment)
                              }
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Generar Comprobante de Pago
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
