import { Link } from "react-router-dom";
import { ADMIN_NAV_ITEMS, ADMIN_GROUP_ORDER } from "@/config/adminNavItems";
import { useNavVisibilityContext } from "@/contexts/NavVisibilityContext";
import { isNavItemVisible } from "@/hooks/useAdminNavVisibility";
import { FLOATING_MENU_CARD } from "@/utils/floatingCardClasses";
import { PageHeader } from "@/components/PageHeader";

export function AdminDashboard() {
  const { adminVisibility } = useNavVisibilityContext();

  const grouped = ADMIN_GROUP_ORDER.map((group) => ({
    group,
    items: ADMIN_NAV_ITEMS.filter(
      (n) =>
        n.group === group &&
        n.to !== "/admin" &&
        n.to !== "/admin/settings" &&
        isNavItemVisible(n.to, n.canHide, adminVisibility)
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Setup and configuration."
        fallbackTo="/"
      />
      <div className="space-y-8">
        {grouped.map(({ group, items }) => (
          <section key={group}>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {group}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className={FLOATING_MENU_CARD}>
                    <div className="rounded-lg bg-primary-100/80 p-3 dark:bg-primary-900/30">
                      <Icon className="h-7 w-7 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 dark:text-white">
                        {item.label}
                      </h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
