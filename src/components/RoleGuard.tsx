import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectRoles } from "@/store/selectors/authSelectors";

interface RoleGuardProps {
  requiredRole: string | string[];
  redirectTo: string;
  children: React.ReactNode;
}

export function RoleGuard({ requiredRole, redirectTo, children }: RoleGuardProps) {
  const roles = useAppSelector(selectRoles);
  const allowed = Array.isArray(requiredRole)
    ? requiredRole.some((r) => roles.includes(r))
    : roles.includes(requiredRole);

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
