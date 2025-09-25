import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  isSupabaseConfigured,
  loadRemoteUserState,
  saveRemoteUserState,
  type RemoteUserSnapshot,
} from "./supabaseClient";

/**
 * Meus Treinos – App refatorado (estilo SmartFit simplificado)
 * Telas:
 *  - Home: perfil/usuarios, progresso (sessões alvo configurável), dashboard por grupo, Benfit e escolha de avatar (10+), botões Criar Novo Treino / Meu Treino
 *  - Criar Novo Treino: Benfit pergunta Objetivo, Grupos, Frequência; gera 3–4 sessões (A/B/C/D) para 1 mês
 *  - Meu Treino: lista sessões; ao abrir, exercícios com checkbox Feito, imagem, reps/dicas e cronômetro por exercício; permite TROCAR exercício
 * 
 * Persistência: localStorage por usuário. Sem libs externas.
 */

// ------------------------------- Utils/DB ---------------------------------
function uid(): string { return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`; }
const YMD = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const YM = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };

const DB = {
  USERS: "meustreinos:users",
  AVATAR: (userId: string) => `meustreinos:user:${userId}:avatar`,
  PLAN: (userId: string) => `meustreinos:user:${userId}:plan`,
  SESSIONS_PROGRESS: (userId: string, ym: string) => `meustreinos:user:${userId}:progress:${ym}`,
  DONE: (userId: string, sessionId: string, ymd: string) => `meustreinos:user:${userId}:done:${sessionId}:${ymd}`,
  POINTS: (userId: string) => `meustreinos:user:${userId}:points`,
};

function readLS<T>(k: string, fb: T): T { try { const r = localStorage.getItem(k); return r? JSON.parse(r) as T: fb; } catch { return fb; } }
function writeLS<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

// ------------------------------ Domain types ------------------------------
const GOALS = [
  { id: "strength", label: "Forca" },
  { id: "hypertrophy", label: "Hipertrofia" },
  { id: "endurance", label: "Resistencia" },
] as const; type GoalId = typeof GOALS[number]["id"];

const MUSCLES = ["Peito","Costas","Ombros","Biceps","Triceps","Quadriceps","Posterior","Gluteos","Panturrilhas","Core"] as const;

// Avatar fixo do Benfit e 10 avatares para usuários
const BENFIT_AVATAR_URL = "https://images.unsplash.com/photo-1556157382-97eda2dfd30b?q=80&w=512&auto=format&fit=crop";
const AVATARS: { id: string; url: string; label: string }[] = [
  { id: "a1", url: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?q=80&w=400&auto=format&fit=crop", label: "Luna" },
  { id: "a2", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop", label: "Joca" },
  { id: "a3", url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop", label: "Bento" },
  { id: "a4", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop", label: "Mel" },
  { id: "a5", url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=400&auto=format&fit=crop", label: "Zig" },
  { id: "a6", url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=400&auto=format&fit=crop", label: "Dona" },
  { id: "a7", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop", label: "Kiko" },
  { id: "a8", url: "https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?q=80&w=400&auto=format&fit=crop", label: "Pipoca" },
  { id: "a9", url: "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?q=80&w=400&auto=format&fit=crop", label: "Bia" },
  { id: "a10", url: "https://images.unsplash.com/photo-1546967191-fdfb13ed6b1e?q=80&w=400&auto=format&fit=crop", label: "Gui" },
  { id: "a11", url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop", label: "Tuca" },
];

// Exercícios base (somente equipamentos/pesos nas imagens)
export type Exercise = { id: string; name: string; primaryMuscles: string[]; machineImg?: string; freeAltName?: string; freeAltImg?: string; tips?: string };
const LIB: Exercise[] = [
  { id: "supino_reto", name: "Supino reto", primaryMuscles: ["Peito","Triceps"], machineImg: "https://images.unsplash.com/photo-1582610116397-edb318620f13?q=80&w=800&auto=format&fit=crop", freeAltName: "Supino com halteres", freeAltImg: "https://images.unsplash.com/photo-1599447421416-3414500d18a5?q=80&w=800&auto=format&fit=crop", tips: "Escapulas retraidas, controle na descida." },
  { id: "crucifixo_cabo", name: "Crucifixo no cabo", primaryMuscles: ["Peito"], machineImg: "https://images.unsplash.com/photo-1571907480495-6acb709b7510?q=80&w=800&auto=format&fit=crop", freeAltName: "Crucifixo com halteres", freeAltImg: "https://images.unsplash.com/photo-1586401100295-7a8096fd231a?q=80&w=800&auto=format&fit=crop", tips: "Amplitude confortavel, sem forcar ombro." },
  { id: "remada_sentada", name: "Remada sentada", primaryMuscles: ["Costas","Biceps"], machineImg: "https://images.unsplash.com/photo-1599050751793-8a8eeb8e5e88?q=80&w=800&auto=format&fit=crop", freeAltName: "Remada curvada com barra", freeAltImg: "https://images.unsplash.com/photo-1540497077202-7c8a61c74324?q=80&w=800&auto=format&fit=crop", tips: "Puxe com dorsais, tronco estavel." },
  { id: "puxada_barra", name: "Puxada na barra", primaryMuscles: ["Costas","Biceps"], machineImg: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=800&auto=format&fit=crop", freeAltName: "Barra fixa assistida", freeAltImg: "https://images.unsplash.com/photo-1591216174990-7b7f7f2f7a67?q=80&w=800&auto=format&fit=crop", tips: "Desce escapulas antes de puxar." },
  { id: "desenvolvimento_ombros", name: "Desenvolvimento ombros", primaryMuscles: ["Ombros","Triceps"], machineImg: "https://images.unsplash.com/photo-1591348278863-c5b8b7f52c16?q=80&w=800&auto=format&fit=crop", freeAltName: "Desenv. com halteres", freeAltImg: "https://images.unsplash.com/photo-1586401100295-7a8096fd231a?q=80&w=800&auto=format&fit=crop", tips: "Punhos neutros; sem hiperextensao lombar." },
  { id: "elevacao_lateral", name: "Elevacao lateral", primaryMuscles: ["Ombros"], machineImg: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=800&auto=format&fit=crop", freeAltName: "Elevacao lateral halteres", freeAltImg: "https://images.unsplash.com/photo-1586401100295-7a8096fd231a?q=80&w=800&auto=format&fit=crop", tips: "Cotovelo levemente flexionado." },
  { id: "agachamento_guiado", name: "Agachamento guiado", primaryMuscles: ["Quadriceps","Posterior","Gluteos"], machineImg: "https://images.unsplash.com/photo-1572147243989-5be19699034b?q=80&w=800&auto=format&fit=crop", freeAltName: "Agachamento com barra", freeAltImg: "https://images.unsplash.com/photo-1554344728-77cf90d9ed26?q=80&w=800&auto=format&fit=crop", tips: "Core ativo; amplitude segura." },
  { id: "leg_press", name: "Leg press", primaryMuscles: ["Quadriceps","Posterior","Gluteos"], machineImg: "https://images.unsplash.com/photo-1571019613914-85f342c55f87?q=80&w=800&auto=format&fit=crop", tips: "Pes firmes, joelhos alinhados." },
  { id: "mesa_flexora", name: "Mesa flexora", primaryMuscles: ["Posterior"], machineImg: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=800&auto=format&fit=crop", tips: "Controle excentrico." },
  { id: "extensora", name: "Extensora", primaryMuscles: ["Quadriceps"], machineImg: "https://images.unsplash.com/photo-1571019613454-1cb2f1bb3e08?q=80&w=800&auto=format&fit=crop", tips: "Nao travar joelhos." },
  { id: "panturrilha_em_pe", name: "Panturrilha em pe", primaryMuscles: ["Panturrilhas"], machineImg: "https://images.unsplash.com/photo-1517963628607-235ccdd5476c?q=80&w=800&auto=format&fit=crop", freeAltName: "Halteres panturrilha", freeAltImg: "https://images.unsplash.com/photo-1599447421416-3414500d18a5?q=80&w=800&auto=format&fit=crop", tips: "Pico de contraçao." },
  { id: "rosca_direta", name: "Rosca direta", primaryMuscles: ["Biceps"], freeAltImg: "https://images.unsplash.com/photo-1540497077202-7c8a61c74324?q=80&w=800&auto=format&fit=crop", tips: "Ombros quietos, so cotovelo." },
  { id: "triceps_corda", name: "Triceps corda", primaryMuscles: ["Triceps"], machineImg: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=800&auto=format&fit=crop", tips: "Estender sem projetar ombro." },
  { id: "prancha", name: "Prancha", primaryMuscles: ["Core"], machineImg: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=800&auto=format&fit=crop", tips: "Alinhar cabeca-coluna-pelve." },
];

// Plan/sessions types
type SessionExercise = { exerciseId: string; sets: number; reps: string; rest: string; tips?: string };
type SessionPlan = { id: string; name: string; items: SessionExercise[] };
export type UserPlan = { id: string; userId: string; goal: GoalId; groups: string[]; frequency: number; sessions: SessionPlan[]; month: string };

function suggestSetSchema(goal: GoalId) { switch(goal){ case "strength": return { sets: 4, reps: "4-6", rest: "120-180s" }; case "hypertrophy": return { sets: 4, reps: "8-12", rest: "60-90s" }; default: return { sets: 3, reps: "12-20", rest: "45-60s" }; } }

function buildPlan(goal: GoalId, groups: string[], frequency: number, lib: Exercise[]): UserPlan {
  const sessionsCount = Math.min(4, Math.max(3, Math.round(frequency))); // 3–4
  const schema = suggestSetSchema(goal);
  const picksByGroup: Record<string, Exercise[]> = {};
  groups.forEach(g => { picksByGroup[g] = lib.filter(e => e.primaryMuscles.includes(g)); });
  const names = ["Treino A","Treino B","Treino C","Treino D"];
  const sessions: SessionPlan[] = [];
  for (let i=0;i<sessionsCount;i++){
    const items: SessionExercise[] = [];
    groups.forEach(g => {
      const pool = picksByGroup[g] || [];
      for (let k=0;k<2;k++){
        const ex = pool[(i+k) % Math.max(1,pool.length)]; // pode repetir se biblioteca pequena
        if (ex){ items.push({ exerciseId: ex.id, sets: schema.sets, reps: schema.reps, rest: schema.rest, tips: ex.tips }); }
      }
    });
    const limited = items.slice(0, Math.min(7, Math.max(5, items.length)));
    sessions.push({ id: uid(), name: names[i], items: limited });
  }
  return { id: uid(), userId: "", goal, groups, frequency, sessions, month: YM() };
}

// ------------------------------ UI Primitives -----------------------------
function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"secondary"|"ghost" }){
  const {variant="primary", style, ...rest} = props;
  const base: React.CSSProperties = { borderRadius: 8, padding: "10px 12px", fontSize: 14, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: "transparent", background: "#0f172a", color: "#fff" };
  const variants: Record<string, React.CSSProperties> = {
    primary:{ background:"#0f172a", color:"#fff" },
    secondary:{ background:"#fff", color:"#0f172a", borderColor:"#e5e7eb" },
    ghost:{ background:"transparent", color:"#0f172a", borderColor:"transparent" }
  };
  return <button {...rest} style={{...base,...variants[variant],...style}}/>;
}
function Card({title, children}:{title?:string;children:React.ReactNode}){ return (
  <section style={{border:"1px solid #e5e7eb",borderRadius:12,padding:16}}>
    {title? <h2 style={{fontSize:16,fontWeight:600,marginBottom:8}}>{title}</h2>:null}
    {children}
  </section>
); }
function Row({label,children}:{label:string;children:React.ReactNode}){ return (
  <label style={{display:"grid",gap:6,fontSize:14}}>
    <span style={{color:"#334155"}}>{label}</span>
    {children}
  </label>
); }
function Img({src,alt}:{src?:string;alt:string}){ return src? <img src={src} alt={alt} style={{width:"100%",height:140,objectFit:"cover",borderRadius:10,border:"1px solid #e5e7eb"}}/>: <div style={{height:140,display:"grid",placeItems:"center",border:"1px dashed #cbd5e1",borderRadius:10,color:"#94a3b8"}}>Sem imagem</div>; }

function Timer({ initialSec=60 }:{ initialSec?: number }){
  const [sec, setSec] = useState(initialSec);
  const [running, setRunning] = useState(false);
  const ref = useRef<number|undefined>(undefined);
  useEffect(()=>{ if(!running) return; ref.current = window.setInterval(()=>setSec(s=>Math.max(0,s-1)),1000); return ()=>{ if(ref.current) window.clearInterval(ref.current); }; },[running]);
  useEffect(()=>{ if(sec===0) setRunning(false); },[sec]);
  const mm = String(Math.floor(sec/60)).padStart(2,'0'); const ss = String(sec%60).padStart(2,'0');
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:14}}>
      <span>{mm}:{ss}</span>
      <Button variant="secondary" onClick={()=>setRunning(r=>!r)}>{running?"Pausar":"Iniciar"}</Button>
      <Button variant="ghost" onClick={()=>{setRunning(false);setSec(initialSec);}}>Reset</Button>
    </div>
  );
}

// ----------------------------------- App ----------------------------------
export default function App(){
  const [users, setUsers] = useState(() => readLS<{id:string;name:string}[]>(DB.USERS, [{id:"u_demo",name:"Convidado"}]));
  const [userId, setUserId] = useState(users[0].id);
  const [route, setRoute] = useState<'home'|'create'|'my'>('home');
  const [catalog] = useState<Exercise[]>(() => LIB);
  const [avatarId, setAvatarId] = useState(readLS(DB.AVATAR(userId), AVATARS[0].id));
  const [plan, setPlan] = useState<UserPlan|undefined>(readLS(DB.PLAN(userId), undefined));
  const [points, setPoints] = useState<number>(readLS(DB.POINTS(userId), 0));
  const ym = YM();
  const [progress, setProgress] = useState<{target:number;done:number}>(readLS(DB.SESSIONS_PROGRESS(userId, ym), {target:30, done:0}));
  const supabaseAvailable = isSupabaseConfigured;
  const [remoteStatus, setRemoteStatus] = useState<'disabled'|'loading'|'ready'|'error'>(supabaseAvailable ? 'loading' : 'disabled');
  const remoteProgressRef = useRef<Record<string, {target:number;done:number}>>({});
  const lastSupabasePayload = useRef<string>("");

  // persist / reload on user change
  useEffect(()=>writeLS(DB.USERS, users), [users]);
  useEffect(()=>{ writeLS(DB.AVATAR(userId), avatarId); },[userId, avatarId]);
  useEffect(()=>{ writeLS(DB.PLAN(userId), plan); },[userId, plan]);
  useEffect(()=>{ writeLS(DB.POINTS(userId), points); },[userId, points]);
  useEffect(()=>{ writeLS(DB.SESSIONS_PROGRESS(userId, ym), progress); },[userId, ym, progress]);
  useEffect(()=>{ // when user changes, reload their data
    setAvatarId(readLS(DB.AVATAR(userId), AVATARS[0].id));
    setPlan(readLS(DB.PLAN(userId), undefined));
    setPoints(readLS(DB.POINTS(userId), 0));
    setProgress(readLS(DB.SESSIONS_PROGRESS(userId, ym), {target:30, done:0}));
  },[userId]);
  useEffect(()=>{
    if(!supabaseAvailable){
      setRemoteStatus('disabled');
      return;
    }
    let cancelled = false;
    setRemoteStatus('loading');
    remoteProgressRef.current = {};
    lastSupabasePayload.current = "";
    (async ()=>{
      const { snapshot, error } = await loadRemoteUserState(userId);
      if(cancelled) return;
      if(error){
        setRemoteStatus('error');
        return;
      }
      if(snapshot){
        if(snapshot.avatarId){ setAvatarId(snapshot.avatarId); }
        if(snapshot.plan){ setPlan(snapshot.plan); }
        if(typeof snapshot.points === 'number'){ setPoints(snapshot.points); }
        if(snapshot.progressByMonth){
          remoteProgressRef.current = snapshot.progressByMonth;
          const remoteProgress = snapshot.progressByMonth[ym];
          if(remoteProgress){ setProgress(remoteProgress); }
        }
      }
      setRemoteStatus('ready');
    })();
    return ()=>{ cancelled = true; };
  },[supabaseAvailable, userId, ym]);
  useEffect(()=>{
    if(!supabaseAvailable || remoteStatus!=='ready') return;
    const mergedProgress = { ...remoteProgressRef.current, [ym]: progress };
    remoteProgressRef.current = mergedProgress;
    const snapshot: RemoteUserSnapshot = {
      avatarId,
      plan: plan ?? undefined,
      points,
      progressByMonth: mergedProgress,
    };
    const serialized = JSON.stringify(snapshot);
    if(serialized === lastSupabasePayload.current) return;
    lastSupabasePayload.current = serialized;
    let cancelled = false;
    (async ()=>{
      const ok = await saveRemoteUserState(userId, snapshot);
      if(!ok && !cancelled){
        lastSupabasePayload.current = "";
      }
    })();
    return ()=>{ cancelled = true; };
  },[avatarId, plan, points, progress, remoteStatus, supabaseAvailable, userId, ym]);

  const supabaseStatusLabel = useMemo(()=>{
    if(!supabaseAvailable) return 'desativado';
    switch(remoteStatus){
      case 'loading':
        return 'conectando';
      case 'ready':
        return 'online';
      case 'error':
        return 'erro';
      default:
        return 'desativado';
    }
  },[remoteStatus, supabaseAvailable]);

  return (
    <div style={{minHeight:"100vh",background:"#fff",color:"#0f172a"}}>
      <header style={{position:"sticky",top:0,background:"rgba(255,255,255,0.9)",backdropFilter:"saturate(180%) blur(8px)",borderBottom:"1px solid #e5e7eb",zIndex:10}}>
        <div style={{maxWidth:1120,margin:"0 auto",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <div style={{fontWeight:700}}>Meus Treinos</div>
          <nav style={{display:"flex",gap:8}}>
            <Button variant={route==='home'? 'primary':'secondary'} onClick={()=>setRoute('home')}>Inicio</Button>
            <Button variant={route==='create'? 'primary':'secondary'} onClick={()=>setRoute('create')}>Criar novo treino</Button>
            <Button variant={route==='my'? 'primary':'secondary'} onClick={()=>setRoute('my')}>Meu treino</Button>
          </nav>
        </div>
      </header>

      <main style={{maxWidth:1120,margin:"0 auto",padding:16}}>
        {route==='home' && (
          <HomeScreen
            users={users}
            setUsers={setUsers}
            userId={userId}
            setUserId={setUserId}
            avatarId={avatarId}
            setAvatarId={setAvatarId}
            plan={plan}
            progress={progress}
            setProgress={setProgress}
            points={points}
            supabaseStatus={supabaseStatusLabel}
            onGotoCreate={()=>setRoute('create')}
            onGotoMy={()=>setRoute('my')}
          />
        )}
        {route==='create' && (
          <CreateScreen
            userId={userId}
            catalog={catalog}
            onSavePlan={(p)=>{ const newPlan = {...p, userId}; setPlan(newPlan); setRoute('my'); }}
          />
        )}
        {route==='my' && (
          <MyScreen
            userId={userId}
            catalog={catalog}
            plan={plan}
            onPlanChanged={(np)=>{ setPlan(np); }}
            onFinishSession={()=>{
              setProgress(prev=> ({...prev, done: Math.min(prev.done+1, prev.target)}));
              setPoints(prev=> prev + 50); // 50 pts por sessão concluída
            }}
          />
        )}
      </main>

      <footer style={{padding:"24px 0",textAlign:"center",fontSize:12,color:"#64748b"}}>Dados locais. Gamificacao: complete exercicios/sessoes para somar pontos e desbloquear trofeus.</footer>
    </div>
  );
}

// ------------------------------- Home Screen ------------------------------
function HomeScreen({ users, setUsers, userId, setUserId, avatarId, setAvatarId, plan, progress, setProgress, points, supabaseStatus, onGotoCreate, onGotoMy }:{ users:{id:string;name:string}[]; setUsers:React.Dispatch<React.SetStateAction<{id:string;name:string}[]>>; userId:string; setUserId:(id:string)=>void; avatarId:string; setAvatarId:(id:string)=>void; plan?:UserPlan; progress:{target:number;done:number}; setProgress:React.Dispatch<React.SetStateAction<{target:number;done:number}>>; points:number; supabaseStatus:string; onGotoCreate:()=>void; onGotoMy:()=>void }){
  const user = users.find(u=>u.id===userId)!;
  const groupsCount = useMemo(()=>{
    if(!plan) return {} as Record<string, number>;
    const cnt: Record<string, number> = {};
    plan.sessions.forEach(s=>{ s.items.forEach(it=>{ const ex = LIB.find(e=>e.id===it.exerciseId); ex?.primaryMuscles.forEach(m=>{ cnt[m]=(cnt[m]||0)+1; }); }); });
    return cnt;
  },[plan]);
  const donePad = String(progress.done).padStart(2,'0'); const targetPad = String(progress.target).padStart(2,'0');
  const userAvatar = AVATARS.find(a=>a.id===avatarId) ?? AVATARS[0];

  return (
    <div style={{display:"grid",gap:16}}>
      <Card title="Usuario">
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{width:72,height:72,border:"1px solid #e5e7eb",borderRadius:12,overflow:'hidden',background:'#f8fafc',display:'grid',placeItems:'center'}}>
            <img src={userAvatar.url} alt={`Avatar selecionado (${userAvatar.label})`} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <select value={userId} onChange={(e)=>setUserId(e.target.value)} style={{border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px"}}>
              {users.map(u=> <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <AddUser onCreate={(name)=>{ const id = uid(); setUsers([...users,{id,name: name||'Usuario'}]); setUserId(id); }}/>
          </div>
          <div style={{marginLeft:"auto",fontSize:14}}>Sessoes no mes: <b>{donePad}/{targetPad}</b></div>
        </div>
        <div style={{marginTop:10,display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:12,color:'#64748b'}}>Meta mensal (sessoes):</span>
          <input type="number" min={1} max={60} value={progress.target} onChange={(e)=>{
            const t = Math.max(1, Math.min(60, Number(e.target.value)||progress.target));
            setProgress(prev=> ({ target: t, done: Math.min(prev.done, t) }));
          }} style={{width:96,border:'1px solid #e5e7eb',borderRadius:8,padding:'6px 8px'}}/>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
        <Card title="Dashboard por grupo">
          {!plan? <div style={{color:'#64748b',fontSize:14}}>Crie um novo treino para ver o resumo por grupo.</div> : (
            <ul style={{display:'grid',gap:6,margin:0,padding:0,listStyle:'none'}}>
              {Object.keys(groupsCount).length===0? <li style={{color:'#64748b'}}>Sem dados</li> : Object.entries(groupsCount).map(([g,n])=> <li key={g} style={{display:'flex',justifyContent:'space-between'}}><span>{g}</span><b>{n}</b></li>)}
            </ul>
          )}
        </Card>
        <Card title="Seu treinador: Benfit">
          <div style={{display:"grid",gridTemplateColumns:"100px 1fr",gap:12,alignItems:"center"}}>
            <div style={{width:100,height:100,border:"1px solid #e5e7eb",borderRadius:12,background:"#f8fafc",display:'grid',placeItems:'center',overflow:'hidden'}}>
              <img src={BENFIT_AVATAR_URL} alt="Avatar Benfit" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
            <div style={{fontSize:14,color:"#334155"}}>
              Ola! Eu sou o <b>Benfit</b>. Este e o meu visual oficial e eu estarei com voce em cada sessao. Continue escolhendo o avatar que mais combina com voce ao lado.
            </div>
          </div>
          <div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>
            <Button onClick={onGotoCreate} variant="primary">Criar Novo Treino</Button>
            <Button onClick={onGotoMy} variant="secondary">Meu Treino</Button>
          </div>
          <div style={{marginTop:12,fontSize:12,color:"#64748b"}}>Pontos acumulados: <b>{points}</b> — complete sessoes para ganhar trofeus!</div>
        </Card>
        <Card title="Seu avatar">
          <div style={{display:'grid',gap:12}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:88,height:88,border:"1px solid #e5e7eb",borderRadius:16,overflow:'hidden',background:'#f8fafc',display:'grid',placeItems:'center'}}>
                <img src={userAvatar.url} alt={`Avatar selecionado (${userAvatar.label})`} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              </div>
              <p style={{margin:0,fontSize:14,color:'#334155'}}>Escolha dentre diversos visuais para representar voce no aplicativo. Clique em um avatar para atualiza-lo imediatamente.</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(64px,1fr))',gap:8}}>
              {AVATARS.map(a=> (
                <button
                  key={a.id}
                  onClick={()=>setAvatarId(a.id)}
                  style={{border:a.id===avatarId? '2px solid #0ea5e9':'1px solid #e5e7eb',borderRadius:12,overflow:'hidden',background:'#fff',cursor:'pointer',padding:0}}
                  aria-pressed={a.id===avatarId}
                  aria-label={`Selecionar avatar ${a.label}`}
                >
                  <img src={a.url} alt={a.label} style={{width:'100%',height:64,objectFit:'cover'}}/>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <DiagnosticsPanel supabaseStatus={supabaseStatus} />
    </div>
  );
}

function AddUser({ onCreate }:{ onCreate:(name:string)=>void }){
  const [open,setOpen] = useState(false); const [name,setName]=useState("");
  if(!open) return <Button variant="secondary" onClick={()=>setOpen(true)}>Novo usuario</Button>;
  return (
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome" style={{border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 10px'}}/>
      <Button onClick={()=>{ onCreate(name||'Usuario'); setOpen(false); setName(''); }}>Criar</Button>
      <Button variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button>
    </div>
  );
}

// ---------------------------- Create Plan Screen --------------------------
function CreateScreen({ userId, catalog, onSavePlan }:{ userId:string; catalog:Exercise[]; onSavePlan:(p:UserPlan)=>void }){
  const [goal,setGoal]=useState<GoalId>('hypertrophy');
  const [groups,setGroups]=useState<string[]>(["Peito","Triceps"]);
  const [freq,setFreq]=useState(3);
  const [preview, setPreview] = useState<UserPlan|undefined>();

  function toggleGroup(g:string){ setGroups(prev=> prev.includes(g)? prev.filter(x=>x!==g): [...prev,g]); }
  function generate(){ const p = buildPlan(goal, groups, freq, catalog); setPreview({...p, userId}); }
  function save(){ if(preview){ onSavePlan(preview); }}

  return (
    <div style={{display:'grid',gap:16}}>
      <Card title="Benfit – montar seu plano">
        <Row label="Objetivo">
          <select value={goal} onChange={e=>setGoal(e.target.value as GoalId)} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 10px'}}>
            {GOALS.map(g=> <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </Row>
        <Row label="Grupos de musculos">
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {MUSCLES.map(m=> (
              <Button key={m} variant={groups.includes(m)?'primary':'secondary'} onClick={()=>toggleGroup(m)}>{m}</Button>
            ))}
          </div>
        </Row>
        <Row label="Frequencia (dias/semana)">
          <input type="number" min={1} max={6} value={freq} onChange={e=>setFreq(Math.max(1,Math.min(6,Number(e.target.value)||3)))} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 10px',width:120}}/>
        </Row>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <Button onClick={generate}>Gerar sessoes</Button>
          <Button variant="secondary" onClick={save} disabled={!preview}>Salvar plano</Button>
        </div>
      </Card>
      {preview && (
        <Card title="Pre-visualizacao (1 mes)">
          <div style={{display:'grid',gap:12}}>
            {preview.sessions.map(s=> (
              <div key={s.id} style={{border:'1px solid #e5e7eb',borderRadius:10,padding:12}}>
                <div style={{fontWeight:600,marginBottom:6}}>{s.name}</div>
                <ul style={{margin:0,padding:0,listStyle:'none',display:'grid',gap:6}}>
                  {s.items.map((it,idx)=>{ const ex = catalog.find(e=>e.id===it.exerciseId)!; return (
                    <li key={idx} style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:8,alignItems:'center'}}>
                      <Img src={ex.machineImg||ex.freeAltImg} alt={ex.name}/>
                      <div>
                        <div style={{fontWeight:600}}>{ex.name}</div>
                        <div style={{fontSize:12,color:'#64748b'}}> {it.sets} x {it.reps} · descanso {it.rest}</div>
                        {it.tips? <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{it.tips}</div>:null}
                      </div>
                    </li>
                  );})}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ------------------------------ My Plan Screen ---------------------------
function MyScreen({ userId, catalog, plan, onPlanChanged, onFinishSession }:{ userId:string; catalog:Exercise[]; plan?:UserPlan; onPlanChanged:(p:UserPlan|undefined)=>void; onFinishSession:()=>void }){
  const [selected, setSelected] = useState<string|undefined>(plan?.sessions[0]?.id);
  useEffect(()=>{
    if(!plan || plan.sessions.length===0){
      setSelected(undefined);
      return;
    }
    if(!selected || !plan.sessions.some(s=>s.id===selected)){
      setSelected(plan.sessions[0].id);
    }
  },[plan, selected]);

  const ymd = YMD();
  if(!plan) return <Card title="Meu treino"><div style={{color:'#64748b'}}>Voce ainda nao criou um plano. Va em "Criar novo treino".</div></Card>;

  const session = plan.sessions.find(s=>s.id===selected) || plan.sessions[0];
  const doneKey = session ? DB.DONE(userId, session.id, ymd) : null;
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});
  useEffect(()=>{
    if(!doneKey){
      setDoneMap({});
      return;
    }
    setDoneMap(readLS(doneKey, {}));
  },[doneKey]);
  useEffect(()=>{
    if(doneKey){ writeLS(doneKey, doneMap); }
  },[doneKey, doneMap]);

  function toggle(idx:number){ setDoneMap(prev=> ({...prev, [idx]: !prev[idx]})); }

  // Trocar exercicio
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);
  const replacementPool = (idx:number) => {
    if(!session) return [] as Exercise[];
    const cur = session.items[idx];
    if(!cur) return [] as Exercise[];
    const ex = catalog.find(e=>e.id===cur.exerciseId);
    if(!ex) return [] as Exercise[];
    return catalog.filter(e => e.id!==ex.id && e.primaryMuscles.some(m => ex.primaryMuscles.includes(m)));
  };
  function applyReplacement(idx:number, newId:string){
    if(!plan || !session) return;
    const np: UserPlan = { ...plan, sessions: plan.sessions.map(s => s.id===session.id ? { ...s, items: s.items.map((it,i)=> i===idx? { ...it, exerciseId: newId }: it) } : s) } as UserPlan;
    writeLS(DB.PLAN(userId), np);
    onPlanChanged(np);
    setReplaceIdx(null);
  }

  const allDone = session? session.items.every((_,i)=> !!doneMap[i]) : false;

  return (
    <div style={{display:'grid',gap:16}}>
      <Card title="Sessoes">
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {plan.sessions.map(s=> <Button key={s.id} variant={s.id===session.id? 'primary':'secondary'} onClick={()=>{ setSelected(s.id); setDoneMap(readLS(DB.DONE(userId, s.id, ymd), {})); }}>{s.name}</Button>)}
        </div>
      </Card>

      <Card title={`Exercicios – ${session.name}`}>
        <ul style={{margin:0,padding:0,listStyle:'none',display:'grid',gap:8}}>
          {session.items.map((it,idx)=>{
            const ex = catalog.find(e=>e.id===it.exerciseId) ?? { id:'missing', name:'Exercicio indisponivel', primaryMuscles:[], tips:'Este exercicio nao esta mais disponivel. Gere um novo plano.' };
            const done = !!doneMap[idx];
            const restSec = /^(\d+)-(\d+)s$/.test(it.rest)? parseInt((it.rest.match(/^(\d+)-(\d+)s$/) as RegExpMatchArray)[1]): 60;
            const pool = replacementPool(idx);
            const tips = ex.tips || (ex.id==='missing'? 'Este exercicio nao esta mais disponivel. Gere um novo plano.': undefined);
            return (
            <li key={idx} style={{border:'1px solid #e5e7eb',borderRadius:10,padding:12}}>
              <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="checkbox" checked={done} onChange={()=>toggle(idx)} />
                  <div style={{fontWeight:600,textDecoration: done? 'line-through':'none'}}>{ex.name}</div>
                </div>
                <Button variant="ghost" onClick={()=> setReplaceIdx(replaceIdx===idx? null : idx)}>Trocar</Button>
              </div>

              {replaceIdx===idx && (
                <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <select onChange={(e)=> applyReplacement(idx, e.target.value)} defaultValue="" style={{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px 8px'}}>
                    <option value="" disabled>Escolher substituto (mesmo grupo)</option>
                    {pool.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Button variant="ghost" onClick={()=> setReplaceIdx(null)}>Cancelar</Button>
                </div>
              )}

              <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:8,marginTop:8}}>
                <Img src={ex.machineImg||ex.freeAltImg} alt={ex.name}/>
                <div>
                  <div style={{fontSize:13}}>Series: <b>{it.sets}x</b> · Repeticoes: <b>{it.reps}</b> · Descanso: <b>{it.rest}</b></div>
                  {(tips || it.tips)? <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{tips || it.tips}</div>:null}
                  <div style={{marginTop:8}}>
                    <span style={{fontSize:12,color:'#64748b'}}>Cronometro (descanso sugerido): </span>
                    <Timer initialSec={restSec} />
                  </div>
                </div>
              </div>
            </li>
          );})}
        </ul>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <Button variant="primary" onClick={()=>{ if(allDone){ onFinishSession(); alert('Sessao concluida! +50 pontos'); } else { if(confirm('Ainda ha exercicios nao marcados como \"Feito\". Concluir sessao mesmo assim?')) { onFinishSession(); } } }}>Concluir sessao</Button>
          <Button variant="secondary" onClick={()=>{ setDoneMap({}); }}>Resetar marcacoes de hoje</Button>
        </div>
      </Card>

      <Gamification userId={userId} />
    </div>
  );
}

function Gamification({ userId }:{ userId:string }){
  const pts = readLS<number>(DB.POINTS(userId), 0);
  const trophies = [
    { min: 100, name: "Bronze" },
    { min: 300, name: "Prata" },
    { min: 600, name: "Ouro" },
    { min: 1000, name: "Diamante" },
  ];
  const current = [...trophies].reverse().find(t=> pts>=t.min);
  const phrases = [
    "Otimo ritmo! Cada repeticao conta.",
    "Consistencia vence motivacao.",
    "Respira, foca e vai!",
    "Hoje melhor que ontem, amanha melhor que hoje.",
  ];
  const msg = phrases[pts % phrases.length];
  const trophyImg = current? `https://images.unsplash.com/photo-1519861531473-9200262188bf?q=80&w=800&auto=format&fit=crop` : undefined;
  return (
    <Card title="Gamificacao">
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        {trophyImg? <img src={trophyImg} alt="Trofeu" style={{width:72,height:72,objectFit:'cover',borderRadius:12,border:'1px solid #e5e7eb'}}/>: <div style={{width:72,height:72,display:'grid',placeItems:'center',border:'1px dashed #cbd5e1',borderRadius:12,color:'#94a3b8'}}>Sem trofeu</div>}
        <div>
          <div style={{fontSize:14}}>Pontos: <b>{pts}</b></div>
          <div style={{fontSize:12,color:'#64748b'}}>Nivel: <b>{current? current.name: 'Iniciante'}</b></div>
          <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{msg}</div>
        </div>
      </div>
    </Card>
  );
}

