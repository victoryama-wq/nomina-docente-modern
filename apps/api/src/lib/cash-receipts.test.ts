import { describe, expect, it } from 'vitest';
import { consolidateCashReceipts } from './cash-receipts.js';

describe('cash receipt consolidation', () => {
  it('creates one receipt per teacher and sums every payroll line total', () => {
    const receipts = consolidateCashReceipts([
      {
        teacherId: 'teacher-shared',
        teacherName: 'Docente Compartido',
        paymentType: 'E',
        totalAmount: '2430.00'
      },
      {
        teacherId: 'teacher-shared',
        teacherName: 'Docente Compartido',
        paymentType: 'E',
        totalAmount: '570.50'
      },
      {
        teacherId: 'teacher-other',
        teacherName: 'Docente Otro',
        paymentType: 'E',
        totalAmount: '1000.00'
      }
    ]);

    expect(receipts).toEqual([
      {
        teacherId: 'teacher-shared',
        teacherName: 'Docente Compartido',
        totalAmount: '3000.50'
      },
      {
        teacherId: 'teacher-other',
        teacherName: 'Docente Otro',
        totalAmount: '1000.00'
      }
    ]);
  });

  it('excludes non-cash lines defensively', () => {
    expect(
      consolidateCashReceipts([
        {
          teacherId: 'teacher-bank',
          teacherName: 'Docente Transferencia',
          paymentType: '1',
          totalAmount: '950.00'
        }
      ])
    ).toEqual([]);
  });
});
