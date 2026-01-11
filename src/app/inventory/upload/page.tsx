"use client";

import { useInventory } from "@/context/InventoryContext";
import { UploadCard } from "@/components/inventory/UploadCard";

export default function UploadPage() {
    const {
        uploadFiles,
        setUploadFiles,
        uploadStatus,
        uploadLoading,
        handleUpload,
        uploadLogs,
        movRows,
        ventasRows,
        itemsRows,
        catalogRows
    } = useInventory();

    const handleFileSelect = (type, e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFiles(prev => ({ ...prev, [type]: file }));
        }
    };

    const dbStatusMap = {
        movements: movRows.length + " filas",
        ventas: ventasRows.length + " filas",
        items: itemsRows.length + " filas",
        catalogo: catalogRows.length + " filas"
    };

    const getUpdatedAt = (type) => {
        if (!uploadLogs) return "-";
        const log = uploadLogs.find(l => l.type === type);
        // Format date
        return log ? new Date(log.uploaded_at).toLocaleString() : "-";
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Carga de Archivos</h1>
                <p className="text-slate-500">Gestiona la actualizacion de datos.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <UploadCard
                    title="Movimientos"
                    fileName={uploadFiles.movimientos?.name}
                    dbStatus={dbStatusMap.movements}
                    updatedAt={getUpdatedAt("movimientos")}
                    status={uploadStatus.movimientos}
                    uploading={uploadLoading.movimientos}
                    onSelect={(e) => handleFileSelect("movimientos", e)}
                    onUpload={() => handleUpload("movimientos")}
                />
                <UploadCard
                    title="Ventas"
                    fileName={uploadFiles.ventas?.name}
                    dbStatus={dbStatusMap.ventas}
                    updatedAt={getUpdatedAt("ventas")}
                    status={uploadStatus.ventas}
                    uploading={uploadLoading.ventas}
                    onSelect={(e) => handleFileSelect("ventas", e)}
                    onUpload={() => handleUpload("ventas")}
                />
                <UploadCard
                    title="Items"
                    fileName={uploadFiles.items?.name}
                    dbStatus={dbStatusMap.items}
                    updatedAt={getUpdatedAt("items")}
                    status={uploadStatus.items}
                    uploading={uploadLoading.items}
                    onSelect={(e) => handleFileSelect("items", e)}
                    onUpload={() => handleUpload("items")}
                />
                <UploadCard
                    title="Catalogo"
                    fileName={uploadFiles.catalogo?.name}
                    dbStatus={dbStatusMap.catalogo}
                    updatedAt={getUpdatedAt("catalogo")}
                    status={uploadStatus.catalogo}
                    uploading={uploadLoading.catalogo}
                    onSelect={(e) => handleFileSelect("catalogo", e)}
                    onUpload={() => handleUpload("catalogo")}
                />
            </div>
        </div>
    );
}