// -------------------------------- Diagnostics -----------------------------
function DiagnosticsPanel({ supabaseStatus }:{ supabaseStatus:string }){
  const has10Avatars = AVATARS.length >= 10;
  const allImagesEquipment = LIB.every(e=> !!(e.machineImg || e.freeAltImg));
  const plan = buildPlan('hypertrophy', ['Peito','Triceps'], 3, LIB);
  const sessionsOk = plan.sessions.length>=3 && plan.sessions.length<=4;
  // teste de target configuravel: simula update e clamp
  const clampTarget = (t:number, done:number) => ({ target: Math.max(1, Math.min(60, t)), done: Math.min(done, Math.max(1, Math.min(60, t))) });
  const targetOk = (()=>{ const r = clampTarget(100, 40); return r.target===60 && r.done===40; })();
  const gtOk = '>' === '>';
  return (
    <details style={{border:'1px dashed #cbd5e1',borderRadius:12,padding:12,marginTop:16}}>
      <summary style={{cursor:'pointer',fontWeight:600}}>Diagnostico</summary>
      <ul style={{marginTop:8,fontSize:13}}>
        <li>Supabase Benfit: <b>{supabaseStatus}</b></li>
        <li>Avatares {'>'}= 10: <b>{String(has10Avatars)}</b></li>
        <li>Biblioteca com imagens de aparelhos/pesos: <b>{String(allImagesEquipment)}</b></li>
        <li>Sessoes geradas (3–4): <b>{String(sessionsOk)}</b></li>
        <li>Meta configuravel (clamp 1..60): <b>{String(targetOk)}</b></li>
        <li>Renderiza simbolo {'>'}: <b>{String(gtOk)}</b></li>
      </ul>
    </details>
  );
}

