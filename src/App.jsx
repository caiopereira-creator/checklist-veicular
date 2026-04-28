import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Routes, Route, Navigate } from "react-router-dom";

function Button({ children, className = "", variant = "default", ...props }) {
  const base = "rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = variant === "outline"
    ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
    : "bg-slate-900 text-white hover:bg-slate-800";
  return <button className={`${base} ${styles} ${className}`} {...props}>{children}</button>;
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border bg-white ${className}`}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

const SUPABASE_URL = "https://mudscqoixyokhbnfvwqs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-okSU5LJiPlle9lrnXtgnw_NjiDVJHz";
const CHECKLIST_BUCKET = "vehicle-checklists";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CHECKLIST_SECTIONS = [
  {
    id: "safety",
    title: "Segurança / Acessórios / MNT",
    icon: "🛡️",
    items: [
      "Cinto de Segurança", "Extintor/Validade", "Triângulo", "Macaco", "Chave de Roda", "Porta-escada", "Protetor de Carter", "Tapetes",
      "Vazamento Óleo Motor", "Nível de Óleo", "Nível da Água/Presença Aditivo", "Vazamento de Água", "Nível da Água Limpador", "Nível Fluído de Freio",
      "Folgas Excessivas no Volante", "Bateria/Marca/Identificação", "Funcionamento Velocímetro", "Funcionamento Rastreador", "Funcionamento Limpador",
      "Indicador de Óleo", "Indicador Injeção Eletrônica", "Indicador de Temperatura", "Pisca Alerta", "Pisca Diant. Esq. e Dir.", "Pingo D'água Dir. e Esq.",
      "Luz Média Dir. e Esq.", "Luz Alta Dir. e Esq.", "Pisca Tras. Esq. e Dir.", "Luz Farol Lant. Tras. Dir. e Esq.", "Luz Freio Dir. e Esq.",
      "Luz Ré Dir. e Esq.", "Luz de Placa", "Luz Interna", "Buzina", "Retrovisor Interno", "Retrovisor Ext. Esq.", "Retrovisor Ext. Dir.",
      "Maçanetas Int. Esq. e Dir.", "Maçanetas Ext. Esq. e Dir.", "Tampa do Porta Luva", "Tampa do Porta Fusíveis",
    ],
  },
  { id: "tires", title: "Pneus", icon: "✅", items: ["Dianteiro Esquerdo", "Traseiro Esquerdo", "Dianteiro Direito", "Traseiro Direito", "Step"] },
  { id: "docs", title: "Documentação", icon: "📄", items: ["CNH", "CRLV", "Cartão de Abastecimento"] },
  {
    id: "general",
    title: "Aspecto Geral",
    icon: "🚗",
    items: [
      "Parabrisa Dianteiro", "Faróis", "Capô", "Para-choque Dianteiro", "Grade Para-choque", "Emblema", "Paralama Dianteiro Esq.", "Elevador e Vidros Esq.",
      "Paralama Traseiro Esq.", "Mala", "Lanternas", "Lacre Placa", "Para-choque Traseiro", "Parabrisa Traseiro", "Paralama Traseiro Dir.",
      "Elevador e Vidros Dir.", "Paralama Dianteiro Dir.", "Adesivos", "Calotas", "Aspecto Ext. (Limpeza)", "Aspecto Int. (Limpeza)", "Estofados",
    ],
  },
  { id: "mechanic", title: "Mecânica", icon: "⚙️", items: ["Alinhamento", "Freio", "Motor", "Suspensão", "Escapamento", "Embreagem (Altura/Pressão)"] },
];

const initialForm = {
  inspectionReason: "rotina",
  vehicleModel: "",
  licensePlate: "",
  renavam: "",
  odometer: "",
  driverName: "",
  driverPhone: "",
  driverCnh: "",
  cnhCategory: "",
  cnhExpiryDate: "",
  damageReport: "",
  driverSignature: "",
};

function getErrorMessage(error) {
  if (!error) return "Erro desconhecido.";
  if (typeof error === "string") return error;
  const parts = [error.message, error.details, error.hint, error.code, error.status, error.name].filter(Boolean);
  if (parts.length) return parts.join(" | ");
  try { return JSON.stringify(error); } catch { return "Erro sem detalhes."; }
}

function normalizePlate(plate) {
  return String(plate || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function fileToPreview(file) {
  if (!file) return null;
  return { name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file), rawFile: file };
}

function stripRawFile(photo) {
  return { name: photo?.name || "foto", size: photo?.size || 0, type: photo?.type || "image/jpeg", url: photo?.url || "" };
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function getPreviousChecklistByPlate(savedChecklists, plate) {
  const normalized = normalizePlate(plate);
  return savedChecklists.find((item) => normalizePlate(item.form.licensePlate) === normalized);
}

function buildDriverDamageAlert(previousChecklist, currentRecord) {
  if (!previousChecklist || previousChecklist.status !== "approved" || currentRecord.status !== "needs_review") return null;
  return {
    id: crypto.randomUUID(),
    checklistId: currentRecord.id,
    plate: currentRecord.form.licensePlate,
    vehicleModel: currentRecord.form.vehicleModel,
    previousDriver: previousChecklist.form.driverName,
    currentDriver: currentRecord.form.driverName,
    previousDate: previousChecklist.createdAt,
    currentDate: currentRecord.createdAt,
    status: "open",
    note: "O veículo estava OK no checklist anterior e apresentou dano/reprovação no checklist atual. Possível responsabilidade do condutor anterior.",
    reprovedItems: currentRecord.reprovedItems,
  };
}

async function testSupabaseConnection() {
  const table = await supabase.from("vehicle_checklists").select("id").limit(1);
  const storage = await supabase.storage.from(CHECKLIST_BUCKET).list("", { limit: 1 });
  return [
    table.error ? `Banco: ERRO - ${getErrorMessage(table.error)}` : "Banco: OK",
    storage.error ? `Storage: ERRO - ${getErrorMessage(storage.error)}` : "Storage: OK",
  ].join("\n");
}

async function uploadFileToSupabase(file, path) {
  const { error } = await supabase.storage.from(CHECKLIST_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  if (error) return { url: null, error: getErrorMessage(error) };
  const { data } = supabase.storage.from(CHECKLIST_BUCKET).getPublicUrl(path);
  return { url: data?.publicUrl || null, error: null };
}

async function uploadChecklistMedia(record) {
  const warnings = [];
  const folder = `${normalizePlate(record.form.licensePlate) || "SEMPLACA"}/${record.id}`;
  const uploadedItems = {};

  for (const [itemKey, itemData] of Object.entries(record.items)) {
    const uploadedPhotos = [];
    for (const [index, photo] of (itemData.photos || []).entries()) {
      if (!photo.rawFile) {
        uploadedPhotos.push(stripRawFile(photo));
        continue;
      }
      const extension = photo.rawFile.name.split(".").pop() || "jpg";
      const result = await uploadFileToSupabase(photo.rawFile, `${folder}/photos/${itemKey}-${index}.${extension}`);
      if (result.url) uploadedPhotos.push({ name: photo.name, size: photo.size, type: photo.type, url: result.url });
      else {
        warnings.push(`Foto ${itemKey}-${index}: ${result.error}`);
        uploadedPhotos.push(stripRawFile(photo));
      }
    }
    uploadedItems[itemKey] = { ...itemData, photos: uploadedPhotos };
  }

  let signature = record.form.driverSignature;
  if (signature?.startsWith("data:image")) {
    const result = await uploadFileToSupabase(dataUrlToBlob(signature), `${folder}/signature.png`);
    if (result.url) signature = result.url;
    else warnings.push(`Assinatura: ${result.error}`);
  }

  return { payload: { ...record, form: { ...record.form, driverSignature: signature }, items: uploadedItems }, warnings };
}

async function saveChecklistToSupabase(record) {
  const { payload, warnings } = await uploadChecklistMedia(record);
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  const { error: checklistError } = await supabase.from("vehicle_checklists").insert({
    id: payload.id,
    created_at: payload.createdAt,
    status: payload.status,
    inspection_reason: payload.form.inspectionReason,
    vehicle_model: payload.form.vehicleModel,
    license_plate: payload.form.licensePlate,
    renavam: payload.form.renavam || null,
    odometer: Number(payload.form.odometer || 0),
    driver_name: payload.form.driverName,
    driver_phone: payload.form.driverPhone || null,
    driver_cnh: payload.form.driverCnh || null,
    cnh_category: payload.form.cnhCategory || null,
    cnh_expiry_date: payload.form.cnhExpiryDate || null,
    damage_report: payload.form.damageReport || null,
    driver_signature_url: payload.form.driverSignature,
    raw_payload: cleanPayload,
  });
  if (checklistError) throw new Error(`Falha ao inserir em vehicle_checklists: ${getErrorMessage(checklistError)}`);

  const rows = Object.entries(payload.items).map(([itemKey, itemData]) => {
    const [sectionId, itemIndex] = itemKey.split("__");
    const section = CHECKLIST_SECTIONS.find((s) => s.id === sectionId);
    return {
      checklist_id: payload.id,
      item_key: itemKey,
      section_id: sectionId,
      section_title: section?.title || "Seção",
      item_label: section?.items[Number(itemIndex)] || "Item",
      status: itemData.status,
      observation: itemData.obs || null,
      photos: itemData.photos || [],
    };
  });
  if (rows.length) {
    const { error } = await supabase.from("vehicle_checklist_items").insert(rows);
    if (error) throw new Error(`Falha ao inserir em vehicle_checklist_items: ${getErrorMessage(error)}`);
  }
  return { record: payload, warnings };
}

async function saveDamageAlertToSupabase(alert) {
  if (!alert) return;
  const { error } = await supabase.from("driver_damage_alerts").insert({
    id: alert.id,
    checklist_id: alert.checklistId,
    plate: alert.plate,
    vehicle_model: alert.vehicleModel,
    previous_driver: alert.previousDriver,
    current_driver: alert.currentDriver,
    previous_checklist_date: alert.previousDate,
    current_checklist_date: alert.currentDate,
    status: alert.status,
    note: alert.note,
    reproved_items: alert.reprovedItems,
  });
  if (error) throw new Error(`Falha ao inserir em driver_damage_alerts: ${getErrorMessage(error)}`);
}

function fallbackChecklistFromRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    form: {
      inspectionReason: row.inspection_reason || "rotina",
      vehicleModel: row.vehicle_model || "",
      licensePlate: row.license_plate || "",
      renavam: row.renavam || "",
      odometer: row.odometer || "",
      driverName: row.driver_name || "",
      driverPhone: row.driver_phone || "",
      driverCnh: row.driver_cnh || "",
      cnhCategory: row.cnh_category || "",
      cnhExpiryDate: row.cnh_expiry_date || "",
      damageReport: row.damage_report || "",
      driverSignature: row.driver_signature_url || "",
    },
    items: {},
    reprovedItems: [],
  };
}

function mapDamageAlertFromRow(row) {
  return {
    id: row.id,
    checklistId: row.checklist_id,
    plate: row.plate,
    vehicleModel: row.vehicle_model,
    previousDriver: row.previous_driver,
    currentDriver: row.current_driver,
    previousDate: row.previous_checklist_date,
    currentDate: row.current_checklist_date,
    status: row.status || "open",
    note: row.note,
    reprovedItems: row.reproved_items || [],
    resolvedAt: row.resolved_at || null,
  };
}

async function loadChecklistsFromSupabase() {
  const { data, error } = await supabase
    .from("vehicle_checklists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar vehicle_checklists: ${getErrorMessage(error)}`);

  return (data || []).map((row) => {
    const payload = row.raw_payload || fallbackChecklistFromRow(row);
    return {
      ...payload,
      id: payload.id || row.id,
      createdAt: payload.createdAt || row.created_at,
      status: payload.status || row.status,
    };
  });
}

