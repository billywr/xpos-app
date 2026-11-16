import { Link } from "react-router-dom";
import { ADMIN_NAV_ITEMS, ADMIN_GROUP_ORDER } from "@/config/adminNavItems";
import { useNavVisibilityContext } from "@/contexts/NavVisibilityContext";
import { isNavItemVisible } from "@/hooks/useAdminNavVisibility";
import { FLOATING_MENU_CARD } from "@/utils/floatingCardClasses";
import { PageHeader } from "@/components/PageHeader";

export function AdminDashboard() {
  const { adminVisibility } = useNavVisibilityContext();

  const groupOrder = new Map(ADMIN_GROUP_ORDER.map((g, i) => [g, i]));
  const visibleItems = ADMIN_NAV_ITEMS.filter(
    (n) =>
      n.to !== "/admin" &&
      n.to !== "/admin/settings" &&
      isNavItemVisible(n.to, n.canHide, adminVisibility)
  ).sort(
    (a, b) =>
      (groupOrder.get(a.group) ?? 99) - (groupOrder.get(b.group) ?? 99)
  );

  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Setup and configuration."
        fallbackTo="/"
      />
      <div className="flex flex-wrap gap-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`${FLOATING_MENU_CARD} w-full sm:w-[240px] md:w-[260px]`}
            >
              <div className="rounded-lg bg-primary-100/80 p-3 dark:bg-primary-900/30">
                <Icon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-800 dark:text-white">
                  {item.label}
                </h3>
                <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {item.group}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
