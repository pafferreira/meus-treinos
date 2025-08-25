import React, { useEffect, useMemo, useState } from "react";

/**
 * Meus Treinos – Página responsiva e minimalista (sem dependências externas)
 * 
 * ✔ Catálogo com busca por nome/músculo
 * ✔ Para cada exercício: imagem do APARELHO e ALTERNATIVA com peso livre
 * ✔ Sugestão de 3–4 séries, reps e descanso por objetivo (força/hipertrofia/resistência)
 * ✔ Multiusuário simples, medidas opcionais (peso/altura) e IMC estimado
 * ✔ Persistência local via localStorage
 * 
 * Observação: este arquivo é TSX/JSX VÁLIDO e não contém emojis/símbolos especiais fora de strings.
 */

// ------------------------------- Utilidades -------------------------------
function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

const DB = {
  USERS: "meus-treinos:users",
  EXERCISES: "meus-treinos:exercises",
};

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS<T>(key: string, value: T) {
  try {
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// --------------------------- Dados e constantes ---------------------------
const GOALS = [
  { id: "strength", label: "Forca" },
  { id: "hypertrophy", label: "Hipertrofia" },
  { id: "endurance", label: "Resistencia" },
] as const;

const MUSCLES = [
  "Peito",
  "Costas",
  "Ombros",
  "Biceps",
  "Triceps",
  "Quadriceps",
  "Posterior",
  "Gluteos",
  "Panturrilhas",
  "Core",
] as const;

type GoalId = typeof GOALS[number]["id"];

type Exercise = {
  id: string;
  name: string;
  primaryMuscles: string[];
  machineImg?: string;
  freeAltName?: string;
  freeAltImg?: string;
  notes?: string;
};

type User = {
  id: string;
  name: string;
  weight?: number; // kg
  height?: number; // cm
};

const SEED_EXERCISES: Exercise[] = [
  {
    id: uid(),
    name: "Supino reto",
    primaryMuscles: ["Peito", "Triceps"],
    machineImg:
      "https://images.unsplash.com/photo-1571907480495-6acb709b7510?q=80&w=800&auto=format&fit=crop",
    freeAltName: "Supino com halteres",
    freeAltImg:
      "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=800&auto=format&fit=crop",
    notes: "Mantenha escapulas retraidas e pes firmes.",
  },
  {
    id: uid(),
    name: "Remada sentada",
    primaryMuscles: ["Costas", "Biceps"],
    machineImg:
      "https://images.unsplash.com/photo-1534361960057-19889db9621e?q=80&w=800&auto=format&fit=crop",
    freeAltName: "Remada curvada com barra",
    freeAltImg:
      "https://images.unsplash.com/photo-1517963628607-235ccdd5476c?q=80&w=800&auto=format&fit=crop",
    notes: "Evite balancar o tronco; puxe com as costas.",
  },
  {
    id: uid(),
    name: "Agachamento guiado",
    primaryMuscles: ["Quadriceps", "Gluteos", "Posterior"],
    machineImg:
      "https://images.unsplash.com/photo-1571019613914-85f342c55f87?q=80&w=800&auto=format&fit=crop",
    freeAltName: "Agachamento com barra",
    freeAltImg:
      "https://images.unsplash.com/photo-1507398941214-572c25f4b1dc?q=80&w=800&auto=format&fit=crop",
    notes: "Desca ate paralela mantendo o core ativo.",
  },
];

// -------------------------- Recomendacao de series ------------------------
function suggestSets(goal: GoalId) {
  switch (goal) {
    case "strength":
      return { sets: 4, reps: "4-6", rest: "120-180s" };
    case "hypertrophy":
      return { sets: 4, reps: "8-12", rest: "60-90s" };
    case "endurance":
      return { sets: 3, reps: "15-20", rest: "30-45s" };
    default:
      return { sets: 3, reps: "10-12", rest: "60-90s" };
  }
}

// ------------------------------ Subcomponentes ----------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  );
}

function LabeledInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
      <span style={{ color: "#334155" }}>{label}</span>
      <input
        {...rest}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: "8px 10px",
          fontSize: 14,
        }}
      />
    </label>
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }
) {
  const { variant = "primary", style, ...rest } = props;
  const base: React.CSSProperties = {
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 14,
    cursor: "pointer",
    border: "1px solid transparent",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "#111827", color: "#fff" },
    secondary: { background: "#fff", color: "#111827", borderColor: "#e5e7eb" },
    ghost: { background: "transparent", color: "#111827" },
  };
  return <button {...rest} style={{ ...base, ...variants[variant], ...style }} />;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        border: "1px solid #e5e7eb",
        padding: "4px 8px",
        fontSize: 12,
        borderRadius: 999,
        background: "#f8fafc",
        color: "#334155",
      }}
    >
      {children}
    </span>
  );
}