async function loadDamageAlertsFromSupabase() {
  const { data, error } = await supabase
    .from("driver_damage_alerts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao carregar driver_damage_alerts: ${getErrorMessage(error)}`);
  return (data || []).map(mapDamageAlertFromRow);
}

async function updateDamageAlertStatusInSupabase(id, status) {
  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("driver_damage_alerts")
    .update({ status, resolved_at: resolvedAt })
    .eq("id", id);

  if (error) throw new Error(`Falha ao atualizar ocorrência: ${getErrorMessage(error)}`);
  return resolvedAt;
}

function runLogicTests() {
  const previous = { id: "1", createdAt: "2026-04-01T10:00:00.000Z", status: "approved", form: { licensePlate: "ABC-1234", vehicleModel: "Fiat Strada", driverName: "João" }, reprovedItems: [] };
  const current = { id: "2", createdAt: "2026-04-02T10:00:00.000Z", status: "needs_review", form: { licensePlate: "ABC1234", vehicleModel: "Fiat Strada", driverName: "Pedro" }, reprovedItems: [{ key: "general__0", label: "Parabrisa", photos: [{}] }] };
  console.assert(normalizePlate("abc-1234") === "ABC1234", "normalizePlate deve normalizar placa");
  console.assert(getPreviousChecklistByPlate([previous], "ABC1234")?.id === "1", "deve encontrar checklist anterior");
  console.assert(buildDriverDamageAlert(previous, current)?.status === "open", "deve criar alerta de dano");
  console.assert(buildDriverDamageAlert(null, current) === null, "não deve criar alerta sem anterior");
  console.assert(formatBytes(1024).includes("KB"), "formatBytes deve formatar KB");
  console.assert(stripRawFile({ name: "a.jpg", rawFile: {}, url: "blob:x" }).rawFile === undefined, "stripRawFile remove rawFile");
  console.assert(dataUrlToBlob("data:image/png;base64,AA==") instanceof Blob, "dataUrlToBlob deve retornar Blob");
  console.assert(CHECKLIST_BUCKET === "vehicle-checklists", "nome do bucket deve estar correto");
}
runLogicTests();

export default function VehicleChecklistApp() {
  const [accessMode, setAccessMode] = useState("admin");
  const [view, setView] = useState("form");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [items, setItems] = useState({});
  const [savedChecklists, setSavedChecklists] = useState([]);
  const [driverDamageAlerts, setDriverDamageAlerts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastError, setLastError] = useState("");
  const [lastWarning, setLastWarning] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  const totalSteps = CHECKLIST_SECTIONS.length + 2;
  const currentSection = CHECKLIST_SECTIONS[step - 1];
  const status = useMemo(() => Object.values(items).some((item) => item?.status === "rep") ? "needs_review" : "approved", [items]);
  const reprovedItems = useMemo(() => Object.entries(items).filter(([, value]) => value?.status === "rep").map(([key, value]) => {
    const [sectionId, index] = key.split("__");
    const section = CHECKLIST_SECTIONS.find((s) => s.id === sectionId);
    return { key, section: section?.title || "Seção", label: section?.items[Number(index)] || "Item", obs: value?.obs || "Sem observação", photos: value?.photos || [] };
  }), [items]);
  const openAlerts = driverDamageAlerts.filter((item) => item.status === "open");
  const filteredChecklists = savedChecklists.filter((item) => {
    const q = search.toLowerCase();
    return item.form.licensePlate.toLowerCase().includes(q) || item.form.vehicleModel.toLowerCase().includes(q) || item.form.driverName.toLowerCase().includes(q);
  });

  const loadData = async () => {
    try {
      setLoadingData(true);
      setLastError("");
      const [checklists, alerts] = await Promise.all([
        loadChecklistsFromSupabase(),
        loadDamageAlertsFromSupabase(),
      ]);
      setSavedChecklists(checklists);
      setDriverDamageAlerts(alerts);
    } catch (error) {
      setLastError(getErrorMessage(error));
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateItem = (key, patch) => setItems((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.vehicleModel || !form.licensePlate || !form.odometer || !form.driverName) {
        alert("Preencha veículo/modelo, placa, KM atual e motorista.");
        return false;
      }
      return true;
    }
    if (currentSection) {
      for (let index = 0; index < currentSection.items.length; index += 1) {
        const key = `${currentSection.id}__${index}`;
        const data = items[key];
        if (!data?.status) {
          alert(`Selecione AP, REP ou N/A para o item: ${currentSection.items[index]}`);
          return false;
        }
        if (data.status === "rep" && (!data.photos || data.photos.length === 0)) {
          alert(`Foto obrigatória para item reprovado: ${currentSection.items[index]}`);
          return false;
        }
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveChecklist = async () => {
    if (!form.driverSignature) {
      alert("A assinatura do condutor é obrigatória para finalizar o checklist.");
      return;
    }
    const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), form, items, status, reprovedItems };
    const previous = getPreviousChecklistByPlate(savedChecklists, form.licensePlate);
    try {
      setSaving(true);
      setLastError("");
      setLastWarning("");
      const result = await saveChecklistToSupabase(record);
      const savedRecord = result.record;
      const alertRecord = buildDriverDamageAlert(previous, savedRecord);
      if (alertRecord) await saveDamageAlertToSupabase(alertRecord);
      setSavedChecklists((prev) => [savedRecord, ...prev]);
      if (result.warnings.length) setLastWarning(`Checklist salvo no banco, mas alguns arquivos não subiram ao Storage:\n${result.warnings.join("\n")}`);
      if (alertRecord) {
        setDriverDamageAlerts((prev) => [alertRecord, ...prev]);
        setView(accessMode === "admin" ? "driverDamages" : "form");
      } else {
        setView(accessMode === "admin" ? "dashboard" : "form");
      }
      setForm(initialForm);
      setItems({});
      setStep(0);
      if (accessMode === "driver") alert("Checklist enviado com sucesso.");
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      alert(`Erro ao salvar no Supabase:\n\n${message}`);
    } finally {
      setSaving(false);
    }
  };

  const checkConnection = async () => {
    setConnectionStatus("Testando conexão...");
    try { setConnectionStatus(await testSupabaseConnection()); } catch (error) { setConnectionStatus(`Erro no teste: ${getErrorMessage(error)}`); }
  };

  const resolveDamageAlert = async (id) => {
    try {
      setLastError("");
      const resolvedAt = await updateDamageAlertStatusInSupabase(id, "resolved");
      setDriverDamageAlerts((prev) => prev.map((item) => item.id === id ? { ...item, status: "resolved", resolvedAt } : item));
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      alert(`Erro ao tratar ocorrência:

${message}`);
    }
  };

  const reopenDamageAlert = async (id) => {
    try {
      setLastError("");
      await updateDamageAlertStatusInSupabase(id, "open");
      setDriverDamageAlerts((prev) => prev.map((item) => item.id === id ? { ...item, status: "open", resolvedAt: null } : item));
    } catch (error) {
      const message = getErrorMessage(error);
      setLastError(message);
      alert(`Erro ao reabrir ocorrência:

${message}`);
    }
  };

  const renderDriverPage = () => (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header accessMode="driver" view="form" setView={setView} openAlerts={0} onTest={checkConnection} onReload={loadData} loadingData={loadingData} />
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">
        {loadingData && <StatusBox tone="blue" title="Carregando dados" text="Buscando checklists salvos no Supabase..." />}
        {lastError && <StatusBox tone="red" title="Último erro do Supabase" text={lastError} />}
        {lastWarning && <StatusBox tone="orange" title="Aviso de Storage" text={lastWarning} />}
        <DriverAccessNotice />
        <ChecklistFormView {...{ step, totalSteps, currentSection, form, status, reprovedItems, updateForm, updateItem, setStep, goNext, saveChecklist, saving, items }} />
      </main>
    </div>
  );

  const renderAdminPage = () => (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header accessMode="admin" view={view} setView={setView} openAlerts={openAlerts.length} onTest={checkConnection} onReload={loadData} loadingData={loadingData} />
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">
        {loadingData && <StatusBox tone="blue" title="Carregando dados" text="Buscando checklists salvos no Supabase..." />}
        {connectionStatus && <StatusBox tone="blue" title="Diagnóstico Supabase" text={connectionStatus} />}
        {lastError && <StatusBox tone="red" title="Último erro do Supabase" text={lastError} />}
        {lastWarning && <StatusBox tone="orange" title="Aviso de Storage" text={lastWarning} />}

        {view === "dashboard" ? (
          <Dashboard
            savedChecklists={filteredChecklists}
            rawCount={savedChecklists.length}
            damageCount={openAlerts.length}
            search={search}
            setSearch={setSearch}
            onNew={() => setView("form")}
            onOpenDamages={() => setView("driverDamages")}
            onOpenChecklist={(checklist) => {
              setSelectedChecklist(checklist);
              setView("checklistDetail");
            }}
          />
        ) : view === "driverDamages" ? (
          <DriverDamages
            alerts={driverDamageAlerts}
            onResolve={resolveDamageAlert}
            onReopen={reopenDamageAlert}
            onNew={() => setView("form")}
          />
        ) : view === "checklistDetail" && selectedChecklist ? (
          <ChecklistDetail checklist={selectedChecklist} onBack={() => setView("dashboard")} />
        ) : (
          <ChecklistFormView {...{ step, totalSteps, currentSection, form, status, reprovedItems, updateForm, updateItem, setStep, goNext, saveChecklist, saving, items }} />
        )}
      </main>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/checklist-condutor" replace />} />
      <Route path="/checklist-condutor" element={renderDriverPage()} />
      <Route path="/admin" element={renderAdminPage()} />
      <Route path="*" element={<Navigate to="/checklist-condutor" replace />} />
    </Routes>
  );
}

function Header({ accessMode, view, setView, openAlerts, onTest, onReload, loadingData }) {
  const isAdmin = accessMode === "admin";

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-xl text-white">✓</div>
          <div>
            <h1 className="text-lg font-bold">Checklist Veicular</h1>
            <p className="text-xs text-slate-500">{isAdmin ? "Painel administrativo" : "Acesso exclusivo do condutor"}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onTest}>🧪 Testar Supabase</Button>
            <Button variant="outline" onClick={onReload} disabled={loadingData}>{loadingData ? "Carregando..." : "🔄 Recarregar"}</Button>
            <Button variant={view === "form" ? "default" : "outline"} onClick={() => setView("form")}>🚗 Novo</Button>
            <Button variant={view === "dashboard" ? "default" : "outline"} onClick={() => setView("dashboard")}>📊 Painel</Button>
            <Button variant={view === "driverDamages" ? "default" : "outline"} onClick={() => setView("driverDamages")}>🔴 Danos {openAlerts ? `(${openAlerts})` : ""}</Button>
          </div>
        )}
      </div>
    </header>
  );
}

