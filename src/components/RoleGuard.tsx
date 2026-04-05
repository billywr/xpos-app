import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectRoles } from "@/store/selectors/authSelectors";

interface RoleGuardProps {
  requiredRole: string;
  redirectTo: string;
  children: React.ReactNode;
}

export function RoleGuard({ requiredRole, redirectTo, children }: RoleGuardProps) {
  const roles = useAppSelector(selectRoles);

  if (!roles.includes(requiredRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
