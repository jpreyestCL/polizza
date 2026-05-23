import { isSuperadminUser, requireSession } from "@/server/context";
import { getIndicatorValues } from "@/server/uf";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireSession();
  const [indicators, isSuperadmin] = await Promise.all([
    getIndicatorValues(),
    isSuperadminUser(),
  ]);

  return (
    <div className="flex min-h-svh bg-background">
      <AppSidebar role={ctx.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          userName={ctx.userName}
          email={ctx.email}
          organizationName={ctx.organizationName}
          role={ctx.role}
          ufValue={indicators.uf?.value ?? null}
          usdObsValue={indicators.usdObs?.value ?? null}
          euroValue={indicators.euro?.value ?? null}
          isSuperadmin={isSuperadmin}
        />
        <main className="flex-1 px-5 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