function StatusBox({ tone, title, text }) {
  const styles = { red: "border-red-200 bg-red-50 text-red-800", orange: "border-orange-200 bg-orange-50 text-orange-800", blue: "border-blue-200 bg-blue-50 text-blue-800" };
  return <div className={`print:hidden mb-4 whitespace-pre-wrap rounded-2xl border p-4 text-sm ${styles[tone]}`}><strong>{title}:</strong><br />{text}</div>;
}

function DriverAccessNotice() {
  return <div className="mx-auto mb-6 max-w-4xl rounded-3xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-900 print:hidden"><p className="text-lg font-black">🔗 Acesso do Condutor</p><p className="mt-1 text-sm">Este modo simula o link exclusivo para condutores, sem acesso ao painel.</p><div className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold text-indigo-700">Link sugerido: /checklist-condutor</div></div>;
}

function ChecklistFormView({ step, totalSteps, currentSection, form, items, status, reprovedItems, updateForm, updateItem, setStep, goNext, saveChecklist, saving }) {
  return <div className="mx-auto max-w-4xl"><Progress step={step} totalSteps={totalSteps} /><Card className="overflow-hidden border-slate-200 shadow-xl"><CardContent className="p-5 sm:p-7">{step === 0 && <Identification form={form} updateForm={updateForm} />}{currentSection && <ChecklistSection section={currentSection} items={items} updateItem={updateItem} />}{step === totalSteps - 1 && <FinalReview form={form} updateForm={updateForm} status={status} reprovedItems={reprovedItems} />}</CardContent></Card><div className="mt-6 flex justify-between gap-3 print:hidden"><Button variant="outline" disabled={step === 0} onClick={() => setStep((prev) => Math.max(0, prev - 1))}>← Anterior</Button>{step < totalSteps - 1 ? <Button onClick={goNext} className="bg-indigo-600 hover:bg-indigo-700">Próximo →</Button> : <Button onClick={saveChecklist} disabled={saving} className="bg-green-600 hover:bg-green-700">{saving ? "Salvando..." : "💾 Finalizar checklist"}</Button>}</div></div>;
}

