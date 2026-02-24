import * as XLSX from "xlsx";

/**
 * Genera y descarga un archivo Excel con una o más hojas.
 * @param sheets Array de { name: nombre de la hoja, rows: array de objetos (claves = columnas) }
 * @param filename Nombre del archivo sin extensión (se añade .xlsx)
 */
export function downloadExcel(
  sheets: Array<{ name: string; rows: Record<string, string | number>[] }>,
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // Excel limita 31 caracteres por hoja
  }
  XLSX.writeFile(wb, `${filename.replace(/\.xlsx$/i, "")}.xlsx`);
}
