import { addMoney, moneyToApi } from './decimal.js';

export interface CashReceiptSourceLine {
  teacherId: string;
  teacherName: string;
  paymentType: string;
  totalAmount: string;
}

export interface ConsolidatedCashReceipt {
  teacherId: string;
  teacherName: string;
  totalAmount: string;
}

export function consolidateCashReceipts(lines: CashReceiptSourceLine[]): ConsolidatedCashReceipt[] {
  const receipts = new Map<string, ConsolidatedCashReceipt>();

  for (const line of lines) {
    if (line.paymentType !== 'E') continue;

    const current = receipts.get(line.teacherId);
    if (current) {
      current.totalAmount = moneyToApi(addMoney(current.totalAmount, line.totalAmount));
      continue;
    }

    receipts.set(line.teacherId, {
      teacherId: line.teacherId,
      teacherName: line.teacherName,
      totalAmount: moneyToApi(line.totalAmount)
    });
  }

  return [...receipts.values()].sort((left, right) => left.teacherName.localeCompare(right.teacherName, 'es'));
}