function Progress({ step, totalSteps }) {
  const percent = Math.round(((step + 1) / totalSteps) * 100);
  return <div className="mb-6 rounded-2xl border bg-white p-4 shadow-sm print:hidden"><div className="mb-2 flex justify-between text-sm font-medium text-slate-600"><span>Passo {step + 1} de {totalSteps}</span><span>{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} /></div></div>;
}

function Field({ label, required, children }) { return <label className="block space-y-2"><span className="text-sm font-semibold text-slate-700">{label} {required && <span className="text-red-500">*</span>}</span>{children}</label>; }
function TextInput(props) { return <input {...props} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />; }

function Identification({ form, updateForm }) {
  return <div className="space-y-7"><div><h2 className="text-2xl font-bold">Identificação do checklist</h2><p className="mt-1 text-sm text-slate-500">Preencha os dados básicos do veículo e do motorista.</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="mb-3 text-sm font-semibold text-slate-700">Motivo da inspeção</p><div className="grid gap-3 sm:grid-cols-3">{[["rotina", "Inspeção Rotina"], ["entrega", "Entrega - Veículo"], ["devolucao", "Devolução - Veículo"]].map(([value, label]) => <button key={value} type="button" onClick={() => updateForm("inspectionReason", value)} className={`rounded-xl border px-4 py-3 text-left text-sm font-medium ${form.inspectionReason === value ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Veículo / Modelo" required><TextInput value={form.vehicleModel} onChange={(e) => updateForm("vehicleModel", e.target.value)} placeholder="Ex: Fiat Strada" /></Field><Field label="Placa" required><TextInput value={form.licensePlate} onChange={(e) => updateForm("licensePlate", e.target.value.toUpperCase())} placeholder="ABC-1234" /></Field><Field label="Renavam"><TextInput value={form.renavam} onChange={(e) => updateForm("renavam", e.target.value)} placeholder="00000000000" /></Field><Field label="KM atual" required><TextInput type="number" value={form.odometer} onChange={(e) => updateForm("odometer", e.target.value)} placeholder="0" /></Field><Field label="Motorista" required><TextInput value={form.driverName} onChange={(e) => updateForm("driverName", e.target.value)} placeholder="Nome completo" /></Field><Field label="Telefone"><TextInput value={form.driverPhone} onChange={(e) => updateForm("driverPhone", e.target.value)} placeholder="(00) 00000-0000" /></Field><Field label="CNH"><TextInput value={form.driverCnh} onChange={(e) => updateForm("driverCnh", e.target.value)} placeholder="Número da CNH" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Categoria"><TextInput value={form.cnhCategory} onChange={(e) => updateForm("cnhCategory", e.target.value.toUpperCase())} placeholder="AB" /></Field><Field label="Validade CNH"><TextInput type="date" value={form.cnhExpiryDate} onChange={(e) => updateForm("cnhExpiryDate", e.target.value)} /></Field></div></div></div>;
}

function ChecklistSection({ section, items, updateItem }) {
  return <div className="space-y-5"><div className="flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-indigo-800"><span className="text-2xl">{section.icon}</span><div><h2 className="text-xl font-bold">{section.title}</h2><p className="text-xs text-indigo-600">Itens reprovados exigem pelo menos uma foto.</p></div></div><div className="divide-y divide-slate-100">{section.items.map((label, index) => { const key = `${section.id}__${index}`; const data = items[key] || {}; const photos = data.photos || []; return <div key={key} className="py-5 first:pt-0"><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold text-slate-800">{label}</p>{data.status === "rep" && photos.length === 0 && <p className="mt-1 text-xs font-medium text-red-600">⚠️ Foto obrigatória para reprovação</p>}</div><div className="flex gap-2"><StatusButton active={data.status === "ap"} onClick={() => updateItem(key, { status: "ap" })} label="AP" tone="green" /><StatusButton active={data.status === "rep"} onClick={() => updateItem(key, { status: "rep" })} label="REP" tone="red" /><StatusButton active={data.status === "na"} onClick={() => updateItem(key, { status: "na" })} label="N/A" tone="slate" /></div></div><div className={`mt-3 rounded-2xl border p-3 ${data.status === "rep" ? "border-red-100 bg-red-50" : "border-slate-100 bg-slate-50"}`}><input value={data.obs || ""} onChange={(e) => updateItem(key, { obs: e.target.value })} placeholder={data.status === "rep" ? "Descreva o motivo da reprovação..." : "Observação opcional..."} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />{data.status === "rep" && <PhotoUploader itemKey={key} photos={photos} updateItem={updateItem} />}</div></div>; })}</div></div>;
}

function PhotoUploader({ itemKey, photos, updateItem }) {
  return <div className="mt-3"><input id={`photo-${itemKey}`} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { const selected = Array.from(e.target.files || []).map(fileToPreview); updateItem(itemKey, { photos: [...photos, ...selected] }); }} /><label htmlFor={`photo-${itemKey}`} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-red-300 bg-white px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50">📷 Tirar / anexar foto da reprovação</label>{photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((photo, i) => <div key={`${photo.url}-${i}`} className="relative overflow-hidden rounded-xl border bg-white"><img src={photo.url} alt={photo.name || "Foto"} className="h-24 w-full object-cover" /><button type="button" onClick={() => updateItem(itemKey, { photos: photos.filter((_, index) => index !== i) })} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-xs text-red-600 shadow-sm">X</button><p className="truncate px-2 py-1 text-[10px] text-slate-500">{formatBytes(photo.size)}</p></div>)}</div>}</div>;
}

function StatusButton({ active, onClick, label, tone }) {
  const tones = { green: active ? "bg-green-600 text-white border-green-600" : "border-green-200 text-green-700 bg-white", red: active ? "bg-red-600 text-white border-red-600" : "border-red-200 text-red-700 bg-white", slate: active ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 text-slate-700 bg-white" };
  return <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-2 text-sm font-bold ${tones[tone]}`}>{label}</button>;
}

function FinalReview({ form, updateForm, status, reprovedItems }) {
  return <div className="space-y-6"><div className={`rounded-3xl p-6 text-center ${status === "approved" ? "bg-green-50" : "bg-orange-50"}`}><div className="text-5xl">{status === "approved" ? "✅" : "⚠️"}</div><h2 className="mt-3 text-2xl font-bold">Revisão final</h2><p className="mt-1 text-sm text-slate-600">{form.vehicleModel} • {form.licensePlate} • Motorista: {form.driverName}</p></div>{reprovedItems.length > 0 && <div className="rounded-2xl border border-red-100 bg-red-50 p-4"><h3 className="mb-3 font-bold text-red-800">⚠️ Itens reprovados</h3><div className="space-y-2">{reprovedItems.map((item) => <div key={item.key} className="rounded-xl bg-white p-3 text-sm"><p className="font-semibold text-slate-800">{item.label}</p><p className="text-xs text-slate-500">{item.section}</p><p className="mt-1 text-red-700">{item.obs}</p><p className="mt-1 text-xs font-medium text-green-700">{item.photos.length} foto(s) anexada(s)</p></div>)}</div></div>}<Field label="Observações gerais / Diagrama de avarias"><textarea value={form.damageReport} onChange={(e) => updateForm("damageReport", e.target.value)} placeholder="Descreva avarias, riscos, amassados, danos ou observações gerais..." className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" /></Field><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-2 font-bold text-slate-800">✍️ Assinatura do condutor <span className="text-red-500">*</span></div><p className="mb-3 text-xs text-slate-500">Assine no campo abaixo como se fosse no papel.</p><SignaturePad value={form.driverSignature} onChange={(value) => updateForm("driverSignature", value)} /></div></div>;
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null); const drawingRef = useRef(false); const lastPointRef = useRef(null);
  const getPoint = (event) => { const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect(); const clientX = event.touches?.[0]?.clientX ?? event.clientX; const clientY = event.touches?.[0]?.clientY ?? event.clientY; return { x: clientX - rect.left, y: clientY - rect.top }; };
  const save = () => { const canvas = canvasRef.current; if (canvas) onChange(canvas.toDataURL("image/png")); };
  const start = (event) => { event.preventDefault(); drawingRef.current = true; lastPointRef.current = getPoint(event); };
  const draw = (event) => { if (!drawingRef.current) return; event.preventDefault(); const canvas = canvasRef.current; const context = canvas.getContext("2d"); const point = getPoint(event); const last = lastPointRef.current; if (!last) return; context.lineWidth = 3; context.lineCap = "round"; context.lineJoin = "round"; context.strokeStyle = "#0f172a"; context.beginPath(); context.moveTo(last.x, last.y); context.lineTo(point.x, point.y); context.stroke(); lastPointRef.current = point; save(); };
  const stop = () => { drawingRef.current = false; lastPointRef.current = null; save(); };
  const clear = () => { const canvas = canvasRef.current; canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); onChange(""); };
  return <div className="space-y-3"><div className="overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50"><canvas ref={canvasRef} width={760} height={220} className="h-56 w-full touch-none bg-white" onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} /></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className={`text-xs font-semibold ${value ? "text-green-700" : "text-red-600"}`}>{value ? "Assinatura capturada com sucesso." : "Assinatura pendente."}</p><Button type="button" variant="outline" onClick={clear}>Limpar assinatura</Button></div></div>;
}