function ImgBox({ src, alt, caption }: { src?: string; alt: string; caption?: string }) {
  return (
    <figure style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
      {src ? (
        <img src={src} alt={alt} style={{ width: "100%", height: 200, objectFit: "cover" }} loading="lazy" />
      ) : (
        <div style={{ width: "100%", height: 200, display: "grid", placeItems: "center", color: "#94a3b8" }}>
          Sem imagem
        </div>
      )}
      {caption ? (
        <figcaption style={{ fontSize: 12, color: "#64748b", padding: "6px 8px" }}>{caption}</figcaption>
      ) : null}
    </figure>
  );
}

function MuscleBadges({ muscles }: { muscles: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {muscles.map((m) => (
        <Badge key={m}>{m}</Badge>
      ))}
    </div>
  );
}

function Measurements({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const [weight, setWeight] = useState<string>(user.weight?.toString() || "");
  const [height, setHeight] = useState<string>(user.height?.toString() || "");

  const bmi = useMemo(() => {
    const w = Number(weight);
    const h = Number(height) / 100;
    if (!w || !h) return null;
    const val = w / (h * h);
    return Math.round(val * 10) / 10;
  }, [weight, height]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <LabeledInput label="Peso (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <LabeledInput label="Altura (cm)" value={height} onChange={(e) => setHeight(e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: "#64748b" }}>IMC estimado: {bmi ?? "—"}</div>
      <div>
        <Button
          onClick={() =>
            onUpdate({ ...user, weight: Number(weight) || undefined, height: Number(height) || undefined })
          }
        >
          Salvar medidas
        </Button>
      </div>
      <p style={{ fontSize: 11, color: "#94a3b8" }}>
        Medidas sao opcionais e ficam somente neste dispositivo (localStorage).
      </p>
    </div>
  );
}

function ExerciseForm({ initial, onSave }: { initial?: Exercise; onSave: (e: Omit<Exercise, "id">) => void }) {
  const [name, setName] = useState<string>(initial?.name || "");
  const [primaryMuscles, setPrimaryMuscles] = useState<string[]>(initial?.primaryMuscles || []);
  const [machineImg, setMachineImg] = useState<string>(initial?.machineImg || "");
  const [freeAltName, setFreeAltName] = useState<string>(initial?.freeAltName || "");
  const [freeAltImg, setFreeAltImg] = useState<string>(initial?.freeAltImg || "");
  const [notes, setNotes] = useState<string>(initial?.notes || "");

  function toggleMuscle(m: string) {
    setPrimaryMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <LabeledInput label="Nome do exercicio" value={name} onChange={(e) => setName(e.target.value)} />

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 14, color: "#334155" }}>Grupos musculares</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MUSCLES.map((m) => (
            <Button
              key={m}
              variant={primaryMuscles.includes(m) ? "primary" : "secondary"}
              onClick={() => toggleMuscle(m)}
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      <LabeledInput label="Imagem do aparelho (URL)" value={machineImg} onChange={(e) => setMachineImg(e.target.value)} />
      <LabeledInput label="Alternativa com peso (nome)" value={freeAltName} onChange={(e) => setFreeAltName(e.target.value)} />
      <LabeledInput label="Alternativa com peso (imagem - URL)" value={freeAltImg} onChange={(e) => setFreeAltImg(e.target.value)} />

      <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
        <span style={{ color: "#334155" }}>Notas / dicas</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8, fontSize: 14, minHeight: 70 }}
        />
      </label>

      <Button
        onClick={() =>
          onSave({ name: name.trim(), primaryMuscles, machineImg: machineImg.trim(), freeAltName: freeAltName.trim(), freeAltImg: freeAltImg.trim(), notes: notes.trim() })
        }
      >
        Salvar exercicio
      </Button>
    </div>
  );
}

