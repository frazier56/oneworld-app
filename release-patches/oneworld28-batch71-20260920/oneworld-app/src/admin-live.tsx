import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./admin-live.css";

const URL = "https://wseblryyqxawvbjmylbo.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";
const supabase = createClient(URL, ANON, { auth: { storageKey: "sb-wseblryyqxawvbjmylbo-auth-token", persistSession: true, autoRefreshToken: true } });

type Pair = { label: string; value: number };
type Kpi = { current: number; previous: number };
type Overview = any;
type Directory = { total: number; rows: any[] };
const fmt = (n: unknown) => new Intl.NumberFormat().format(Number(n || 0));
const delta = (k: Kpi) => !k?.previous ? (k?.current ? "+100%" : "—") : `${Math.round(((k.current-k.previous)/k.previous)*100) > 0 ? "+" : ""}${Math.round(((k.current-k.previous)/k.previous)*100)}%`;
const when = (iso?: string | null) => !iso ? "—" : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });

function Bars({ title, rows = [] }: { title: string; rows?: Pair[] }) {
  const max = Math.max(1, ...rows.map(r => Number(r.value || 0)));
  return <section className="owal-card owal-break"><h3>{title}</h3>{!rows.length && <p className="owal-empty">No data yet</p>}{rows.slice(0,8).map(r => <div className="owal-bar" key={r.label}><div><span>{r.label}</span><b>{fmt(r.value)}</b></div><i><em style={{width:`${Math.max(4,(r.value/max)*100)}%`}} /></i></div>)}</section>;
}
function Metrics({ overview }: { overview: Overview }) {
  const keys = [["visitors","Visitors"],["visits","Visits"],["signups","Signups"],["onboarded","Onboarded"],["product_actions","Product actions"]];
  return <div className="owal-metrics">{keys.map(([key,label]) => { const k=overview.kpis[key] as Kpi; const d=delta(k); return <article className="owal-card" key={key}><small>{label}</small><div><strong>{fmt(k.current)}</strong><mark className={d.startsWith("+") ? "up" : ""}>{d}</mark></div><p>Previous: {fmt(k.previous)}</p></article> })}</div>;
}
function Trend({ rows = [] }: { rows?: any[] }) {
  const vals=rows.map(r=>Number(r.visitors||0)), max=Math.max(1,...vals);
  const pts=vals.map((v,i)=>`${(i/Math.max(1,vals.length-1))*100},${38-(v/max)*32}`).join(" ");
  return <section className="owal-card owal-trend"><div><h3>Audience trend</h3><p>Unique visitors per day</p></div>{pts ? <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-label="Daily visitors trend"><polyline points={pts} /></svg> : <p className="owal-empty">Collection is ready; history begins with this release.</p>}</section>;
}
function Operations({ data }: { data: any }) {
  const cards = [
    ["OneEvent", [["Events",data.oneevent.events],["Applications",data.oneevent.applications],["Registrations",data.oneevent.registrations],["Pending approvals",data.oneevent.pending_approvals,true],["Payment attention",data.oneevent.payment_attention,true]]],
    ["OneHome", [["Rental listings",data.onehome.rental_listings],["Rental requests",data.onehome.rental_requests],["Active contracts",data.onehome.active_contracts],["Sale listings",data.onehome.sale_listings],["Sale deals",data.onehome.sale_deals]]],
    ["Operations health", [["Open alerts",data.health.open_alerts,true],["Onboarding incomplete",data.health.onboarding_incomplete,true],["Email failures",data.health.email_failures,true]]]
  ] as any[];
  return <div className="owal-ops">{cards.map(([title,rows])=><section className="owal-card" key={title}><h3>{title}</h3><dl>{rows.map(([label,value,attention]:any)=><div key={label}><dt>{label}</dt><dd className={attention&&value?"attention":""}>{fmt(value)}</dd></div>)}</dl></section>)}</div>;
}
function OverviewPanel() {
  const [days,setDays]=useState(30), [product,setProduct]=useState(""), [traffic,setTraffic]=useState("human"), [data,setData]=useState<Overview|null>(null), [error,setError]=useState("");
  useEffect(()=>{let alive=true; setData(null); supabase.rpc("admin_analytics_overview",{p_days:days,p_product:product||null,p_traffic:traffic}).then(({data,error})=>{if(!alive)return; if(error)setError(error.message); else {setError("");setData(data)}}); return()=>{alive=false}},[days,product,traffic]);
  return <div className="owal-stack"><div className="owal-card owal-filters"><select value={days} onChange={e=>setDays(Number(e.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select><select value={product} onChange={e=>setProduct(e.target.value)}><option value="">All products</option><option value="onejob">OneJob</option><option value="oneevent">OneEvent</option><option value="onehome">OneHome</option><option value="onesocial">OneSocial</option><option value="onescore">OneScore</option></select><select value={traffic} onChange={e=>setTraffic(e.target.value)}><option value="human">Human traffic</option><option value="bot">Bot traffic</option><option value="all">All traffic</option></select></div>{error&&<div className="owal-card owal-warn"><b>Dashboard data is unavailable.</b><p>{error}</p></div>}{!data&&!error&&<div className="owal-card owal-loading">Loading live dashboard…</div>}{data&&<><Metrics overview={data}/><Trend rows={data.daily}/><div className="owal-grid"><Bars title="Traffic sources" rows={data.referrers}/><Bars title="Devices" rows={data.devices}/><Bars title="Products connected" rows={data.products}/><Bars title="Countries" rows={data.countries}/><Bars title="Cities" rows={data.cities}/><Bars title="Landing pages" rows={data.landing_pages}/>{traffic!=="human"&&<Bars title="Search & discovery crawlers" rows={data.bots}/>}</div><Operations data={data.operations}/></>}</div>;
}
function PeoplePanel({ compact=false, viewAll }: { compact?: boolean; viewAll?:()=>void }) {
  const [draft,setDraft]=useState(""),[search,setSearch]=useState(""),[product,setProduct]=useState(""),[status,setStatus]=useState(""),[data,setData]=useState<Directory|null>(null),[open,setOpen]=useState<string|null>(null),[error,setError]=useState("");
  useEffect(()=>{const id=setTimeout(()=>setSearch(draft.trim()),250);return()=>clearTimeout(id)},[draft]);
  useEffect(()=>{let alive=true; supabase.rpc("admin_user_directory",{p_search:search||null,p_product:product||null,p_status:status||null,p_limit:compact?6:100,p_offset:0}).then(({data,error})=>{if(!alive)return;if(error)setError(error.message);else{setError("");setData(data as Directory)}});return()=>{alive=false}},[search,product,status,compact]);
  const products=useMemo(()=>[["","All products"],["onejob","OneJob"],["oneevent","OneEvent"],["onehome","OneHome"],["onesocial","OneSocial"],["onescore","OneScore"]],[]);
  return <section className="owal-stack">{compact?<div className="owal-section-title"><div><h2>Members</h2><p>One ID, claim state and connected products</p></div><button onClick={viewAll}>View all</button></div>:<div className="owal-card owal-people-filters"><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Name, email or phone"/><select value={product} onChange={e=>setProduct(e.target.value)}>{products.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All account states</option><option value="claimed">Claimed</option><option value="invited">Invited</option><option value="migrated">Migrated</option><option value="onboarding">Onboarding incomplete</option></select></div>}<div className="owal-meta"><span>{data?`${fmt(data.total)} people`:"Loading people…"}</span><span>PII access audited</span></div>{error&&<div className="owal-card owal-warn">{error}</div>}<div className="owal-people">{data?.rows.map(m=>{const expanded=open===m.user_id;return <article className="owal-card" key={m.user_id}><button className="owal-person" onClick={()=>setOpen(expanded?null:m.user_id)}><span className="owal-avatar">{(m.full_name||"?").slice(0,1).toUpperCase()}</span><span><b>{m.full_name||"No name"}</b><small>{m.email||"—"}</small></span><mark>{m.membership}</mark><strong>{m.score==null?"—":Math.round(m.score)}<small>score</small></strong></button>{expanded&&<div className="owal-detail"><dl>{[["Phone",m.phone||"—"],["Profession",m.profession||"—"],["Location",m.location||"—"],["Last sign-in",when(m.last_sign_in_at)],["Joined",when(m.created_at)],["Profile",m.is_public?"Public":"Private"]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><div className="owal-products">{(m.products||[]).filter((p:any)=>p.status==="active").map((p:any)=><span key={p.product}>{p.product.replace(/^one/,"One")}{p.plan?` · ${p.plan}`:""}</span>)}</div>{m.onboarding_incomplete&&<p className="owal-note">Onboarding is incomplete</p>}</div>}</article>})}</div></section>;
}
function Dashboard() {
  const [tab,setTab]=useState<"overview"|"people">("overview");
  return <div className="ow-admin-live"><header><h1><span>Admin Dashboard</span></h1><p>Growth · People · Money · Ops</p></header><nav aria-label="Admin sections">{["Overview","Growth","People","Money","Ops"].map(name=>{const enabled=name==="Overview"||name==="People",active=tab===name.toLowerCase();return <button key={name} disabled={!enabled} aria-current={active?"page":undefined} onClick={()=>enabled&&setTab(name.toLowerCase() as any)}>{name}</button>})}</nav>{tab==="overview"?<><PeoplePanel compact viewAll={()=>setTab("people")}/><OverviewPanel/></>:<PeoplePanel/>}<footer>Read-only · Server-authorized · Sensitive views are audited</footer></div>;
}

async function mount() {
  if (window.location.pathname.replace(/\/$/,"") !== "/admin") return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error || data !== true) return;
  let main: HTMLElement | null = null;
  for (let i=0;i<80&&!main;i++) { main=document.querySelector("#root main"); if(!main) await new Promise(r=>setTimeout(r,50)); }
  if (!main) return;
  main.replaceChildren();
  main.classList.add("owal-host");
  createRoot(main).render(<Dashboard/>);
}
void mount();