function Dashboard({ savedChecklists, rawCount, damageCount, search, setSearch, onNew, onOpenDamages, onOpenChecklist }) {
  const approved = savedChecklists.filter((item) => item.status === "approved").length; const review = savedChecklists.filter((item) => item.status === "needs_review").length;
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-4"><Metric title="Checklists" value={rawCount} /><Metric title="Aprovados" value={approved} tone="green" /><Metric title="Com reprovação" value={review} tone="orange" /><Metric title="Danos condutores" value={damageCount} tone="red" /></div>{damageCount > 0 && <button onClick={onOpenDamages} className="w-full rounded-3xl border border-red-200 bg-red-50 p-5 text-left shadow-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-lg font-black text-red-800">🔴 Existem veículos com possível dano por condutor</p><p className="text-sm text-red-700">Clique para tratar as pendências.</p></div><span className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white">Abrir</span></div></button>}<div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold">Painel de controle</h2><p className="text-sm text-slate-500">Registros carregados diretamente do Supabase.</p></div><Button onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700">🚗 Novo checklist</Button></div><div className="mt-5 flex items-center gap-2 rounded-2xl border bg-slate-50 px-3 py-2"><span>🔎</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por placa, veículo ou motorista..." className="w-full bg-transparent py-2 text-sm outline-none" /></div><div className="mt-5 space-y-3">{savedChecklists.length === 0 ? <EmptyState /> : savedChecklists.map((item) => <ChecklistCard key={item.id} item={item} onOpenChecklist={onOpenChecklist} />)}</div></div></div>;
}