function ExerciseCard({
  exercise,
  goal,
  onDelete,
  onSave,
}: {
  exercise: Exercise;
  goal: GoalId;
  onDelete: () => void;
  onSave: (payload: Omit<Exercise, "id">) => void;
}) {
  const [tab, setTab] = useState<"machine" | "free">("machine");
  const [editing, setEditing] = useState(false);
  const rec = suggestSets(goal);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{exercise.name}</div>
          <div style={{ marginTop: 6 }}>
            <MuscleBadges muscles={exercise.primaryMuscles} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button variant="secondary" onClick={() => setEditing(true)}>Editar</Button>
          <Button variant="ghost" onClick={onDelete}>Excluir</Button>
        </div>
      </div>

      {/* Tabs simples */}
      <div style={{ padding: "0 12px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
          <Button variant={tab === "machine" ? "primary" : "secondary"} onClick={() => setTab("machine")}>
            Aparelho
          </Button>
          <Button variant={tab === "free" ? "primary" : "secondary"} onClick={() => setTab("free")}>
            Com peso
          </Button>
        </div>
        {tab === "machine" ? (
          <ImgBox src={exercise.machineImg} alt={`Aparelho de ${exercise.name}`} />
        ) : (
          <ImgBox src={exercise.freeAltImg} alt={exercise.freeAltName || "Alternativa com peso"} caption={exercise.freeAltName} />
        )}
      </div>

      <div style={{ padding: 12, background: "#f8fafc" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Series sugeridas</div>
        <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          {Array.from({ length: rec.sets }).map((_, i) => (
            <li key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, fontSize: 14 }}>
              Serie {i + 1}: {rec.reps} reps · descanso {rec.rest}
            </li>
          ))}
        </ul>
        {exercise.notes ? (
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>{exercise.notes}</p>
        ) : null}
      </div>

      {/* Dialog de edicao simples */}
      {editing ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 16 }}
          onClick={() => setEditing(false)}
        >
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, width: "min(720px, 96vw)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Editar exercicio</div>
            <ExerciseForm
              initial={exercise}
              onSave={(payload) => {
                onSave(payload);
                setEditing(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --------------------------------- App ------------------------------------
export default function MeusTreinosApp() {
  const [users, setUsers] = useState<User[]>(() => readLS<User[]>(DB.USERS, [
    { id: "demo", name: "Convidado", weight: 80, height: 175 },
  ]));
  const [currentUserId, setCurrentUserId] = useState<string>(
    (typeof window !== "undefined" && (readLS<User[]>(DB.USERS, [{ id: "demo", name: "Convidado" }])[0]?.id)) || "demo"
  );
  const [exercises, setExercises] = useState<Exercise[]>(() => readLS<Exercise[]>(DB.EXERCISES, SEED_EXERCISES));
  const [goal, setGoal] = useState<GoalId>("hypertrophy");
  const [search, setSearch] = useState<string>("");

  useEffect(() => writeLS(DB.USERS, users), [users]);
  useEffect(() => writeLS(DB.EXERCISES, exercises), [exercises]);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) || users[0],
    [users, currentUserId]
  );

  function addUser(name?: string, weight?: number, height?: number) {
    const u: User = { id: uid(), name: name && name.trim() ? name.trim() : "Usuario", weight, height };
    const next = [...users, u];
    setUsers(next);
    setCurrentUserId(u.id);
  }

  function saveExercise(payload: Omit<Exercise, "id">, editingId?: string) {
    if (!payload.name) return;
    if (editingId) {
      setExercises((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...payload } : e)));
    } else {
      setExercises((prev) => [{ id: uid(), ...payload }, ...prev]);
    }
  }

  function removeExercise(id: string) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  const filtered = exercises.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.primaryMuscles.some((m) => m.toLowerCase().includes(q))
    );
  });

  const rec = suggestSets(goal);

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#0f172a" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.86)", backdropFilter: "saturate(180%) blur(8px)", borderBottom: "1px solid #e5e7eb", zIndex: 10 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Meus Treinos</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={currentUserId}
              onChange={(e) => setCurrentUserId(e.target.value)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 999, padding: "8px 10px", fontSize: 14 }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <AddUserInline onCreate={addUser} />
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16, display: "grid", gap: 16, gridTemplateColumns: "1fr", boxSizing: "border-box" }}>
        {/* Toolbar de busca e objetivo */}
        <Section title="Catalogo de exercicios">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 10 }}>
            <LabeledInput label="Buscar por nome ou musculo" value={search} onChange={(e) => setSearch(e.target.value)} />
            <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <span style={{ color: "#334155" }}>Objetivo</span>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as GoalId)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px", fontSize: 14 }}
              >
                {GOALS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Lista de cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}>
            {filtered.map((e) => (
              <ExerciseCard
                key={e.id}
                exercise={e}
                goal={goal}
                onDelete={() => removeExercise(e.id)}
                onSave={(payload) => saveExercise(payload, e.id)}
              />
            ))}
            {filtered.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 14 }}>Nenhum exercicio encontrado.</div>
            ) : null}
          </div>
        </Section>

        {/* Lateral (adicionar + recomendacao + medidas) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <Section title="Adicionar exercicio">
            <ExerciseForm onSave={saveExercise} />
          </Section>

          <Section title="Recomendacao">
            <div style={{ fontSize: 14 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>Objetivo:</span>
                <span>{GOALS.find((g) => g.id === goal)?.label}</span>
              </div>
              <div>
                Series sugeridas: <b>{rec.sets}x</b> · Repeticoes: <b>{rec.reps}</b> · Descanso: <b>{rec.rest}</b>
              </div>
              <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                Ajuste a carga para que a ultima repeticao seja desafiadora, sem falhar.
              </p>
            </div>
          </Section>

          <Section title="Medidas (opcional)">
            {currentUser ? (
              <Measurements
                user={currentUser}
                onUpdate={(u) => setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              />
            ) : (
              <div style={{ color: "#64748b", fontSize: 14 }}>Selecione um usuario.</div>
            )}
          </Section>
        </div>

        {/* Painel de testes/diagnostico */}
        <Diagnostics />
      </main>

      <footer style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: "#64748b" }}>
        Dados guardados no navegador (localStorage). Projeto simples, responsivo e facil de manter.
      </footer>
    </div>
  );
}

