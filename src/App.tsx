import React, { useEffect, useMemo, useState } from "react";

type Route = "login" | "checklist" | "admin";
type Role = "operador" | "admin";
type Status = "" | "ap" | "rep" | "na";
type CaptureMode = "user" | "environment";

type Session = {
  id: string;
  name: string;
  role: Role;
  unit: string;
};

type Media = {
  preview: string;
  name: string;
};

type Item = {
  status: Status;
  notes: string;
  evidence: Media;
};

type ItemDef = {
  key: string;
  label: string;
};

type Section = {
  title: string;
  items: ItemDef[];
};

type ChecklistRecord = {
  id: string;
  createdAt: string;
  submittedBy: string;
  unit: string;
  vehiclePlate: string;
  vehicleModel: string;
  odometer: string;
  checklistType: string;
  motive: string;
  driverName: string;
  driverId: string;
  cnhValidity: string;
  media: Record<string, Media>;
  generalNotes: string;
  items: Record<string, Item>;
};

const SESSION_KEY = "veh_check_session_simple_v3";
const RECORDS_KEY = "veh_check_records_simple_v3";

const UNITS = [
  "Feira norte",
  "Feira Sul",
  "Santo Amaro",
  "Irecê - Comercial",
  "Casa nova",
  "Itaberaba - Comercial",
  "Itaberaba - Leitura",
  "Irecê - Leitura",
  "Serrinha - Leitura",
  "Feira de Santana - Leitura",
] as const;

const MEDIA_FIELDS = [
  { key: "frontPhoto", label: "Frente", capture: "environment" as const, required: true },
  { key: "rearPhoto", label: "Traseira", capture: "environment" as const, required: true },
  { key: "leftPhoto", label: "Lateral Esquerda", capture: "environment" as const, required: true },
  { key: "rightPhoto", label: "Lateral Direita", capture: "environment" as const, required: true },
  { key: "driverPhoto", label: "Foto do Motorista", capture: "user" as const, required: true },
] as const;

