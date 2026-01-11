import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";

export const DataStatus = ({ label, value, muted = false }) => (
    <div className="text-xs text-slate-500">
        <span className={muted ? "text-slate-400" : "text-slate-500"}>{label}</span>
        <strong className="ml-2 text-ink">{value}</strong>
    </div>
);

export const UploadCard = ({
    title,
    fileName,
    dbStatus,
    updatedAt,
    status,
    onSelect,
    onUpload,
    uploading,
}) => (
    <Card className="p-4">
        <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">{title}</h4>
            <FileUp className="h-4 w-4 text-slate-400" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-mist px-3 py-1 text-xs text-slate-600 hover:bg-white">
                <input className="hidden" type="file" accept=".xlsx,.xls" onChange={onSelect} />
                Elegir archivo
            </label>
            <Button size="sm" onClick={onUpload} disabled={uploading}>
                {uploading ? "Subiendo" : "Subir"}
            </Button>
        </div>
        <div className="mt-3 space-y-1">
            <DataStatus label="Archivo:" value={fileName || "Sin archivo seleccionado"} muted={!fileName} />
            <DataStatus label="Supabase:" value={dbStatus || "-"} />
            <DataStatus label="Actualizado:" value={updatedAt || "-"} />
            <DataStatus label="Estado:" value={status || "Sin subir"} />
        </div>
    </Card>
);
