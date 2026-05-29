import ExcelJS from "exceljs";

import { type AttendanceExportRow } from "@/app/actions/attendance";

function toLocalDate(dateIso: string) {
  return new Date(dateIso).toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toExcelIdentificationValue(value: string): string | number {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed) && trimmed.length <= 15) {
    return Number(trimmed);
  }

  return trimmed;
}

function toDisplayLabel(value: string | null): string {
  if (value === null) return "NULL";
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sanitizeCourseName(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40) || "curso"
  );
}

export async function exportAttendanceRowsToExcel(params: {
  rows: AttendanceExportRow[];
  selectedDate: string;
  selectedCourseName: string;
}): Promise<void> {
  const safeCourseName = sanitizeCourseName(params.selectedCourseName);
  const fileBaseName = `asistencia_${safeCourseName}_${params.selectedDate}`;
  const fileName = `${fileBaseName}.xlsx`;
  const worksheetName = fileBaseName.slice(0, 31) || "asistencia";

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);

  worksheet.columns = [
    { header: "ID Registro", key: "id", width: 12 },
    { header: "ID Curso", key: "id_curso", width: 12 },
    { header: "Curso", key: "nombre_curso", width: 26 },
    {
      header: "Tipo de Identificación",
      key: "tipo_identificacion",
      width: 22,
    },
    {
      header: "Número de Identificación",
      key: "numero_identificacion",
      width: 24,
    },
    { header: "Nombres", key: "nombres", width: 20 },
    { header: "Apellidos", key: "apellidos", width: 20 },
    { header: "Fecha", key: "fecha", width: 22 },
    { header: "Asistió", key: "asistio", width: 12 },
    { header: "Saldo", key: "saldo", width: 14 },
    { header: "Método de Pago", key: "metodo_pago", width: 18 },
  ];

  for (const row of params.rows) {
    worksheet.addRow({
      id: row.id,
      id_curso: row.id_curso,
      nombre_curso: row.nombre_curso,
      tipo_identificacion: row.tipo_identificacion ?? "NULL",
      numero_identificacion: toExcelIdentificationValue(
        row.numero_identificacion,
      ),
      nombres: row.nombres,
      apellidos: row.apellidos,
      fecha: toLocalDate(row.fecha),
      asistio: row.asistio ? "Sí" : "No",
      saldo: toDisplayLabel(row.saldo),
      metodo_pago: toDisplayLabel(row.metodo_pago),
    });
  }

  worksheet.insertRow(1, [fileBaseName]);
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

  const headerRow = worksheet.getRow(2);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
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

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