const SECTIONS: Section[] = [
  {
    title: "Segurança / Acessórios",
    items: [
      { key: "cinto_seguranca", label: "Cinto de Segurança" },
      { key: "extintor_validade", label: "Extintor/Validade" },
      { key: "triangulo", label: "Triângulo" },
      { key: "macaco", label: "Macaco" },
      { key: "chave_roda", label: "Chave de Roda" },
      { key: "tapetes", label: "Tapetes" },
    ],
  },
  {
    title: "Motor / Fluídos",
    items: [
      { key: "vazamento_oleo_motor", label: "Vazamento Óleo Motor" },
      { key: "nivel_oleo", label: "Nível de Óleo" },
      { key: "nivel_agua_aditivo", label: "Nível da Água/Presença Aditivo" },
      { key: "vazamento_agua", label: "Vazamento de Água" },
      { key: "nivel_fluido_freio", label: "Nível Fluído de Freio" },
      { key: "folgas_volante", label: "Folgas no Volante" },
      { key: "fixacao_filtro_ar_protecao", label: "Fixação do conjunto de filtro de ar e sua proteção" },
    ],
  },
  {
    title: "Cabine / Mecânica",
    items: [
      { key: "retrovisor_interno", label: "Retrovisor Interno" },
      { key: "retrovisor_externo_esq", label: "Retrovisor Ext. Esq." },
      { key: "retrovisor_externo_dir", label: "Retrovisor Ext. Dir." },
      { key: "pneu_dianteiro_esq", label: "Pneu Dianteiro Esquerdo" },
      { key: "pneu_dianteiro_dir", label: "Pneu Dianteiro Direito" },
      { key: "pneu_traseiro_esq", label: "Pneu Traseiro Esquerdo" },
      { key: "pneu_traseiro_dir", label: "Pneu Traseiro Direito" },
      { key: "freio_mecanica", label: "Freio" },
      { key: "motor", label: "Motor" },
      { key: "suspensao", label: "Suspensão" },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((section) => section.items);
const STEPS = ["Veículo", "Condutor", "Fotos", "Checklist", "Prévia"] as const;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyMedia(): Media {
  return { preview: "", name: "" };
}

function normalizePlate(value: string): string {
  return String(value || "").trim().toUpperCase();
}

function formatDateTime(value: string): string {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countRep(items: Record<string, Item>): number {
  return Object.values(items).filter((item) => item.status === "rep").length;
}

function statusText(status: Status): string {
  if (status === "ap") return "AP";
  if (status === "rep") return "REP";
  if (status === "na") return "N/A";
  return "Pendente";
}

function statusClass(status: Status): string {
  if (status === "rep") return "bg-red-100 text-red-700";
  if (status === "ap") return "bg-emerald-100 text-emerald-700";
  if (status === "na") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-500";
}

function createItems(): Record<string, Item> {
  const result: Record<string, Item> = {};
  for (const item of ALL_ITEMS) {
    result[item.key] = {
      status: "",
      notes: "",
      evidence: emptyMedia(),
    };
  }
  return result;
}

function createMedia(): Record<string, Media> {
  const result: Record<string, Media> = {};
  for (const field of MEDIA_FIELDS) {
    result[field.key] = emptyMedia();
  }
  return result;
}

function createForm(session?: Session | null): ChecklistRecord {
  return {
    id: "preview",
    createdAt: new Date().toISOString(),
    submittedBy: session?.name || "",
    unit: session?.unit || "",
    vehiclePlate: "",
    vehicleModel: "",
    odometer: "",
    checklistType: "saida",
    motive: "rotina",
    driverName: "",
    driverId: "",
    cnhValidity: "",
    media: createMedia(),
    generalNotes: "",
    items: createItems(),
  };
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadRecords(): ChecklistRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    const data = raw ? (JSON.parse(raw) as ChecklistRecord[]) : [];
    return data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  } catch {
    return [];
  }
}

function saveRecords(records: ChecklistRecord[]): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function getRouteFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  if (hash === "admin") return "admin";
  if (hash === "checklist") return "checklist";
  return "login";
}

function setRouteHash(route: Route): void {
  window.location.hash = `#/${route}`;
}

function findPreviousRecord(records: ChecklistRecord[], current: ChecklistRecord): ChecklistRecord | null {
  const history = records.filter(
    (record) => normalizePlate(record.vehiclePlate) === normalizePlate(current.vehiclePlate)
  );
  const index = history.findIndex((record) => record.id === current.id);
  return index >= 0 ? history[index + 1] || null : null;
}

function findNewIssues(current: ChecklistRecord, previous: ChecklistRecord | null): ItemDef[] {
  if (!previous) return [];
  return ALL_ITEMS.filter(
    (item) =>
      current.items[item.key].status === "rep" &&
      previous.items[item.key].status !== "rep"
  );
}

function captureFile(
  file: File | undefined,
  onDone: (preview: string, name: string) => void
): void {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result || ""), file.name || `foto-${uid()}.jpg`);
  reader.readAsDataURL(file);
}

