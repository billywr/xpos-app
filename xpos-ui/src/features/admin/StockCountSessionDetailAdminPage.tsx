import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  fetchAdminStockCountSession,
  addStockCountLine,
  updateStockCountLine,
  deleteStockCountLine,
  closeStockCountSession,
} from "@/api/stockTaking";
import { fetchItems } from "@/api/items";
import { fetchBranches } from "@/api/branches";
import { fetchOrgs } from "@/api/orgs";
import { StockCountSessionDetailPage } from "@/features/stockCount/StockCountSessionDetailPage";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

export function StockCountSessionDetailAdminPage() {
  const token = useAppSelector(selectToken);
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const orgIdFromUrl = searchParams.get("orgId") ?? "";

  const { data: session } = useQuery({
    queryKey: [
      "admin-stock-count-session-detail",
      token,
      sessionId,
      orgIdFromUrl,
    ],
    queryFn: () =>
      sessionId && orgIdFromUrl
        ? fetchAdminStockCountSession(token, orgIdFromUrl, sessionId)
        : Promise.reject(new Error("Missing sessionId or orgId")),
    enabled: Boolean(token && sessionId && orgIdFromUrl),
  });

  const orgId = orgIdFromUrl || (session?.orgId ?? "");

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, orgId],
    queryFn: () => fetchBranches(token, orgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(orgId),
  });

  const org = orgsData?.content?.find((o) => o.id === orgId);
  const branch = branchesData?.content?.find(
    (b) => b.id === session?.branchId
  );

  if (!orgIdFromUrl && sessionId) {
    return (
      <div className="p-6">
        <p className="text-slate-600 dark:text-slate-400">
          Open a session from the Stock Count Sessions list.
        </p>
        <Link
          to="/admin/stock-count-sessions"
          className="mt-2 inline-flex text-primary-600 hover:underline dark:text-primary-400"
        >
          ← Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <StockCountSessionDetailPage
      token={token}
      orgId={orgId}
      branchName={branch?.name}
      orgName={org?.name}
      fetchSession={(sid) =>
        fetchAdminStockCountSession(token, orgId, sid)
      }
      addLine={(sid, body) => addStockCountLine(token, orgId, sid, body)}
      updateLine={(sid, lineId, body) =>
        updateStockCountLine(token, orgId, sid, lineId, body)
      }
      deleteLine={(sid, lineId) =>
        deleteStockCountLine(token, orgId, sid, lineId)
      }
      closeSession={(sid) => closeStockCountSession(token, orgId, sid)}
      fetchItems={fetchItems}
      backHref="/admin/stock-count-sessions"
      queryKey={["admin-stock-count-sessions"]}
    />
  );
}
