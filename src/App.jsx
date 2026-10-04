import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'

// Clé "anon" : publique par conception. Les données sont protégées par les règles RLS de la base.
const sb = createClient(
  'https://fidpwwiqfusjantijffe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZHB3d2lxZnVzamFudGlqZmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5OTE0NDIsImV4cCI6MjEwNjU2NzQ0Mn0.jRFDHSpHXRpS9b8ldfXMch0yR18JbN7pduLQJzSIK5Y'
)

const SYMS = ['Vertiges', 'Fatigue', 'Maux de tête', 'Nausées', 'Douleurs', 'Anxiété']
const R = (k, l) => ({ k, l, t: 'r' })
const forms = (s) => {
  const o = ['Fatigue', 'Stress', 'Vertiges'].filter((x) => x.toLowerCase() !== s.toLowerCase())
  return {
    symptom: { t: 'Symptôme : ' + s, sub: 'Je le ressens maintenant', ic: '🌡️', main: 1, f: [R('i', 'Intensité')] },
    sleep: { t: 'Sommeil', sub: 'Au réveil', ic: '🌙', f: [{ k: 'h', l: 'Durée de sommeil', t: 'n', u: 'h', step: 0.25, min: 0, max: 24, def: 7 }, R('q', 'Qualité du sommeil'), R('fa', 'Fatigue au réveil')] },
    feel: { t: 'Autre ressenti', sub: o.join(' · '), ic: '🫧', f: [{ k: 'r', l: 'Ressenti', t: 's', o }, R('i', 'Intensité')] },
    coffee: { t: 'Café', sub: "J'ai bu un café", ic: '☕', f: [{ k: 'n', l: 'Nombre de tasses', t: 'n', step: 1, min: 1, max: 20, def: 1 }] },
    meal: { t: 'Repas', sub: "J'ai mangé", ic: '🍽️', f: [{ k: 'r', l: 'Repas', t: 's', o: ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation'] }, { k: 'c', l: "Ce que j'ai mangé", t: 'x' }] },
    nap: { t: 'Sieste', sub: "J'ai fait une sieste", ic: '😴', f: [{ k: 'm', l: 'Durée', t: 'n', u: 'min', step: 5, min: 1, max: 300, def: 20 }, R('fa', 'Fatigue au réveil')] },
    water: { t: 'Eau', sub: 'Bilan de fin de journée', ic: '💧', f: [{ k: 'l', l: "Eau bue aujourd'hui", t: 'n', u: 'L', step: 0.1, min: 0, max: 10, def: 1.5 }] },
    note: { t: 'Autre', sub: 'Médicament, effort, météo…', ic: '📝', f: [{ k: 'c', l: 'Description', t: 'x' }] },
  }
}

const dk = (t) => new Date(t).toLocaleDateString('sv')
const hm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const long = (k) => new Date(k + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const avg = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null)
const sum = (a) => (a.length ? +a.reduce((x, y) => x + y, 0).toFixed(1) : null)
const TABS = [['today', "Aujourd'hui"], ['trends', 'Tendances'], ['hist', 'Journal'], ['ana', 'Analyse'], ['prof', 'Profil']]

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <Splash />
  return session ? <Home user={session.user} /> : <Auth />
}

const Splash = () => <div className="center"><p className="mut">Chargement…</p></div>

function Auth() {
  const [e, setE] = useState(''), [p, setP] = useState(''), [m, setM] = useState(''), [busy, setBusy] = useState(false)
  const go = async (up) => {
    setBusy(true); setM('')
    const r = up ? await sb.auth.signUp({ email: e, password: p }) : await sb.auth.signInWithPassword({ email: e, password: p })
    setBusy(false)
    if (r.error) setM(r.error.message)
    else if (up && !r.data.session) setM('Compte créé. Confirmez votre email, puis connectez-vous.')
  }
  return (
    <div className="center"><div className="wrap narrow">
      <h1>Repères</h1>
      <p className="mut">Suivez vos symptômes et votre quotidien pour repérer ce qui les aggrave ou les soulage. Vos données se retrouvent sur tous vos appareils.</p>
      <div className="card" style={{ marginTop: 20 }}>
        <label>Email<input type="email" value={e} onChange={(x) => setE(x.target.value)} autoComplete="email" /></label>
        <label>Mot de passe (6 caractères min.)<input type="password" value={p} onChange={(x) => setP(x.target.value)} autoComplete="current-password" /></label>
        <p className="err">{m}</p>
        <div className="row"><button className="btn" disabled={busy} onClick={() => go(false)}>Se connecter</button><button className="btn soft" disabled={busy} onClick={() => go(true)}>Créer un compte</button></div>
      </div>
    </div></div>
  )
}

function Pick({ onPick, onCancel }) {
  const [o, setO] = useState('')
  return (
    <div className="center"><div className="wrap narrow">
      <h1>Quel symptôme souhaitez-vous suivre ?</h1>
      <p className="mut">Il vous sera proposé chaque jour. Vous pourrez le changer dans votre profil.</p>
      <div className="chips">{SYMS.map((s) => <button key={s} className="chip" onClick={() => onPick(s)}>{s}</button>)}</div>
      <label>Un autre symptôme<input value={o} onChange={(x) => setO(x.target.value)} placeholder="Ex. : acouphènes" /></label>
      <div className="row"><button className="btn" disabled={!o.trim()} onClick={() => onPick(o)}>Suivre ce symptôme</button>{onCancel && <button className="btn soft" onClick={onCancel}>Annuler</button>}</div>
    </div></div>
  )
}

function Ring({ v, t }) {
  const C = 2 * Math.PI * 54, has = v != null, f = has ? v / 10 : 0
  return (
    <div className="ringbox">
      <svg viewBox="0 0 140 140" className="ring" aria-hidden="true">
        <circle cx="70" cy="70" r="54" className="trk" />
        <circle cx="70" cy="70" r="54" className="val" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - f), stroke: `hsl(${170 - 160 * f} 58% 46%)` }} />
      </svg>
      <div className="mid"><span className="big">{has ? v : '–'}</span><span className="mut">{has ? '/10 · ' + hm(t) : 'Pas de mesure'}</span></div>
    </div>
  )
}