function Badge(props: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${props.className}`}>
      {props.children}
    </span>
  );
}

function FileCapture(props: {
  label: string;
  preview: string;
  captureMode: CaptureMode;
  required?: boolean;
  onChange: (preview: string, name: string) => void;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <label className="mb-1 block text-sm font-medium">
        {props.label}
        {props.required ? " *" : ""}
      </label>
      <input
        type="file"
        accept="image/*"
        capture={props.captureMode}
        className="block w-full text-sm"
        onChange={(e) => captureFile(e.target.files?.[0] || undefined, props.onChange)}
      />
      {props.preview ? (
        <img
          src={props.preview}
          alt={props.label}
          className="mt-3 h-36 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">
          {props.required ? "Tire ou envie a foto" : "Foto opcional"}
        </div>
      )}
    </div>
  );
}

function Gallery(props: { media: Record<string, Media> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {MEDIA_FIELDS.map((field) => (
        <div key={field.key} className="rounded-2xl border p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">{field.label}</p>
          {props.media[field.key].preview ? (
            <img
              src={props.media[field.key].preview}
              alt={field.label}
              className="h-28 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-28 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">
              Sem foto
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionResults(props: { items: Record<string, Item> }) {
  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => (
        <div key={section.title} className="rounded-2xl border p-4">
          <h3 className="mb-3 text-base font-semibold">{section.title}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {section.items.map((item) => {
              const data = props.items[item.key];
              return (
                <div key={item.key} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="font-medium">{item.label}</span>
                    <Badge className={statusClass(data.status)}>{statusText(data.status)}</Badge>
                  </div>
                  {data.status === "rep" ? (
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Obs:</strong> {data.notes || "-"}
                      </p>
                      {data.evidence.preview ? (
                        <img
                          src={data.evidence.preview}
                          alt={item.label}
                          className="h-32 w-full rounded-xl object-cover"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChecklistVeicularOfflineMvp() {
  const [route, setRouteState] = useState<Route>(getRouteFromHash());
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [records, setRecords] = useState<ChecklistRecord[]>(() => loadRecords());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ChecklistRecord>(() => createForm(loadSession()));
  const [step, setStep] = useState(0);
  const [loginName, setLoginName] = useState("");
  const [loginRole, setLoginRole] = useState<Role>("operador");
  const [loginUnit, setLoginUnit] = useState<(typeof UNITS)[number]>(UNITS[0]);
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const progress = ((step + 1) / STEPS.length) * 100;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const unitOk = !unitFilter || record.unit === unitFilter;
      const haystack =
        `${record.vehiclePlate} ${record.vehicleModel} ${record.driverName} ${record.submittedBy} ${record.unit}`.toLowerCase();
      return unitOk && (!term || haystack.includes(term));
    });
  }, [records, search, unitFilter]);

  const selected = useMemo(
    () =>
      filtered.find((record) => record.id === selectedId) ||
      records.find((record) => record.id === selectedId) ||
      null,
    [filtered, records, selectedId]
  );

  const previousRecord = useMemo(() => {
    if (!selected) return null;
    return findPreviousRecord(records, selected);
  }, [records, selected]);

  const newIssues = useMemo(() => {
    if (!selected) return [];
    return findNewIssues(selected, previousRecord);
  }, [selected, previousRecord]);

  const warningText = useMemo(() => {
    if (!selected || !previousRecord) return "";
    if (countRep(previousRecord.items) === 0 && countRep(selected.items) > 0) {
      return `Atenção: no checklist anterior desta placa o veículo estava sem pendências. Agora foram registradas ${newIssues.length || countRep(selected.items)} novas pendências. Possível responsável inicial para tratativa: ${previousRecord.driverName}.`;
    }
    if (newIssues.length > 0) {
      return `Foram identificadas ${newIssues.length} novas pendências que não constavam no checklist anterior desta placa. Possível responsável inicial para tratativa: ${previousRecord.driverName}.`;
    }
    return "";
  }, [selected, previousRecord, newIssues]);

  useEffect(() => {
    const onHash = () => setRouteState(getRouteFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    saveSession(session);
    setForm(createForm(session));
  }, [session]);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  function setRoute(routeValue: Route): void {
    setRouteHash(routeValue);
    setRouteState(routeValue);
  }

  function validate(target = step): boolean {
    if (target === 0) {
      return (
        !!form.unit &&
        !!form.vehiclePlate.trim() &&
        !!form.vehicleModel.trim() &&
        !!form.odometer.trim() &&
        !!form.checklistType &&
        !!form.motive.trim()
      );
    }

    if (target === 1) {
      return (
        !!form.driverName.trim() &&
        !!form.cnhValidity.trim() &&
        !!form.media.driverPhoto.preview
      );
    }

    if (target === 2) {
      return MEDIA_FIELDS
        .filter((field) => field.required && field.key !== "driverPhoto")
        .every((field) => !!form.media[field.key].preview);
    }

    if (target === 3) {
      return ALL_ITEMS.every((item) => {
        const data = form.items[item.key];
        if (!data.status) return false;
        if (data.status !== "rep") return true;
        return !!data.notes.trim() && !!data.evidence.preview;
      });
    }

    return true;
  }

  function updateMedia(key: string, preview: string, name: string): void {
    setForm((prev) => ({
      ...prev,
      media: {
        ...prev.media,
        [key]: { ...prev.media[key], preview, name },
      },
    }));
  }

  function updateItem(key: string, patch: Partial<Item>): void {
    setForm((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [key]: { ...prev.items[key], ...patch },
      },
    }));
  }

  async function saveChecklist(): Promise<void> {
    if (!session) {
      setMessage("Faça login para salvar um checklist.");
      return;
    }

    if (!validate(0) || !validate(1) || !validate(2) || !validate(3)) {
      setMessage(
        "Preencha os campos obrigatórios. Frente, traseira, laterais e foto do motorista são obrigatórias. Toda não conformidade REP precisa de observação e foto."
      );
      return;
    }

    try {
      setSaving(true);

      const record: ChecklistRecord = {
        ...form,
        id: uid(),
        createdAt: new Date().toISOString(),
        submittedBy: session.name,
        unit: form.unit || session.unit,
        vehiclePlate: normalizePlate(form.vehiclePlate),
        vehicleModel: form.vehicleModel.trim(),
        odometer: form.odometer.trim(),
        motive: form.motive.trim(),
        driverName: form.driverName.trim(),
        driverId: form.driverId.trim(),
        generalNotes: form.generalNotes.trim(),
      };

      setRecords((prev) =>
        [record, ...prev].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      );
      setForm(createForm(session));
      setStep(0);
      setMessage("Checklist salvo com sucesso.");
    } finally {
      setSaving(false);
    }
  }

  function login(): void {
    if (!loginName.trim()) return;
    const next: Session = {
      id: uid(),
      name: loginName.trim(),
      role: loginRole,
      unit: loginUnit,
    };
    setSession(next);
    setRoute(loginRole === "admin" ? "admin" : "checklist");
  }

  function logout(): void {
    setSession(null);
    setForm(createForm());
    setRoute("login");
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[1fr,1.1fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Entrar no sistema</h2>
              <p className="mt-2 text-sm text-slate-600">
                Versão simplificada para rodar com mais estabilidade.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Seu nome</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder="Ex.: Supervisor João"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Perfil</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={loginRole}
                    onChange={(e) => setLoginRole(e.target.value as Role)}
                  >
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Unidade</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={loginUnit}
                    onChange={(e) => setLoginUnit(e.target.value as (typeof UNITS)[number])}
                  >
                    {UNITS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="w-full rounded-2xl bg-black px-4 py-3 text-sm text-white disabled:opacity-50"
                  disabled={!loginName.trim()}
                  onClick={login}
                >
                  Entrar
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">Versão simplificada</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-50 p-3">Sem exportação em PDF</div>
                <div className="rounded-2xl bg-slate-50 p-3">Admin mais leve</div>
                <div className="rounded-2xl bg-slate-50 p-3">Foco em estabilidade</div>
                <div className="rounded-2xl bg-slate-50 p-3">Salvamento local</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (route === "admin" && session.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Acesso restrito</h2>
            <p className="mt-2 text-sm text-slate-600">Seu perfil atual é operacional.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Checklist Veicular</h1>
              <p className="mt-1 text-sm text-slate-600">
                Usuário: {session.name} • Perfil: {session.role === "admin" ? "Administrador" : "Operador"} • Unidade: {session.unit}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-xl border px-3 py-2 text-sm ${route === "checklist" ? "bg-black text-white" : "bg-white"}`}
                onClick={() => setRoute("checklist")}
              >
                Checklist
              </button>

              {session.role === "admin" ? (
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-sm ${route === "admin" ? "bg-black text-white" : "bg-white"}`}
                  onClick={() => setRoute("admin")}
                >
                  Administrador
                </button>
              ) : null}

              <button
                type="button"
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={logout}
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        {route === "admin" ? (
          <div className="grid gap-6 lg:grid-cols-[0.95fr,1.25fr]">
            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Visão do administrador</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border p-4">
                    <p className="font-medium">Total de checklists</p>
                    <p className="mt-1 text-2xl font-bold">{records.length}</p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="font-medium">Com pendência</p>
                    <p className="mt-1 text-2xl font-bold">
                      {records.filter((record) => countRep(record.items) > 0).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Buscar checklist</h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Unidade</label>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={unitFilter || "all"}
                      onChange={(e) => setUnitFilter(e.target.value === "all" ? "" : e.target.value)}
                    >
                      <option value="all">Todas as unidades</option>
                      {UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Buscar</label>
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Placa, veículo, condutor"
                    />
                  </div>

                  <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                    {!filtered.length ? (
                      <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                        Nenhum checklist encontrado.
                      </div>
                    ) : (
                      filtered.map((record) => {
                        const total = countRep(record.items);
                        const active = selectedId === record.id;

                        return (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => setSelectedId(record.id)}
                            className={`w-full rounded-2xl border p-4 text-left ${active ? "border-black bg-slate-50" : "bg-white"}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">
                                  {record.vehiclePlate} • {record.vehicleModel}
                                </p>
                                <p className="text-sm text-slate-600">
                                  Condutor: {record.driverName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {record.unit} • {formatDateTime(record.createdAt)}
                                </p>
                              </div>

                              <Badge className={total > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                                {total} pendência(s)
                              </Badge>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-4 text-lg font-semibold">Checklist realizado</div>

                {!selected ? (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                    Clique em um checklist para abrir.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {warningText ? (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-700">
                        <p>{warningText}</p>
                      </div>
                    ) : null}

                    <Gallery media={selected.media} />

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="grid gap-4 text-sm md:grid-cols-3 xl:grid-cols-4">
                        <div>
                          <p className="text-slate-500">Unidade</p>
                          <p className="font-semibold">{selected.unit || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Data</p>
                          <p className="font-semibold">{formatDateTime(selected.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Preenchido por</p>
                          <p className="font-semibold">{selected.submittedBy || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Veículo</p>
                          <p className="font-semibold">{selected.vehicleModel || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Placa</p>
                          <p className="font-semibold">{selected.vehiclePlate || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">KM</p>
                          <p className="font-semibold">{selected.odometer || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Condutor</p>
                          <p className="font-semibold">{selected.driverName || "-"}</p>
                        </div>
                        {previousRecord ? (
                          <div>
                            <p className="text-slate-500">Checklist anterior</p>
                            <p className="font-semibold">{previousRecord.driverName}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <SectionResults items={selected.items} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.35fr,0.95fr]">
            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Etapa {step + 1} de {STEPS.length}</span>
                    <span>{STEPS[step]}</span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-black"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {step === 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Unidade *</label>
                      <select
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.unit}
                        onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                      >
                        <option value="">Selecione a unidade</option>
                        {UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Placa *</label>
                      <input
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.vehiclePlate}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            vehiclePlate: normalizePlate(e.target.value),
                          }))
                        }
                        placeholder="ABC1D23"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Veículo *</label>
                      <input
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.vehicleModel}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, vehicleModel: e.target.value }))
                        }
                        placeholder="Ex.: Fiat Strada"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">KM *</label>
                      <input
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.odometer}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, odometer: e.target.value }))
                        }
                        placeholder="140943"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Motivo *</label>
                      <select
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.motive}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, motive: e.target.value }))
                        }
                      >
                        <option value="rotina">Rotina</option>
                        <option value="saida">Saída</option>
                        <option value="retorno">Retorno</option>
                        <option value="manutencao">Manutenção</option>
                        <option value="troca_condutor">Troca de condutor</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Tipo *</label>
                      <select
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.checklistType}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, checklistType: e.target.value }))
                        }
                      >
                        <option value="saida">Saída</option>
                        <option value="retorno">Retorno</option>
                        <option value="troca_condutor">Troca de condutor</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="grid gap-4 md:grid-cols-[1fr,320px]">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium">Condutor *</label>
                        <input
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={form.driverName}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, driverName: e.target.value }))
                          }
                          placeholder="Nome completo"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Matrícula / documento</label>
                        <input
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={form.driverId}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, driverId: e.target.value }))
                          }
                          placeholder="Opcional"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">Validade CNH *</label>
                        <input
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          type="date"
                          value={form.cnhValidity}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, cnhValidity: e.target.value }))
                          }
                        />
                      </div>

                      <FileCapture
                        label="Foto do Motorista"
                        preview={form.media.driverPhoto.preview}
                        captureMode="user"
                        required
                        onChange={(preview, name) => updateMedia("driverPhoto", preview, name)}
                      />
                    </div>

                    <div className="rounded-2xl border border-dashed p-4">
                      {form.media.driverPhoto.preview ? (
                        <img
                          src={form.media.driverPhoto.preview}
                          alt="Motorista"
                          className="h-72 w-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-72 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
                          Prévia da foto do motorista
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {MEDIA_FIELDS.filter((field) => field.key !== "driverPhoto").map((field) => (
                      <FileCapture
                        key={field.key}
                        label={field.label}
                        preview={form.media[field.key].preview}
                        captureMode={field.capture}
                        required={field.required}
                        onChange={(preview, name) => updateMedia(field.key, preview, name)}
                      />
                    ))}
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
                      Todo item marcado como REP precisa de observação e foto obrigatória.
                    </div>

                    {SECTIONS.map((section) => (
                      <div key={section.title} className="rounded-2xl border p-4">
                        <h3 className="mb-3 text-base font-semibold">{section.title}</h3>

                        <div className="grid gap-4 md:grid-cols-2">
                          {section.items.map((item) => {
                            const data = form.items[item.key];

                            return (
                              <div key={item.key} className="rounded-xl border p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-medium">{item.label}</p>
                                    <p className="text-xs text-slate-500">Marque AP, REP ou N/A.</p>
                                  </div>
                                  <Badge className={statusClass(data.status)}>
                                    {statusText(data.status)}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <button
                                    type="button"
                                    className={`rounded-xl border px-3 py-2 text-sm ${data.status === "ap" ? "bg-black text-white" : "bg-white"}`}
                                    onClick={() =>
                                      updateItem(item.key, {
                                        status: "ap",
                                        notes: "",
                                        evidence: emptyMedia(),
                                      })
                                    }
                                  >
                                    AP
                                  </button>

                                  <button
                                    type="button"
                                    className={`rounded-xl border px-3 py-2 text-sm ${data.status === "rep" ? "bg-red-600 text-white" : "bg-white"}`}
                                    onClick={() => updateItem(item.key, { status: "rep" })}
                                  >
                                    REP
                                  </button>

                                  <button
                                    type="button"
                                    className={`rounded-xl border px-3 py-2 text-sm ${data.status === "na" ? "bg-slate-600 text-white" : "bg-white"}`}
                                    onClick={() =>
                                      updateItem(item.key, {
                                        status: "na",
                                        notes: "",
                                        evidence: emptyMedia(),
                                      })
                                    }
                                  >
                                    N/A
                                  </button>
                                </div>

                                {data.status === "rep" ? (
                                  <div className="mt-4 space-y-3">
                                    <div>
                                      <label className="mb-1 block text-sm font-medium">Obs *</label>
                                      <textarea
                                        className="min-h-[88px] w-full rounded-xl border px-3 py-2 text-sm"
                                        value={data.notes}
                                        onChange={(e) =>
                                          updateItem(item.key, { notes: e.target.value })
                                        }
                                        placeholder="Descreva a não conformidade"
                                      />
                                    </div>

                                    <FileCapture
                                      label="Foto da não conformidade"
                                      preview={data.evidence.preview}
                                      captureMode="environment"
                                      required
                                      onChange={(preview, name) =>
                                        updateItem(item.key, {
                                          evidence: { ...data.evidence, preview, name },
                                        })
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div>
                      <label className="mb-1 block text-sm font-medium">Observações gerais</label>
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border px-3 py-2 text-sm"
                        value={form.generalNotes}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, generalNotes: e.target.value }))
                        }
                        placeholder="Observações complementares"
                      />
                    </div>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl border p-4">
                      <h3 className="mb-3 text-base font-semibold">Prévia do checklist</h3>

                      <Gallery media={form.media} />

                      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                        <div className="grid gap-4 text-sm md:grid-cols-3 xl:grid-cols-4">
                          <div>
                            <p className="text-slate-500">Unidade</p>
                            <p className="font-semibold">{form.unit || "-"}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Veículo</p>
                            <p className="font-semibold">{form.vehicleModel || "-"}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Placa</p>
                            <p className="font-semibold">{form.vehiclePlate || "-"}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Condutor</p>
                            <p className="font-semibold">{form.driverName || "-"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <SectionResults items={form.items} />
                      </div>

                      <div className="mt-6 rounded-2xl border p-4 text-sm">
                        <p className="font-medium">Resumo</p>
                        <p className="mt-2 text-slate-700">
                          Pendências: <strong>{countRep(form.items)}</strong>
                        </p>

                        {ALL_ITEMS.filter((item) => form.items[item.key].status === "rep").length > 0 ? (
                          ALL_ITEMS.filter((item) => form.items[item.key].status === "rep").map((item) => (
                            <div key={item.key} className="mt-2 rounded-xl bg-rose-50 p-3">
                              <p className="font-medium text-rose-700">{item.label}</p>
                              <p className="text-slate-700">{form.items[item.key].notes}</p>
                            </div>
                          ))
                        ) : (
                          <p className="mt-2 text-slate-600">Nenhuma não conformidade registrada.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    className="rounded-2xl border px-4 py-2 text-sm"
                    onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
                    disabled={step === 0}
                  >
                    Voltar
                  </button>

                  {step < STEPS.length - 1 ? (
                    <button
                      type="button"
                      className="rounded-2xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                      onClick={() => {
                        if (validate(step)) {
                          setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
                        }
                      }}
                      disabled={!validate(step)}
                    >
                      Avançar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-2xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                      onClick={() => void saveChecklist()}
                      disabled={saving}
                    >
                      {saving ? "Salvando..." : "Salvar checklist"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-lg font-semibold">Versão leve para uso</h3>
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-3">Sem exportação em PDF</div>
                  <div className="rounded-2xl bg-slate-50 p-3">Admin reduzido ao essencial</div>
                  <div className="rounded-2xl bg-slate-50 p-3">Foco em estabilidade</div>
                  <div className="rounded-2xl bg-slate-50 p-3">Salvamento local no navegador</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}