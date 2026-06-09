import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { filterActiveOrgs } from "@/types/org";

export function useActiveOrgs() {
  const token = useAppSelector(selectToken);

  const query = useQuery({
    queryKey: ["orgs-header", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const orgs = useMemo(
    () => filterActiveOrgs(query.data?.content ?? []),
    [query.data?.content]
  );

  return {
    orgs,
    isLoading: query.isLoading,
  };
}
