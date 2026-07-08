import ExcelJS from 'exceljs';

export interface XlsxColumn {
  header: string;
  key: string;
  width?: number;
}

export type XlsxRow = Record<string, string | number | boolean | null | undefined | Date>;

export interface XlsxWorksheetOptions {
  sheetName: string;
  columns: XlsxColumn[];
  rows: XlsxRow[];
}

export function xlsxContentType(): string {
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export function xlsxAttachmentHeaders(filename: string): Record<string, string> {
  const safeFilename = filename.replace(/[\r\n"]/g, '');
  return {
    'Content-Type': xlsxContentType(),
    'Content-Disposition': `attachment; filename="${safeFilename}"`
  };
}

export async function buildXlsxBuffer(options: XlsxWorksheetOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nomina Docente';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(options.sheetName);
  worksheet.columns = options.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? Math.max(column.header.length + 2, 14)
  }));
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of options.rows) {
    worksheet.addRow(row);
  }

  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
