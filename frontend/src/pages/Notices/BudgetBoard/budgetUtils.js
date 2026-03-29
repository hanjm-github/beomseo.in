// Budget disclosures follow a fiscal-style cycle that starts in March and
// wraps through the following January/February.
export const BUDGET_MONTHS = ['03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02'];

export function getBudgetCycleYear(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getBudgetMonthValue(date = new Date()) {
  return String(date.getMonth() + 1).padStart(2, '0');
}

export function getCurrentBudgetRouteParams(date = new Date()) {
  return {
    budgetYear: String(getBudgetCycleYear(date)),
    budgetMonth: getBudgetMonthValue(date),
  };
}

export function buildBudgetListPath(budgetYear, budgetMonth) {
  return `/notices/budget/${String(budgetYear)}/${String(budgetMonth).padStart(2, '0')}`;
}

export function normalizeBudgetMonthValue(value) {
  if (value == null || value === '') return null;
  const month = Number.parseInt(String(value), 10);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return String(month).padStart(2, '0');
}

export function isBudgetYearInRange(budgetYear, startYear, endYear) {
  const numericYear = Number.parseInt(String(budgetYear), 10);
  if (!Number.isInteger(numericYear)) return false;
  return numericYear >= Number(startYear) && numericYear <= Number(endYear);
}

export function clampBudgetYear(budgetYear, startYear, endYear) {
  const numericYear = Number.parseInt(String(budgetYear), 10);
  const minimumYear = Number.parseInt(String(startYear), 10);
  const maximumYear = Number.parseInt(String(endYear), 10);
  if (!Number.isInteger(numericYear)) return minimumYear;
  return Math.max(minimumYear, Math.min(maximumYear, numericYear));
}

export function getBudgetCalendarYear(budgetYear, budgetMonth) {
  const numericYear = Number(budgetYear);
  const normalizedMonth = normalizeBudgetMonthValue(budgetMonth);
  if (!normalizedMonth) return numericYear;
  // January/February belong to the next calendar year within the same budget
  // cycle, while March-December stay in the cycle start year.
  return Number(normalizedMonth) >= 3 ? numericYear : numericYear + 1;
}

export function formatBudgetMonthLabel(budgetMonth) {
  const normalizedMonth = normalizeBudgetMonthValue(budgetMonth);
  return normalizedMonth ? `${Number(normalizedMonth)}월` : '';
}

export function formatBudgetPeriodLabel(budgetYear, budgetMonth) {
  const calendarYear = getBudgetCalendarYear(budgetYear, budgetMonth);
  const monthLabel = formatBudgetMonthLabel(budgetMonth);
  return monthLabel ? `${calendarYear}년 ${monthLabel}` : `${calendarYear}년`;
}

export function formatBudgetCycleLabel(budgetYear) {
  const numericYear = Number(budgetYear);
  return `${numericYear}년 3월 - ${numericYear + 1}년 2월`;
}

export function hasExpectedBudgetMonthOrder(monthOrder) {
  return (
    Array.isArray(monthOrder) &&
    monthOrder.length === BUDGET_MONTHS.length &&
    monthOrder.every((month, index) => month === BUDGET_MONTHS[index])
  );
}
