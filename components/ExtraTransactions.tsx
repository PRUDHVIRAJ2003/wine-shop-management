'use client';

import { ExtraTransaction } from '@/types';
import { Button } from './ui/Button';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ExtraTransactionsProps {
  transactions: Omit<ExtraTransaction, 'id' | 'cash_entry_id' | 'created_at'>[];
  onAdd: () => void;
  onDelete: (index: number) => void;
  onUpdate: (index: number, field: string, value: string | number) => void;
  isLocked: boolean;
}

export default function ExtraTransactions({
  transactions,
  onAdd,
  onDelete,
  onUpdate,
  isLocked,
}: ExtraTransactionsProps) {
  const totalIncome = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netTotal = totalIncome - totalExpense;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-[#722F37]">
          💰 Extra Income / Expenses
        </h3>
        <Button
          onClick={onAdd}
          disabled={isLocked}
          variant="secondary"
          size="sm"
        >
          + Add
        </Button>
      </div>
      
      <p className="text-sm text-gray-500 mb-4">
        Additional income or expense transactions for the day
      </p>
      
      {transactions.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No extra transactions added</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#722F37] text-white">
              <tr>
                <th className="px-4 py-2 text-left w-16">S.No</th>
                <th className="px-4 py-2 text-left w-32">Type</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right w-32">Amount (₹)</th>
                <th className="px-4 py-2 text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{index + 1}</td>
                  <td className="px-4 py-2">
                    <select
                      value={transaction.transaction_type}
                      onChange={(e) => onUpdate(index, 'transaction_type', e.target.value)}
                      disabled={isLocked}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#722F37]"
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={transaction.description}
                      onChange={(e) => onUpdate(index, 'description', e.target.value)}
                      placeholder="Enter description..."
                      disabled={isLocked}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#722F37]"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={transaction.amount || ''}
                      onChange={(e) => onUpdate(index, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      disabled={isLocked}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-[#722F37]"
                      step="0.01"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => onDelete(index)}
                      disabled={isLocked}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* Total Income Row */}
              <tr className="bg-green-50 font-bold">
                <td className="px-4 py-3" colSpan={3}>TOTAL INCOME:</td>
                <td className="px-4 py-3 text-right text-green-700">
                  {formatCurrency(totalIncome)}
                </td>
                <td></td>
              </tr>
              
              {/* Total Expenses Row */}
              <tr className="bg-red-50 font-bold">
                <td className="px-4 py-3" colSpan={3}>TOTAL EXPENSES:</td>
                <td className="px-4 py-3 text-right text-red-700">
                  {formatCurrency(totalExpense)}
                </td>
                <td></td>
              </tr>
              
              {/* Net Total Row */}
              <tr className={`font-bold ${netTotal >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <td className="px-4 py-3" colSpan={3}>NET (Income - Expenses):</td>
                <td className={`px-4 py-3 text-right ${netTotal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(netTotal)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
