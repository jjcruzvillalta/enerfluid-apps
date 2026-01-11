"use client";

import { useInventory } from "@/context/InventoryContext"; // Create this context first
import { BarChart3, Warehouse, LogOut, UploadCloud } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils"; // Make sure to expose utils
import { Button } from "@/components/ui/button";
import { InventoryProvider } from "@/context/InventoryContext";
import { supabase } from "@/lib/supabase/client";

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

function InventorySidebar({ user }) {
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <aside className="hidden lg:flex w-72 flex-col border-r border-line bg-white px-6 py-8 shadow-soft lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
            <div className="flex items-center gap-3">
                {/* Helper to just use the logo */}
                <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">E</div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Enerfluid</p>
                    <p className="text-sm font-semibold text-slate-700">Inventario</p>
                </div>
            </div>
            <div className="mt-10 flex flex-col gap-3">
                <NavButton href="/inventory/upload" icon={UploadCloud}>
                    Carga de archivos
                </NavButton>
                <NavButton href="/inventory/analysis" icon={BarChart3}>
                    Analisis
                </NavButton>
                <NavButton href="/inventory/replenishment" icon={Warehouse}>
                    Reposicion
                </NavButton>
            </div>
            <div className="mt-auto border-t pt-6">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                        {user?.email?.[0]?.toUpperCase()}
                    </div>
                    <div className="text-xs overflow-hidden">
                        <p className="font-medium text-slate-700 truncate">{user?.email}</p>
                        <p className="text-slate-400">Sesion activa</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-2 text-slate-500" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    Cerrar sesion
                </Button>
            </div>
        </aside>
    );
}

// Wrapper to provide context
export default function InventoryLayout({ children }) {
    return (
        <InventoryProvider>
            <InventoryLayoutContent>{children}</InventoryLayoutContent>
        </InventoryProvider>
    );
}

function InventoryLayoutContent({ children }) {
    const { session, loading, initialized } = useInventory();

    if (!initialized) return <div className="flex h-screen items-center justify-center">Inicializando...</div>;
    if (loading && !session) return <div className="flex h-screen items-center justify-center">Cargando datos...</div>;

    return (
        <div className="min-h-screen bg-cloud text-ink flex">
            <InventorySidebar user={session?.user} />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
