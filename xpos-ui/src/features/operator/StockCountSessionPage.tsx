import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
  selectOrgName,
} from "@/store/selectors/orgContextSelectors";
import {
  fetchOperatorStockCountSession,
  addOperatorStockCountLine,
  updateOperatorStockCountLine,
  deleteOperatorStockCountLine,
  closeOperatorStockCountSession,
} from "@/api/stockTaking";
import { fetchItems } from "@/api/items";
import { StockCountSessionDetailPage } from "@/features/stockCount/StockCountSessionDetailPage";

export function StockCountSessionPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId) ?? "";
  const branchId = useAppSelector(selectBranchId) ?? "";
  const branchName = useAppSelector(selectBranchName);
  const orgName = useAppSelector(selectOrgName);

  return (
    <StockCountSessionDetailPage
      token={token}
      orgId={orgId}
      branchName={branchName}
      orgName={orgName}
      fetchSession={(sessionId) =>
        fetchOperatorStockCountSession(token, orgId, branchId, sessionId)
      }
      addLine={(sessionId, body) =>
        addOperatorStockCountLine(token, orgId, branchId, sessionId, body)
      }
      updateLine={(sessionId, lineId, body) =>
        updateOperatorStockCountLine(token, orgId, branchId, sessionId, lineId, body)
      }
      deleteLine={(sessionId, lineId) =>
        deleteOperatorStockCountLine(token, orgId, branchId, sessionId, lineId)
      }
      closeSession={(sessionId) =>
        closeOperatorStockCountSession(token, orgId, branchId, sessionId)
      }
      fetchItems={fetchItems}
      backHref="/operator/stock-count"
      queryKey={["operator-stock-count-sessions"]}
    />
  );
}