function Sheet({ f, onClose, onSave }) {
  const [v, setV] = useState(() => Object.fromEntries(f.f.map((x) => [x.k, x.t === 'r' ? 5 : x.t === 'n' ? x.def : x.t === 's' ? x.o[0] : ''])))
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }))
  const ok = f.f.every((x) => x.t !== 'x' || String(v[x.k]).trim())
  return (
    <div className="ov" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={f.t}>
        <h2>{f.ic} {f.t}</h2>
        {f.f.map((x) => (
          <label key={x.k}>{x.l}{x.t === 'r' && ' (0 à 10)'}{x.u && ` (${x.u})`}
            {x.t === 'r' && <div className="rg"><input type="range" min="0" max="10" step="1" value={v[x.k]} onChange={(e) => set(x.k, +e.target.value)} /><output>{v[x.k]}</output></div>}
            {x.t === 'n' && <input type="number" inputMode="decimal" step={x.step} min={x.min} max={x.max} value={v[x.k]} onChange={(e) => set(x.k, e.target.value === '' ? '' : +e.target.value)} />}
            {x.t === 's' && <select value={v[x.k]} onChange={(e) => set(x.k, e.target.value)}>{x.o.map((o) => <option key={o}>{o}</option>)}</select>}
            {x.t === 'x' && <input value={v[x.k]} onChange={(e) => set(x.k, e.target.value)} />}
          </label>
        ))}
        <div className="row"><button className="btn" disabled={!ok} onClick={() => onSave(v)}>Enregistrer</button><button className="btn soft" onClick={onClose}>Annuler</button></div>
      </div>
    </div>
  )
}

const EvList = ({ list, onDel }) => list.map((e) => (
  <div className="ev" key={e.id}>
    <time>{hm(e.ts)}</time>
    <div><b>{e.title}</b>{e.summary && <span className="mut"><br />{e.summary}</span>}</div>
    <button className="x" aria-label="Supprimer" onClick={() => onDel(e.id)}>✕</button>
  </div>
))

