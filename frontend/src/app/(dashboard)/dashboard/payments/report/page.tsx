"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, Loader2, Wallet, Users } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";

import {
  getPaymentsReport,
  type PaymentReportRow,
  type PaymentReportScope,
} from "@/app/actions/payments";
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

type PeriodPreset = "TODAY" | "LAST_MONTH" | "SPECIFIC_DAY" | "CUSTOM";

type MetricBarData = {
  label: string;
  value: number;
  meta?: string;
};

function toIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayIsoDate(): string {
  return toIsoDateLocal(new Date());
}

function getPreviousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastPreviousMonth = new Date(firstCurrentMonth.getTime() - 86400000);
  const firstPreviousMonth = new Date(
    lastPreviousMonth.getFullYear(),
    lastPreviousMonth.getMonth(),
    1,
  );

  return {
    from: toIsoDateLocal(firstPreviousMonth),
    to: toIsoDateLocal(lastPreviousMonth),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("es-CO", {
    month: "2-digit",
    day: "2-digit",
  });
}

function resolvePeriodRange(
  period: PeriodPreset,
  customFrom: string,
  customTo: string,
  specificDay: string,
): { from: string; to: string } {
  if (period === "TODAY") {
    const today = getTodayIsoDate();
    return { from: today, to: today };
  }

  if (period === "LAST_MONTH") {
    return getPreviousMonthRange();
  }

  if (period === "SPECIFIC_DAY") {
    const selectedDay = specificDay.trim();
    return { from: selectedDay, to: selectedDay };
  }

  return {
    from: customFrom.trim(),
    to: customTo.trim(),
  };
}

function normalizeReportScopeLabel(scope: PaymentReportScope): string {
  switch (scope) {
    case "ASISTENCIA":
      return "Solo pagos desde asistencia";
    case "PROCESADOR":
      return "Solo pagos desde procesador";
    default:
      return "Asistencia y procesador";
  }
}

function normalizeSourceLabel(value: string): string {
  if (value === "asistencia") {
    return "Asistencia";
  }
  if (value === "procesador") {
    return "Procesador";
  }
  return value || "-";
}

function normalizePaymentTypeLabel(value: string): string {
  switch (value) {
    case "clase_presencial":
      return "Clase presencial";
    case "adelanto":
      return "Pago adelantado";
    case "abono_matricula":
      return "Abono matricula";
    case "pago_deuda":
      return "Pago de deuda";
    case "otro":
      return "Otro";
    default:
      return value || "-";
  }
}

function resolveTypeForGrouping(row: PaymentReportRow): string {
  return String(row.tipo_pago_detalle ?? row.tipo_pago ?? "otro").trim();
}

function normalizePaymentMethodLabel(value: string): string {
  switch (value) {
    case "EFECTIVO":
      return "Efectivo";
    case "TRANSFERENCIA":
      return "Transferencia";
    case "NEQUI":
      return "Nequi";
    case "DAVIPLATA":
      return "Daviplata";
    case "OTRO":
      return "Otro";
    default:
      return value || "-";
  }
}

function sanitizeFilePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function MetricBars(props: {
  title: string;
  description: string;
  data: MetricBarData[];
  colorClass: string;
  valueFormatter?: (value: number) => string;
}) {
  const { title, description, data, colorClass, valueFormatter } = props;
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const formatValue = valueFormatter ?? ((value: number) => value.toString());

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No hay datos para mostrar.</p>
        ) : (
          <div className="space-y-3">
            {data.map((item) => {
              const ratio = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              const width = item.value > 0 ? Math.max(3, ratio) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-700">
                      {item.label}
                    </span>
                    <span className="text-gray-600">
                      {formatValue(item.value)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colorClass}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {item.meta && (
                    <p className="text-xs text-gray-500">{item.meta}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PaymentsReportPage() {
  const previousMonthRange = useMemo(() => getPreviousMonthRange(), []);

  const [period, setPeriod] = useState<PeriodPreset>("LAST_MONTH");
  const [scope, setScope] = useState<PaymentReportScope>("AMBOS");
  const [customFrom, setCustomFrom] = useState(previousMonthRange.from);
  const [customTo, setCustomTo] = useState(previousMonthRange.to);
  const [specificDay, setSpecificDay] = useState(getTodayIsoDate());
  const [numeroIdentificacion, setNumeroIdentificacion] = useState("");

  const [rows, setRows] = useState<PaymentReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{
    from: string;
    to: string;
    scope: PaymentReportScope;
    numeroIdentificacion: string;
  } | null>(null);

  const activeRange = useMemo(
    () => resolvePeriodRange(period, customFrom, customTo, specificDay),
    [period, customFrom, customTo, specificDay],
  );

  const rangeError = useMemo(() => {
    if (!activeRange.from || !activeRange.to) {
      return "Debe definir fecha inicial y final";
    }
    if (activeRange.from > activeRange.to) {
      return "La fecha inicial no puede ser mayor que la fecha final";
    }
    return "";
  }, [activeRange]);

  const totals = useMemo(() => {
    const normalizedRows = rows.map((row) => ({
      ...row,
      valor: Number(row.valor ?? 0),
      clases_adelantadas: Number(row.clases_adelantadas ?? 0),
    }));

    const totalRecibido = normalizedRows.reduce(
      (sum, row) => sum + row.valor,
      0,
    );

    const asistenciaTotal = normalizedRows
      .filter((row) => row.origen_pago === "asistencia")
      .reduce((sum, row) => sum + row.valor, 0);

    const procesadorTotal = normalizedRows
      .filter((row) => row.origen_pago === "procesador")
      .reduce((sum, row) => sum + row.valor, 0);

    const deudaTotal = normalizedRows
      .filter((row) => resolveTypeForGrouping(row) === "pago_deuda")
      .reduce((sum, row) => sum + row.valor, 0);

    const adelantoTotal = normalizedRows
      .filter((row) => resolveTypeForGrouping(row) === "adelanto")
      .reduce((sum, row) => sum + row.valor, 0);

    const estudiantesUnicos = new Set(
      normalizedRows.map((row) => row.numero_identificacion),
    ).size;

    return {
      totalRecibido,
      asistenciaTotal,
      procesadorTotal,
      deudaTotal,
      adelantoTotal,
      estudiantesUnicos,
      registros: normalizedRows.length,
    };
  }, [rows]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();

    for (const row of rows) {
      const key = String(row.fecha_pago).slice(0, 10);
      const current = map.get(key) ?? { value: 0, count: 0 };
      current.value += Number(row.valor ?? 0);
      current.count += 1;
      map.set(key, current);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-20)
      .map(([label, value]) => ({
        label: formatShortDate(label),
        value: value.value,
        meta: `${value.count} pago(s)`,
      }));
  }, [rows]);

  const methodSeries = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of rows) {
      const key = String(row.metodo_pago || "OTRO");
      map.set(key, (map.get(key) ?? 0) + Number(row.valor ?? 0));
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label: normalizePaymentMethodLabel(label),
        value,
      }));
  }, [rows]);

  const typeSeries = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of rows) {
      const key = resolveTypeForGrouping(row);
      map.set(key, (map.get(key) ?? 0) + Number(row.valor ?? 0));
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label: normalizePaymentTypeLabel(label),
        value,
      }));
  }, [rows]);

  const courseSeries = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of rows) {
      const key = (row.nombre_curso || "Sin curso").trim() || "Sin curso";
      map.set(key, (map.get(key) ?? 0) + Number(row.valor ?? 0));
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({
        label,
        value,
      }));
  }, [rows]);

  const rowsPreview = useMemo(() => rows.slice(0, 250), [rows]);

  // Desglose por administrador: agrupa los pagos por quien los registró
  // y separa los subtotales por origen (asistencia vs procesador).
  // Reactivo a los filtros porque depende de `rows`.
  const adminBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        total: number;
        asistencia: number;
        procesador: number;
        count: number;
      }
    >();

    for (const row of rows) {
      const key =
        (row.registrado_por_id ?? "").trim() ||
        (row.registrado_por ?? "").trim() ||
        "__sin_admin__";
      const name =
        (row.registrado_por_nombre ?? "").trim() || "Administrador sin resolver";
      const valor = Number(row.valor ?? 0);
      const current =
        map.get(key) ??
        {
          key,
          name,
          total: 0,
          asistencia: 0,
          procesador: 0,
          count: 0,
        };

      current.total += valor;
      current.count += 1;
      if (row.origen_pago === "asistencia") current.asistencia += valor;
      if (row.origen_pago === "procesador") current.procesador += valor;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  async function handleLoadReport() {
    if (rangeError) {
      toast.error(rangeError);
      return;
    }

    setIsLoading(true);
    const result = await getPaymentsReport({
      numeroIdentificacion: numeroIdentificacion.trim() || undefined,
      from: activeRange.from,
      to: activeRange.to,
      scope,
      limit: 5000,
    });
    setIsLoading(false);

    if (!result.success) {
      setRows([]);
      toast.error(result.error ?? "No fue posible cargar el reporte");
      return;
    }

    const data = result.data ?? [];
    setRows(data);
    setLastLoadedAt(new Date().toISOString());
    setAppliedFilters({
      from: activeRange.from,
      to: activeRange.to,
      scope,
      numeroIdentificacion: numeroIdentificacion.trim().toUpperCase(),
    });

    toast.success(`Reporte cargado con ${data.length} registros`);
  }

  async function handleExportExcel() {
    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    setIsExporting(true);

    try {
      const exportFilters = appliedFilters ?? {
        from: activeRange.from,
        to: activeRange.to,
        scope,
        numeroIdentificacion: numeroIdentificacion.trim().toUpperCase(),
      };

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("reporte_pagos");

      worksheet.columns = [
        { header: "Fecha", key: "fecha_pago", width: 22 },
        { header: "Estudiante", key: "estudiante", width: 30 },
        { header: "ID Estudiante", key: "numero_identificacion", width: 20 },
        { header: "Curso", key: "nombre_curso", width: 24 },
        { header: "Origen", key: "origen_pago", width: 18 },
        { header: "Tipo pago", key: "tipo_pago", width: 20 },
        { header: "Metodo", key: "metodo_pago", width: 16 },
        { header: "Valor COP", key: "valor", width: 16 },
        { header: "Clases adelantadas", key: "clases_adelantadas", width: 20 },
        { header: "Registrado por", key: "registrado_por", width: 24 },
        { header: "Notas", key: "notas", width: 32 },
      ];

      for (const row of rows) {
        worksheet.addRow({
          fecha_pago: formatDateTime(row.fecha_pago),
          estudiante: row.estudiante,
          numero_identificacion: row.numero_identificacion,
          nombre_curso: row.nombre_curso || "Sin curso",
          origen_pago: normalizeSourceLabel(row.origen_pago),
          tipo_pago: normalizePaymentTypeLabel(resolveTypeForGrouping(row)),
          metodo_pago: normalizePaymentMethodLabel(row.metodo_pago),
          valor: Number(row.valor ?? 0),
          clases_adelantadas: Number(row.clases_adelantadas ?? 0),
          registrado_por:
            row.registrado_por_nombre || row.registrado_por || "-",
          notas: row.notas || "",
        });
      }

      worksheet.insertRows(1, [
        ["REPORTE DE PAGOS DE ESTUDIANTES"],
        [`Generado: ${formatDateTime(new Date().toISOString())}`],
        [`Periodo: ${exportFilters.from} a ${exportFilters.to}`],
        [
          `Filtro origen: ${normalizeReportScopeLabel(exportFilters.scope)} | Filtro estudiante: ${exportFilters.numeroIdentificacion || "Todos"}`,
        ],
        [
          `Total recibido: ${formatCurrency(totals.totalRecibido)} | Registros: ${totals.registros} | Estudiantes unicos: ${totals.estudiantesUnicos}`,
        ],
        [""],
      ]);

      worksheet.mergeCells(1, 1, 1, worksheet.columns.length);

      const titleRow = worksheet.getRow(1);
      titleRow.height = 28;
      titleRow.getCell(1).font = {
        bold: true,
        size: 14,
        color: { argb: "FF982725" },
      };
      titleRow.getCell(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      const headerRowIndex = 7;
      const headerRow = worksheet.getRow(headerRowIndex);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFB92F2D" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF8F2524" } },
          left: { style: "thin", color: { argb: "FF8F2524" } },
          bottom: { style: "thin", color: { argb: "FF8F2524" } },
          right: { style: "thin", color: { argb: "FF8F2524" } },
        };
      });

      worksheet.getColumn("valor").numFmt = "#,##0";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const safeId = sanitizeFilePart(
        exportFilters.numeroIdentificacion || "todos",
      );
      const fileName = `reporte_pagos_${exportFilters.from}_${exportFilters.to}_${exportFilters.scope.toLowerCase()}_${safeId}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Archivo Excel exportado correctamente");
    } catch {
      toast.error("No fue posible exportar el reporte a Excel");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reporte de Pagos</h1>
        <p className="text-gray-500 mt-1">
          Consulte pagos por periodo y origen, visualice totales y descargue el
          reporte en Excel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros del reporte</CardTitle>
          <CardDescription>
            Puede filtrar por dia actual, mes pasado, dia especifico o rango
            personalizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Periodo</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value as PeriodPreset)
                }
              >
                <option value="TODAY">Dia actual</option>
                <option value="LAST_MONTH">Mes pasado</option>
                <option value="SPECIFIC_DAY">Dia especifico</option>
                <option value="CUSTOM">Rango personalizado</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Origen de pagos</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as PaymentReportScope)
                }
              >
                <option value="AMBOS">Asistencia + Procesador</option>
                <option value="ASISTENCIA">Solo asistencia</option>
                <option value="PROCESADOR">Solo procesador</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                ID estudiante (opcional)
              </label>
              <Input
                placeholder="Ej: 1234567890"
                value={numeroIdentificacion}
                onChange={(event) =>
                  setNumeroIdentificacion(event.target.value)
                }
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleLoadReport}
                disabled={isLoading}
                className="w-full bg-[#b92f2d] hover:bg-[#982725] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Cargar reporte"
                )}
              </Button>
            </div>
          </div>

          {period === "SPECIFIC_DAY" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Dia seleccionado</label>
              <Input
                type="date"
                value={specificDay}
                onChange={(event) => setSpecificDay(event.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha inicial</label>
              <Input
                type="date"
                value={activeRange.from}
                onChange={(event) => setCustomFrom(event.target.value)}
                disabled={period !== "CUSTOM"}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha final</label>
              <Input
                type="date"
                value={activeRange.to}
                onChange={(event) => setCustomTo(event.target.value)}
                disabled={period !== "CUSTOM"}
              />
            </div>
          </div>

          <div className="rounded-md border border-[#b92f2d]/20 bg-[#b92f2d]/5 p-3 text-sm text-[#982725]">
            <p>
              Rango activo: <strong>{activeRange.from}</strong> a{" "}
              <strong>{activeRange.to}</strong>
            </p>
            <p>Origen activo: {normalizeReportScopeLabel(scope)}</p>
            {rangeError && <p className="mt-1 text-red-700">{rangeError}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-700" />
              Total recibido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(totals.totalRecibido)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Pagos deuda</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(totals.deudaTotal)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">
              Pagos adelantados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(totals.adelantoTotal)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">
              Fuente asistencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(totals.asistenciaTotal)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">
              Fuente procesador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(totals.procesadorTotal)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-700" />
              Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-gray-900">
              {totals.estudiantesUnicos}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {totals.registros} movimiento(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MetricBars
          title="Evolucion diaria"
          description="Total recibido por fecha (ultimos 20 dias con movimientos)."
          data={dailySeries}
          colorClass="bg-emerald-600"
          valueFormatter={formatCurrency}
        />

        <MetricBars
          title="Distribucion por metodo"
          description="Comparativo de recaudo por metodo de pago."
          data={methodSeries}
          colorClass="bg-blue-600"
          valueFormatter={formatCurrency}
        />

        <MetricBars
          title="Distribucion por tipo de pago"
          description="Comportamiento de deuda, adelanto y otros tipos."
          data={typeSeries}
          colorClass="bg-[#b92f2d]"
          valueFormatter={formatCurrency}
        />

        <MetricBars
          title="Cursos con mayor recaudo"
          description="Top de cursos por valor total recibido."
          data={courseSeries}
          colorClass="bg-amber-500"
          valueFormatter={formatCurrency}
        />
      </div>

      {adminBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-700" />
              Recaudo por administrador
            </CardTitle>
            <CardDescription>
              Totales y subtotales por origen (Asistencia / Procesador)
              calculados sobre el rango de fechas seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {adminBreakdown.map((entry) => (
                <div
                  key={entry.key}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {entry.name}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formatCurrency(entry.total)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.count} movimiento(s)
                  </p>
                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Asistencia</span>
                      <span className="font-medium">
                        {formatCurrency(entry.asistencia)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Procesador</span>
                      <span className="font-medium">
                        {formatCurrency(entry.procesador)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#b92f2d]" />
                Detalle de pagos ({rows.length})
              </CardTitle>
              <CardDescription>
                Incluye fecha, pagador, metodo, curso, tipo, origen, valor y
                administrador que registró el pago.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || rows.length === 0}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lastLoadedAt && (
            <p className="text-xs text-gray-500">
              Ultima actualizacion: {formatDateTime(lastLoadedAt)}
            </p>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aplique filtros y cargue el reporte para visualizar resultados.
            </p>
          ) : (
            <div className="rounded-md border bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>Metodo</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Registrado por</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsPreview.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDateTime(row.fecha_pago)}</TableCell>
                      <TableCell>
                        <p className="font-medium text-gray-900">
                          {row.estudiante}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          ID: {row.numero_identificacion}
                        </p>
                      </TableCell>
                      <TableCell>
                        {normalizePaymentMethodLabel(row.metodo_pago)}
                      </TableCell>
                      <TableCell>{row.nombre_curso || "Sin curso"}</TableCell>
                      <TableCell>
                        {normalizePaymentTypeLabel(resolveTypeForGrouping(row))}
                      </TableCell>
                      <TableCell>
                        {normalizeSourceLabel(row.origen_pago)}
                      </TableCell>
                      <TableCell>
                        {row.registrado_por_nombre?.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(row.valor ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {rows.length > rowsPreview.length && (
            <p className="text-xs text-amber-700">
              Se muestran los primeros {rowsPreview.length} registros de{" "}
              {rows.length}. El archivo Excel incluye todos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
