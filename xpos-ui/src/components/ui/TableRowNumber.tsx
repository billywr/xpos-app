import { tableRowNoCell, tableRowNoHead } from "@/components/ui/styles";
import { tableRowDisplayNumber } from "@/utils/tableRowNumber";

export interface TableRowNumberHeadProps {
  className?: string;
}

export function TableRowNumberHead({
  className = tableRowNoHead,
}: TableRowNumberHeadProps) {
  return (
    <th scope="col" className={className}>
      No.
    </th>
  );
}

export interface TableRowNumberCellProps {
  page: number;
  pageSize: number;
  indexInPage: number;
  className?: string;
}

export function TableRowNumberCell({
  page,
  pageSize,
  indexInPage,
  className = tableRowNoCell,
}: TableRowNumberCellProps) {
  return (
    <td className={className}>{tableRowDisplayNumber(page, pageSize, indexInPage)}</td>
  );
}
