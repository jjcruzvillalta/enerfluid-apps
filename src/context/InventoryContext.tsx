"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import {
    buildCatalogIndex,
    buildItemsIndex,
    parseMovements,
    parseVentas,
    readSheetRows,
    loadFromFile,
    buildUploadRows
} from "@/lib/data";
import { hasNewerLogs, readCachePayload, writeCachePayload } from "@/lib/cache";

const InventoryContext = createContext(null);

export const SUPABASE_TABLES = {
    movements: "movimientos",
    ventas: "ventas",
    items: "listado_items",
    catalogo: "catalogo_items",
};

export function InventoryProvider({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadStatus, setLoadStatus] = useState("Sin cargar");
    const loadInProgressRef = useRef(false);

    const [uploadLogs, setUploadLogs] = useState([]);
    const [movRows, setMovRows] = useState([]);
    const [ventasRows, setVentasRows] = useState([]);
    const [itemsRows, setItemsRows] = useState([]);
    const [catalogRows, setCatalogRows] = useState([]);
    const [movements, setMovements] = useState([]);
    const [ventas, setVentas] = useState([]);
    const [itemsIndex, setItemsIndex] = useState(null);
    const [catalogIndex, setCatalogIndex] = useState(null);

    const [selection, setSelection] = useState(new Set());
    const [itemFilter, setItemFilter] = useState("");

    const [uploadFiles, setUploadFiles] = useState({
        movimientos: null,
        ventas: null,
        items: null,
        catalogo: null,
    });
    const [uploadStatus, setUploadStatus] = useState({
        movimientos: "Sin subir",
        ventas: "Sin subir",
        items: "Sin subir",
        catalogo: "Sin subir",
    });
    const [uploadLoading, setUploadLoading] = useState({
        movimientos: false,
        ventas: false,
        items: false,
        catalogo: false,
    });
    const [initialized, setInitialized] = useState(false);

    const fetchAllRows = useCallback(async (table) => {
        const pageSize = 1000;
        let from = 0;
        let allRows = [];
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
            if (error) throw error;
            allRows = allRows.concat(data || []);
            if (!data || data.length < pageSize) {
                hasMore = false;
            } else {
                from += pageSize;
            }
        }
        return allRows;
    }, []);

    const applyData = useCallback((payload) => {
        const nextMovRows = payload?.movRows || [];
        const nextVentasRows = payload?.ventasRows || [];
        const nextItemsRows = payload?.itemsRows || [];
        const nextCatalogRows = payload?.catalogRows || [];
        const nextUploadLogs = payload?.uploadLogs || [];

        setMovRows(nextMovRows);
        setVentasRows(nextVentasRows);
        setItemsRows(nextItemsRows);
        setCatalogRows(nextCatalogRows);
        setUploadLogs(nextUploadLogs);

        const parsedMovements = parseMovements(nextMovRows);
        const parsedVentas = parseVentas(nextVentasRows);
        setMovements(parsedMovements);
        setVentas(parsedVentas);

        const catalogIdx = buildCatalogIndex(nextCatalogRows);
        setCatalogIndex(catalogIdx);
        const itemsIdx = buildItemsIndex(nextItemsRows, catalogIdx);
        setItemsIndex(itemsIdx);

        setSelection((prev) => {
            if (!itemsIdx?.items?.length) return new Set();
            if (!prev || !prev.size) return new Set(itemsIdx.items.map((item) => item.code));
            return new Set(itemsIdx.items.map((item) => item.code));
        });

        setLoadStatus("Conectado");
    }, []);

    const loadAllFromSupabase = useCallback(async ({ force = false } = {}) => {
        if (loadInProgressRef.current) return;
        loadInProgressRef.current = true;
        try {
            setLoading(true);
            setLoadStatus("Cargando...");
            let cachedPayload = null;
            if (!force) {
                cachedPayload = await readCachePayload();
                if (cachedPayload) applyData(cachedPayload);
            }

            const { data: logsData, error: logsError } = await supabase
                .from("upload_logs")
                .select("*")
                .order("uploaded_at", { ascending: false })
                .limit(1000);

            if (logsError && logsError.code !== "42P01") throw logsError;
            const logs = logsData || [];
            setUploadLogs(logs);

            // Check if reload needed
            const shouldReload = force || !cachedPayload || hasNewerLogs(cachedPayload?.uploadLogs, logs);
            if (!shouldReload) {
                setLoading(false);
                setLoadStatus("Conectado");
                return;
            }

            const [nextMovRows, nextVentasRows, nextItemsRows, nextCatalogRows] = await Promise.all([
                fetchAllRows(SUPABASE_TABLES.movements),
                fetchAllRows(SUPABASE_TABLES.ventas),
                fetchAllRows(SUPABASE_TABLES.items),
                fetchAllRows(SUPABASE_TABLES.catalogo),
            ]);

            const payload = {
                movRows: nextMovRows,
                ventasRows: nextVentasRows,
                itemsRows: nextItemsRows,
                catalogRows: nextCatalogRows,
                uploadLogs: logs,
            };
            applyData(payload);
            await writeCachePayload(payload);
            setLoading(false);
            setLoadStatus("Conectado");

        } catch (error) {
            console.error(error);
            setLoadStatus("Error al cargar");
        } finally {
            setLoading(false);
            loadInProgressRef.current = false;
        }
    }, [applyData, fetchAllRows]);

    const handleUpload = useCallback(
        async (type) => {
            if (!session) {
                setUploadStatus((prev) => ({ ...prev, [type]: "Inicia sesion" }));
                return;
            }
            const file = uploadFiles[type];
            if (!file) {
                setUploadStatus((prev) => ({ ...prev, [type]: "Selecciona un archivo" }));
                return;
            }
            const confirmReplace = window.confirm(
                "Esta carga reemplazara completamente la tabla en Supabase. Deseas continuar?"
            );
            if (!confirmReplace) {
                setUploadStatus((prev) => ({ ...prev, [type]: "Cancelado" }));
                return;
            }
            setUploadLoading((prev) => ({ ...prev, [type]: true }));
            setUploadStatus((prev) => ({ ...prev, [type]: "Leyendo archivo..." }));

            try {
                const workbook = await loadFromFile(file);
                const rawRows = readSheetRows(workbook);
                const payloadRows = buildUploadRows(type, rawRows);
                if (!payloadRows.length) {
                    setUploadStatus((prev) => ({ ...prev, [type]: "Sin datos para subir" }));
                    setUploadLoading((prev) => ({ ...prev, [type]: false }));
                    return;
                }

                const { data: sessionData } = await supabase.auth.getSession();
                const accessToken = sessionData?.session?.access_token;
                if (!accessToken) {
                    setUploadStatus((prev) => ({ ...prev, [type]: "Sesion expirada" }));
                    setUploadLoading((prev) => ({ ...prev, [type]: false }));
                    return;
                }

                const SUPABASE_UPLOAD_FUNCTION = "upload-excel";
                const chunkSize = 500;
                const totalBatches = Math.ceil(payloadRows.length / chunkSize);

                for (let i = 0; i < payloadRows.length; i += chunkSize) {
                    const batchIndex = Math.floor(i / chunkSize) + 1;
                    setUploadStatus((prev) => ({ ...prev, [type]: `Subiendo ${batchIndex}/${totalBatches}...` }));
                    const batch = payloadRows.slice(i, i + chunkSize);

                    const { error } = await supabase.functions.invoke(SUPABASE_UPLOAD_FUNCTION, {
                        body: {
                            type,
                            rows: batch,
                            replace: i === 0,
                            fileName: file?.name || "",
                        },
                    });

                    if (error) {
                        console.error(error);
                        setUploadStatus((prev) => ({ ...prev, [type]: "Error al subir" }));
                        setUploadLoading((prev) => ({ ...prev, [type]: false }));
                        return;
                    }
                    if (batchIndex === totalBatches) {
                        setUploadStatus((prev) => ({ ...prev, [type]: `Cargado` }));
                    }
                }
                setUploadLoading((prev) => ({ ...prev, [type]: false }));
                await loadAllFromSupabase({ force: true });
            } catch (error) {
                console.error(error);
                setUploadStatus((prev) => ({ ...prev, [type]: "Error al leer" }));
                setUploadLoading((prev) => ({ ...prev, [type]: false }));
            }
        },
        [session, uploadFiles, loadAllFromSupabase]
    );

    useEffect(() => {
        let mounted = true;

        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (mounted) {
                    setSession(session);
                    // Critical: Allow UI to render immediately
                    setInitialized(true);
                    if (session?.user) {
                        // Load data in background
                        loadAllFromSupabase();
                    }
                }
            } catch (e) {
                console.error("Session check failed", e);
                if (mounted) setInitialized(true);
            }
        };

        initSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setSession(session);
                // Ensure initialized is true on auth change too
                setInitialized(true);
                if (session?.user) loadAllFromSupabase();
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [loadAllFromSupabase]);

    const value = {
        session,
        loading,
        loadStatus,
        uploadFiles,
        setUploadFiles,
        uploadStatus,
        setUploadStatus,
        uploadLoading,
        setUploadLoading,
        movements,
        ventas,
        itemsIndex,
        catalogIndex,
        selection,
        setSelection,
        itemFilter,
        setItemFilter,
        loadAllFromSupabase,
        uploadLogs,
        handleUpload,
        movRows,
        ventasRows,
        itemsRows,
        catalogRows,
        initialized
    };

    return (
        <InventoryContext.Provider value={value}>
            {children}
        </InventoryContext.Provider>
    );
}

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (!context) throw new Error("useInventory must be used within InventoryProvider");
    return context;
};
