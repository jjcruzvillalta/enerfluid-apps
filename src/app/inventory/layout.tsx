"use client";

import React, { useMemo, useState } from "react";
import { useInventory } from "@/context/InventoryContext";
import { useAuth } from "@/context/AuthContext";
import { BarChart3, Clock, Home, LogOut, Menu, RefreshCw, UploadCloud, Warehouse, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { InventoryProvider } from "@/context/InventoryContext";

const navItems = [
    { href: "/inventory/upload", label: "Carga de archivos", icon: UploadCloud },
    { href: "/inventory/analysis", label: "Analisis", icon: BarChart3 },
    { href: "/inventory/replenishment", label: "Reposicion", icon: Warehouse },
    { href: "/inventory/settings", label: "Configuracion", icon: Settings },
];

const NavButton = ({ href, icon: Icon, children }) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition",
                isActive
                    ? "border-accent/20 bg-accentSoft text-accent shadow-sm"
                    : "border-transparent bg-transparent text-slate-600 hover:bg-accentSoft/60"
            )}
        >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span>{children}</span>
        </Link>
    );
};

function InventorySidebar({ user, onLogout }) {
    return (
        <aside className="hidden lg:flex w-72 flex-col border-r border-line bg-white px-6 py-8 shadow-soft lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">E</div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Enerfluid</p>
                    <p className="text-sm font-semibold text-slate-700">Inventario</p>
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
                        {(user?.displayName || user?.username || "-")[0]?.toUpperCase()}
                    </div>
                    <div className="text-xs overflow-hidden">
                        <p className="font-medium text-slate-700 truncate">{user?.displayName || user?.username}</p>
                        <p className="text-slate-400">Sesion activa</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-2 text-slate-500" onClick={onLogout}>
                    <LogOut className="h-4 w-4" />
                    Cerrar sesion
                </Button>
            </div>
        </aside>
    );
}

export default function InventoryLayout({ children }) {
    return (
        <InventoryProvider>
            <InventoryLayoutContent>{children}</InventoryLayoutContent>
        </InventoryProvider>
    );
}

function InventoryLayoutContent({ children }) {
    const { loading, loadStatus, loadAllFromSupabase, initialized } = useInventory();
    const { user, loading: authLoading, canAccess, logout } = useAuth();
    const router = useRouter();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const userGreeting = useMemo(() => {
        const name = String(user?.displayName || user?.username || "");
        return name || "-";
    }, [user]);

    if (authLoading || !initialized) return <div className="flex h-screen items-center justify-center">Inicializando...</div>;
    if (!user) return <div className="flex h-screen items-center justify-center">Inicia sesion...</div>;
    if (!canAccess("inventory", "standard")) {
        return <div className="flex h-screen items-center justify-center">Sin acceso a Inventario</div>;
    }

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    return (
        <div className="min-h-screen text-ink flex overflow-x-hidden bg-gradient-to-br from-white via-cloud to-mist">
            <InventorySidebar user={user} onLogout={handleLogout} />

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent side="left" className="w-72 px-6 py-8">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">E</div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Enerfluid</p>
                            <p className="text-sm font-semibold text-slate-700">Inventario</p>
                        </div>
                    </div>
                    <div className="mt-10 flex flex-col gap-3">
                        {navItems.map((item) => (
                            <NavButton key={item.href} href={item.href} icon={item.icon}>
                                {item.label}
                            </NavButton>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>

            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
                <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-6 px-4 py-6 md:px-8 lg:px-10">
                    <Card className="glass-panel">
                        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="lg:hidden"
                                    onClick={() => setDrawerOpen(true)}
                                >
                                    <Menu className="h-5 w-5" />
                                </Button>
                                <div>
                                    <p className="text-sm text-slate-500">Hola, {userGreeting}</p>
                                    <h2 className="text-xl font-semibold text-ink">Panel de Analisis de Inventario</h2>
                                </div>
                            </div>
                            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:gap-3">
                                <div
                                    className={cn(
                                        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs whitespace-nowrap",
                                        loading ? "border-accent/30 text-accent" : "border-line text-slate-500"
                                    )}
                                >
                                    {loading ? <Clock className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                    {loading ? "Cargando" : loadStatus}
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    onClick={() => loadAllFromSupabase({ force: true })}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Actualizar
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full text-slate-500 sm:w-auto"
                                    onClick={() => router.push("/")}
                                >
                                    <Home className="mr-2 h-4 w-4" />
                                    Portal
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>

                    {children}
                </div>
            </main>
        </div>
    );
}
