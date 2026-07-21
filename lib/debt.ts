export type DebtItem = {
  due_date: string | null;
  assignee_email: string;
};

export function computeItemDebt(dueDate: string | null): number {
  if (!dueDate) return 1; // flat weight for undated overdue items
  const daysOverdue = Math.max(0, (Date.now() - new Date(dueDate).getTime()) / 86_400_000);
  // 1 point on day 1, grows slowly, ~4 points by day 14
  return 1 + Math.log2(1 + daysOverdue);
}

export function computeDebtByAssignee(items: DebtItem[]) {
  const byAssignee = new Map<string, number>();
  for (const item of items) {
    const key = item.assignee_email || 'unassigned@example.com';
    const debt = computeItemDebt(item.due_date);
    byAssignee.set(key, (byAssignee.get(key) ?? 0) + debt);
  }
  return byAssignee;
}

export function debtLevel(debt: number): 'low' | 'medium' | 'high' {
  if (debt >= 8) return 'high';
  if (debt >= 3) return 'medium';
  return 'low';
}