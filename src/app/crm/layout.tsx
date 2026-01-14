"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { NotificationsDialog } from "@/components/crm/NotificationsDialog";
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Contact,
  Home,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";

const NavButton = ({ href, icon: Icon, children, className, ...props }) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
        isActive
          ? "border-accent/20 bg-accentSoft text-accent shadow-sm"
          : "border-transparent bg-transparent text-slate-600 hover:bg-accentSoft/60",
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span>{children}</span>
    </Link>
  );
};

const navItems = [
  { href: "/crm/analysis", label: "Analisis", icon: BarChart3 },
  { href: "/crm/clients", label: "Clientes", icon: Users },
  { href: "/crm/contacts", label: "Contactos", icon: Contact },
  { href: "/crm/opportunities", label: "Oportunidades", icon: Briefcase },
  { href: "/crm/activities", label: "Actividades", icon: Activity },
  { href: "/crm/settings", label: "Configuracion", icon: Settings },
];

export default function CrmLayout({ children }) {
  const router = useRouter();
  const { user, loading, canAccess, logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const greeting = useMemo(() => user?.displayName || user?.username || "-", [user]);

  const loadNotifications = async () => {
    const res = await fetch("/api/crm/notifications", { cache: "no-store", credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    const unread = (data?.notifications || []).filter((item: any) => item.is_read === false).length;
    setUnreadCount(unread);
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  useEffect(() => {
    if (!notificationsOpen) {
      loadNotifications();
    }
  }, [notificationsOpen]);

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center">Inicia sesion...</div>;
  if (!canAccess("crm", "standard")) {
    return <div className="flex h-screen items-center justify-center">Sin acceso a CRM</div>;
  }

  return (
    <div className="min-h-screen text-ink flex bg-gradient-to-br from-white via-cloud to-mist">
      <aside className="hidden lg:flex w-72 flex-col border-r border-line bg-white px-6 py-8 shadow-soft lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold">C</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Enerfluid Apps</p>
            <p className="text-sm font-semibold text-slate-700">CRM</p>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3">
          {navItems.map((item) => (
            <NavButton key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </NavButton>
          ))}
        </div>
        <div className="mt-auto border-t pt-6">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs">
              {greeting[0]?.toUpperCase()}
            </div>
            <div className="text-xs overflow-hidden">
              <p className="font-medium text-slate-700 truncate">{greeting}</p>
              <p className="text-slate-400">Sesion activa</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-slate-500"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </Button>
        </div>
      </aside>

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-6 md:px-8 lg:px-10">
          <Card className="glass-panel">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-500">Hola, {greeting}</p>
                <h2 className="text-xl font-semibold text-ink">Enerfluid CRM</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="relative" onClick={() => setNotificationsOpen(true)}>
                  <Bell className="mr-2 h-4 w-4" />
                  Notificaciones
                  {unreadCount > 0 ? (
                    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-2 text-[10px] text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </Button>
                <Button variant="outline" onClick={() => router.push("/")}>
                  <Home className="mr-2 h-4 w-4" />
                  Portal
                </Button>
              </div>
            </CardHeader>
          </Card>
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 shadow-soft lg:hidden">
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <div className="text-sm font-semibold text-slate-700">Enerfluid CRM</div>
            </div>
            <SheetContent side="left" className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
                  C
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Enerfluid Apps
                  </p>
                  <p className="text-sm font-semibold text-slate-700">CRM</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <NavButton href={item.href} icon={item.icon}>
                      {item.label}
                    </NavButton>
                  </SheetClose>
                ))}
              </div>
              <div className="mt-auto border-t pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                    {greeting[0]?.toUpperCase()}
                  </div>
                  <div className="text-xs overflow-hidden">
                    <p className="font-medium text-slate-700 truncate">{greeting}</p>
                    <p className="text-slate-400">Sesion activa</p>
                  </div>
                </div>
                <SheetClose asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-slate-500"
                    onClick={async () => {
                      await logout();
                      router.push("/login");
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesion
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
          {children}
        </div>
      </main>

      <NotificationsDialog
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigate={(entity) => {
          if (!entity) return;
          const routes: Record<string, string> = {
            client: "/crm/clients",
            contact: "/crm/contacts",
            opportunity: "/crm/opportunities",
            activity: "/crm/activities",
          };
          const target = routes[entity.type] || "/crm/analysis";
          setNotificationsOpen(false);
          router.push(target);
        }}
      />
    </div>
  );
}