function EmptyState() { return <div className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center"><div className="text-4xl">📷</div><p className="mt-3 font-semibold text-slate-700">Nenhum checklist salvo ainda.</p><p className="text-sm text-slate-500">Finalize um checklist para aparecer aqui.</p></div>; }
function ChecklistCard({ item, onOpenChecklist }) { return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{item.form.licensePlate}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "approved" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{item.status === "approved" ? "Aprovado" : "Revisão necessária"}</span></div><p className="text-sm text-slate-500">{item.form.vehicleModel} • {item.form.driverName} • KM {item.form.odometer}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString("pt-BR")}</p>{item.form.driverSignature && <img src={item.form.driverSignature} alt="Assinatura" className="mt-2 h-16 max-w-xs rounded-lg border bg-white object-contain" />}</div><Button variant="outline" onClick={() => onOpenChecklist(item)}>👁️ Abrir checklist</Button></div>{item.reprovedItems.length > 0 && <div className="mt-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-800"><strong>{item.reprovedItems.length}</strong> item(ns) reprovado(s): {item.reprovedItems.map((rep) => rep.label).join(", ")}</div>}</div>; }

function ChecklistDetail({ checklist, onBack }) {
  const grouped = CHECKLIST_SECTIONS.map((section) => ({ ...section, sectionItems: section.items.map((label, index) => ({ key: `${section.id}__${index}`, label, data: checklist.items[`${section.id}__${index}`] || {} })) }));
  return <div className="space-y-6"><div className="flex flex-col gap-3 rounded-3xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden"><div><h2 className="text-2xl font-black">Visualização do checklist</h2><p className="text-sm text-slate-500">Confira os dados completos e exporte em PDF.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onBack}>← Voltar</Button><Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700">📄 Exportar PDF</Button></div></div><div className="rounded-3xl border bg-white p-6 shadow-sm print:border-0 print:shadow-none"><div className="border-b pb-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-3xl font-black">Checklist Veicular</h1><p className="mt-1 text-sm text-slate-500">Gerado em {new Date(checklist.createdAt).toLocaleString("pt-BR")}</p></div><span className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${checklist.status === "approved" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{checklist.status === "approved" ? "Aprovado" : "Revisão necessária"}</span></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><InfoBox title="Veículo" lines={[checklist.form.vehicleModel, `Placa: ${checklist.form.licensePlate}`, `Renavam: ${checklist.form.renavam || "Não informado"}`, `KM: ${checklist.form.odometer}`]} /><InfoBox title="Condutor" lines={[checklist.form.driverName, `Telefone: ${checklist.form.driverPhone || "Não informado"}`, `CNH: ${checklist.form.driverCnh || "Não informado"}`, `Categoria: ${checklist.form.cnhCategory || "Não informado"}`]} /></div><div className="mt-5 rounded-2xl border bg-slate-50 p-4"><p className="text-sm font-bold text-slate-700">Motivo da inspeção</p><p className="mt-1 text-sm capitalize text-slate-600">{checklist.form.inspectionReason}</p></div>{checklist.form.damageReport && <div className="mt-5 rounded-2xl border bg-slate-50 p-4"><p className="text-sm font-bold text-slate-700">Observações gerais / Avarias</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{checklist.form.damageReport}</p></div>}<div className="mt-6 space-y-5">{grouped.map((section) => <SectionDetail key={section.id} section={section} />)}</div>{checklist.form.driverSignature && <div className="mt-6 rounded-2xl border p-4 print:break-inside-avoid"><p className="mb-2 text-sm font-bold text-slate-700">Assinatura do condutor</p><img src={checklist.form.driverSignature} alt="Assinatura" className="h-28 max-w-md rounded-xl bg-white object-contain" /></div>}</div></div>;
}

