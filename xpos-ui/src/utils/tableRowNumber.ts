/** 1-based row number for paginated tables (page 0 → 1…size). */
export function tableRowDisplayNumber(
  page: number,
  pageSize: number,
  indexInPage: number
): number {
  return page * pageSize + indexInPage + 1;
}