function Home({ user }) {
  const [prof, setProf] = useState(), [ev, setEv] = useState([]), [tab, setTab] = useState('today'), [sheet, setSheet] = useState(null), [pick, setPick] = useState(false)
  const [days, setDays] = useState(7), [rep, setRep] = useState(''), [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [p, e] = await Promise.all([
      sb.from('profiles').select('symptom').maybeSingle(),
      sb.from('entries').select('*').order('ts', { ascending: false }).limit(2000),
    ])
    setProf(p.data || { symptom: null }); setEv(e.data || [])
  }, [])

  useEffect(() => {
    load()
    const ch = sb.channel('sync-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe()
    const vis = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', vis)
    return () => { sb.removeChannel(ch); document.removeEventListener('visibilitychange', vis) }
  }, [load, user.id])

  const sym = prof?.symptom
  const F = useMemo(() => (sym ? forms(sym) : null), [sym])

  const series = useMemo(() => {
    const out = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5), k = dk(d), e = ev.filter((x) => dk(x.ts) === k)
      const g = (t, f) => e.filter((x) => x.type === t).map((x) => x.data[f])
      out.push({ k, day: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), sym: avg(g('symptom', 'i')), sleep: avg(g('sleep', 'q')), water: sum(g('water', 'l')) })
    }
    return out
  }, [ev])

  const insight = useMemo(() => {
    const both = series.filter((d) => d.sym != null && d.sleep != null)
    const lo = both.filter((d) => d.sleep <= 4), hi = both.filter((d) => d.sleep > 4)
    if (lo.length >= 2 && hi.length >= 2)
      return `Les jours de sommeil de mauvaise qualité (≤ 4/10, ${lo.length} jours), votre symptôme est en moyenne à ${avg(lo.map((d) => d.sym))}/10, contre ${avg(hi.map((d) => d.sym))}/10 les autres jours (${hi.length} jours). C'est une association observée, pas une preuve.`
    return 'Notez votre sommeil et votre symptôme pendant quelques jours : une première comparaison apparaîtra ici.'
  }, [series])

  const setSym = async (s) => { s = s.trim(); if (!s) return; await sb.from('profiles').upsert({ user_id: user.id, symptom: s }); setPick(false); setTab('today'); load() }
  const save = async (type, d) => {
    const f = F[type]
    const summary = f.f.map((x) => `${x.l}: ${d[x.k]}${x.t === 'r' ? '/10' : x.u ? ' ' + x.u : ''}`).join(', ')
    await sb.from('entries').insert({ type, title: f.t, summary, data: d })
    setSheet(null); load()
  }
  const del = async (id) => { if (confirm('Supprimer cette note ?')) { await sb.from('entries').delete().eq('id', id); load() } }
  const run = async () => {
    setBusy(true); setRep('')
    const { data, error } = await sb.functions.invoke('analyze', { body: { days, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } })
    setBusy(false)
    if (error) { let m = error.message; try { m = (await error.context.json()).error || m } catch {} setRep('Erreur : ' + m) } else setRep(data.report)
  }
  const exportJson = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ symptom: sym, entries: ev }, null, 2)], { type: 'application/json' }))
    a.download = 'reperes-export.json'; a.click()
  }

  if (prof === undefined) return <Splash />
  if (!sym || pick) return <Pick onPick={setSym} onCancel={sym ? () => setPick(false) : null} />

  const today = ev.filter((e) => dk(e.ts) === dk(Date.now()))
  const last = today.find((e) => e.type === 'symptom')
  const groups = {}; ev.forEach((e) => (groups[dk(e.ts)] ??= []).push(e))

  return (
    <div className="shell">
      <div className="wrap">
        {tab === 'today' && (<>
          <p className="mut cap">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{sym}</h1>
          <div className="card hero"><Ring v={last?.data.i} t={last?.ts} /><div><b>Dernière mesure du jour</b><p className="mut">Touchez « Symptôme » pour en ajouter une.</p></div></div>
          <h2>Que voulez-vous noter ?</h2>
          <div className="tiles">{Object.entries(F).map(([k, f]) => <button key={k} className={'tile' + (f.main ? ' main' : '')} onClick={() => setSheet(k)}><span className="ic">{f.ic}</span><b>{f.t}</b><span className="sub">{f.sub}</span></button>)}</div>
          <h2>Notes du jour</h2>
          <div className="card">{today.length ? <EvList list={today} onDel={del} /> : <p className="mut">Rien pour le moment. Commencez par votre nuit ou un symptôme.</p>}</div>
        </>)}

        {tab === 'trends' && (<>
          <h1>Tendances</h1><p className="mut">14 derniers jours</p>
          <div className="card insight">{insight}</div>
          <h2>Symptôme et qualité du sommeil</h2>
          <div className="card"><ResponsiveContainer width="100%" height={220}><LineChart data={series} margin={{ left: -24, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#8884" /><XAxis dataKey="day" tick={{ fontSize: 11 }} interval={2} /><YAxis domain={[0, 10]} tick={{ fontSize: 11 }} /><Tooltip />
            <Line name={sym} dataKey="sym" stroke="#D9573A" strokeWidth={3} connectNulls dot={{ r: 3 }} />
            <Line name="Sommeil" dataKey="sleep" stroke="#1E8F86" strokeWidth={3} connectNulls dot={{ r: 3 }} />
          </LineChart></ResponsiveContainer>
            <p className="mut"><span className="dot" style={{ background: '#D9573A' }} /> {sym} &nbsp; <span className="dot" style={{ background: '#1E8F86' }} /> Qualité du sommeil</p></div>
          <h2>Eau bue (litres)</h2>
          <div className="card"><ResponsiveContainer width="100%" height={180}><BarChart data={series} margin={{ left: -24, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#8884" /><XAxis dataKey="day" tick={{ fontSize: 11 }} interval={2} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
            <Bar name="Eau (L)" dataKey="water" fill="#4A9BD9" radius={[6, 6, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </>)}

        {tab === 'hist' && (<>
          <h1>Journal</h1>
          {Object.keys(groups).length ? Object.keys(groups).map((k) => <div key={k}><h2 className="cap">{long(k)}</h2><div className="card"><EvList list={groups[k]} onDel={del} /></div></div>) : <p className="mut">Aucune note enregistrée.</p>}
        </>)}

        {tab === 'ana' && (<>
          <h1>Analyse</h1>
          <p className="mut">Vos notes sont résumées par un modèle d'IA (OpenAI). Le rapport décrit des associations observées dans vos données, il ne remplace pas un avis médical.</p>
          <div className="card" style={{ marginTop: 14 }}>
            <label>Période analysée<select value={days} onChange={(e) => setDays(+e.target.value)}><option value={7}>7 derniers jours</option><option value={14}>14 derniers jours</option><option value={30}>30 derniers jours</option></select></label>
            <button className="btn full" disabled={busy} onClick={run}>{busy ? 'Analyse en cours…' : "Lancer l'analyse"}</button>
          </div>
          {rep && <div className="card rep">{rep.replace(/\*\*|^#+\s*/gm, '').split('\n').map((l, i) => (/^\d\)/.test(l) ? <h3 key={i}>{l}</h3> : l.trim() ? <p key={i}>{l}</p> : null))}</div>}
        </>)}

        {tab === 'prof' && (<>
          <h1>Profil</h1>
          <div className="card"><p>Connecté : <b>{user.email}</b></p><p>Symptôme suivi : <b>{sym}</b></p><button className="btn soft" onClick={() => setPick(true)}>Changer de symptôme</button></div>
          <h2>Mes données</h2>
          <div className="row"><button className="btn soft" onClick={exportJson}>Exporter (JSON)</button><button className="btn soft" onClick={() => sb.auth.signOut()}>Se déconnecter</button></div>
        </>)}
      </div>

      <nav>{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
      {sheet && <Sheet f={F[sheet]} onClose={() => setSheet(null)} onSave={(d) => save(sheet, d)} />}
    </div>
  )
}