function SectionDetail({ section }) { return <div className="rounded-2xl border p-4 print:break-inside-avoid"><h3 className="mb-3 text-lg font-black text-slate-800">{section.icon} {section.title}</h3><div className="space-y-2">{section.sectionItems.map(({ key, label, data }) => <ItemDetail key={key} label={label} data={data} />)}</div></div>; }
function ItemDetail({ label, data }) { return <div className={`rounded-xl border p-3 text-sm ${data.status === "rep" ? "border-red-200 bg-red-50" : "bg-white"}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold text-slate-800">{label}</p><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${data.status === "ap" ? "bg-green-100 text-green-700" : data.status === "rep" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{data.status ? data.status.toUpperCase() : "NÃO RESPONDIDO"}</span></div>{data.obs && <p className="mt-2 text-slate-600">Obs: {data.obs}</p>}{data.photos?.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{data.photos.map((photo, i) => <img key={`${photo.url}-${i}`} src={photo.url} alt={photo.name || "Foto"} className="h-28 w-full rounded-xl border bg-white object-cover" />)}</div>}</div>; }
function InfoBox({ title, lines }) { return <div className="rounded-2xl border bg-slate-50 p-4"><p className="mb-2 text-sm font-bold text-slate-700">{title}</p><div className="space-y-1 text-sm text-slate-600">{lines.map((line, index) => <p key={index}>{line}</p>)}</div></div>; }

function DriverDamages({ alerts, onResolve, onReopen, onNew }) {
  const open = alerts.filter((item) => item.status === "open"); const resolved = alerts.filter((item) => item.status === "resolved");
  return <div className="space-y-6"><div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-black text-red-800">🔴 Danos Condutores</h2><p className="mt-1 text-sm text-red-700">Veículos que estavam OK no checklist anterior e apareceram com reprovação no checklist seguinte.</p></div><Button onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700">🚗 Novo checklist</Button></div></div>{open.length === 0 ? <div className="rounded-3xl border border-dashed bg-white p-8 text-center shadow-sm"><div className="text-5xl">✅</div><h3 className="mt-3 text-xl font-bold">Nenhum dano pendente</h3><p className="mt-1 text-sm text-slate-500">Quando uma ocorrência for tratada, ela sai da lista principal.</p></div> : <div className="grid gap-4">{open.map((alert) => <DamageAlertCard key={alert.id} alert={alert} onResolve={onResolve} />)}</div>}{resolved.length > 0 && <div className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-bold text-slate-800">Ocorrências tratadas</h3><div className="space-y-3">{resolved.map((alert) => <div key={alert.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-800">{alert.plate} • {alert.vehicleModel}</p><p className="text-sm text-slate-500">Tratado em {new Date(alert.resolvedAt).toLocaleString("pt-BR")}</p></div><Button variant="outline" onClick={() => onReopen(alert.id)}>Reabrir</Button></div></div>)}</div></div>}</div>;
}

function DamageAlertCard({ alert, onResolve }) { return <div className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm"><div className="bg-red-600 p-5 text-white"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-5xl">🚗</div><h3 className="mt-2 text-2xl font-black">{alert.plate} em alerta vermelho</h3><p className="text-sm text-red-100">{alert.vehicleModel}</p></div><div className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold">Possível dano por condutor</div></div></div><div className="space-y-4 p-5"><div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800"><strong>Observação automática:</strong> {alert.note}</div><div className="grid gap-3 sm:grid-cols-2"><InfoBox title="Checklist anterior OK" lines={[`Condutor anterior: ${alert.previousDriver}`, new Date(alert.previousDate).toLocaleString("pt-BR")]} /><InfoBox title="Checklist atual com problema" lines={[`Condutor atual: ${alert.currentDriver}`, new Date(alert.currentDate).toLocaleString("pt-BR")]} /></div><div><h4 className="mb-2 font-bold text-slate-800">Itens identificados</h4><div className="space-y-2">{alert.reprovedItems.map((item) => <div key={item.key} className="rounded-2xl border bg-white p-3 text-sm"><p className="font-bold text-red-700">{item.label}</p><p className="text-xs text-slate-500">{item.section}</p><p className="mt-1 text-slate-700">{item.obs}</p><p className="mt-1 text-xs font-semibold text-green-700">{item.photos.length} foto(s) anexada(s)</p></div>)}</div></div><div className="flex flex-col gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-green-800">Ocorrência tratada?</p><p className="text-sm text-green-700">Ao clicar em OK, o veículo sai da aba principal de danos pendentes.</p></div><Button onClick={() => onResolve(alert.id)} className="bg-green-600 hover:bg-green-700">✅ Dar OK / Tratado</Button></div></div></div>; }
function Metric({ title, value, tone = "slate" }) { const tones = { slate: "bg-white text-slate-900", green: "bg-green-50 text-green-800", orange: "bg-orange-50 text-orange-800", red: "bg-red-50 text-red-800" }; return <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone]}`}><p className="text-sm font-semibold opacity-70">{title}</p><p className="mt-2 text-3xl font-black">{value}</p></div>; }