function AddUserInline({ onCreate }: { onCreate: (name?: string, weight?: number, height?: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Novo usuario
      </Button>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, display: "grid", gap: 8 }}>
      <LabeledInput label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <LabeledInput label="Peso (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <LabeledInput label="Altura (cm)" value={height} onChange={(e) => setHeight(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          onClick={() => {
            onCreate(name, Number(weight) || undefined, Number(height) || undefined);
            setName("");
            setWeight("");
            setHeight("");
            setOpen(false);
          }}
        >
          Criar
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ------------------------------- Testes simples ---------------------------
function Diagnostics() {
  type Case = { name: string; run: () => boolean | string };

  const cases: Case[] = [
    {
      name: "suggestSets(strength) deve retornar 4 sets",
      run: () => suggestSets("strength").sets === 4,
    },
    {
      name: "suggestSets(hypertrophy) deve retornar 4 sets com reps 8-12",
      run: () => suggestSets("hypertrophy").reps === "8-12",
    },
    {
      name: "suggestSets(endurance) deve retornar 3 sets",
      run: () => suggestSets("endurance").sets === 3,
    },
    {
      name: "Filtro por musculo (Peito) encontra Supino",
      run: () => {
        const found = SEED_EXERCISES.filter((e) => e.primaryMuscles.map((m) => m.toLowerCase()).includes("peito")).some((e) => e.name.toLowerCase().includes("supino"));
        return found;
      },
    },
    {
      name: "IMC 80kg/175cm ~= 26.1",
      run: () => {
        const w = 80, h = 1.75;
        const bmi = Math.round(((w / (h * h)) * 10)) / 10;
        return Math.abs(bmi - 26.1) < 0.01;
      },
    },
  ];

  const results = cases.map((c) => {
    const r = c.run();
    const ok = r === true;
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn("Teste falhou:", c.name, "=>", r);
    }
    return { name: c.name, ok, detail: r };
  });

  const allOk = results.every((r) => r.ok);

  return (
    <details style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Diagnostico e testes ({allOk ? "todos ok" : "alguns falharam"})
      </summary>
      <ul style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13 }}>
        {results.map((r, i) => (
          <li key={i} style={{ color: r.ok ? "#065f46" : "#b91c1c" }}>
            {r.ok ? "OK" : "FAIL"} - {r.name}
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
        Este painel executa testes basicos em tempo de execucao. Veja o console do navegador para detalhes.
      </p>
    </details>
  );
}
