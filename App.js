// ============================================================
// SIEHS PREDICTIVE ANALYTICS — COMPLETE REACT APP
// File: src/App.js
//
// Pages:
//   Login · Dashboard · Demand Forecast · Ambulance Type
//   All Zones · Peak Hours · Ask AI Chat
//
// Connects to:
//   http://localhost:8000  → predictive_agent.py
//   http://localhost:8001  → viz_agent.py
// ============================================================

import { useState, useEffect } from "react";

// ── API URLs — change to your IP when sharing ──────────────
const PRED = "http://localhost:8000";
const VIZ  = "http://localhost:8001";

// ── Static data ────────────────────────────────────────────
const ZONES = [
  "Zone 1","Zone 2","Shahbaz Zone","Bhitai Zone",
  "Aror Zone","Lar Zone","SBA Zone","Thar Zone",
];
const COMPLAINTS = [
  "Breathing Problems",
  "Cardiac or respiratory Arrest / death",
  "Chest Pain (Non-Traumatic)",
  "Traffic / Transportation Incidents",
  "Transfer / InterFacility /Palliative Care",
  "Unconscious / Fainting(Near)",
  "Falls","Traumatic Injuries ( Specific)",
  "Hemorrhage / Lacerations","Abdominal Pain / Problems",
  "Diabetic Problems","Seizure","Stroke / CVA",
  "Overdose / Poisoning","Allergic Reaction",
];
const DEMO_USERS = {
  admin:      { password:"admin123",  role:"Administrator" },
  dispatcher: { password:"dispatch1", role:"Dispatcher"    },
  manager:    { password:"manager123",role:"Zone Manager"  },
};
const ZONE_COLORS = [
  "#00d4ff","#ff6b35","#7c3aed","#10b981",
  "#f59e0b","#ef4444","#06b6d4","#8b5cf6",
];
const TYPE_COLORS = {
  "BLS":"#00d4ff","ALS":"#ff6b35","Mortuary Van":"#7c3aed",
};

// ── API helper ─────────────────────────────────────────────
async function callAPI(url, body=null) {
  try {
    const r = await fetch(url, body ? {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
    } : {});
    return r.json();
  } catch {
    return { error:"Cannot connect. Make sure agents are running." };
  }
}

// ══════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ══════════════════════════════════════════════════════════

const C = {
  card:{ background:"#111827", border:"1px solid #1f2937", borderRadius:12, padding:20 },
  input:{ width:"100%", background:"#0d1520", border:"1px solid #1f2937", borderRadius:8, padding:"9px 12px", color:"#c9d1d9", fontSize:13, outline:"none", fontFamily:"inherit" },
  label:{ display:"block", fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 },
};

function Card({ children, style={} }) {
  return <div style={{...C.card,...style}}>{children}</div>;
}

function STitle({ t }) {
  return <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", borderBottom:"1px solid #1f2937", paddingBottom:8, marginBottom:16 }}>{t}</div>;
}

function Lbl({ children }) {
  return <div style={C.label}>{children}</div>;
}

function Sel({ value, onChange, options, style={} }) {
  return (
    <select style={{...C.input, cursor:"pointer",...style}} value={value} onChange={e=>onChange(e.target.value)}>
      {options.map(o=> typeof o==="string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.v} value={o.v}>{o.l}</option>
      )}
    </select>
  );
}

function Btn({ onClick, children, color="#00d4ff", disabled, full }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:full?"100%":"auto", padding:"10px 20px",
      fontSize:13, fontWeight:600,
      background:`${color}20`, border:`1px solid ${color}55`,
      color, borderRadius:8,
      cursor:disabled?"not-allowed":"pointer",
      opacity:disabled?0.6:1, fontFamily:"inherit",
      letterSpacing:"0.04em",
    }}>
      {children}
    </button>
  );
}

function Metric({ label, value, sub, color="#00d4ff" }) {
  return (
    <div style={{ background:"#0d1520", borderRadius:10, padding:"14px 16px", borderLeft:`3px solid ${color}` }}>
      <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:600, color, lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#4b5563", marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function Alert({ level, zone, message, time }) {
  const c = {HIGH:"#ef4444",MEDIUM:"#f59e0b",LOW:"#10b981"}[level]||"#6b7280";
  return (
    <div style={{ display:"flex", gap:10, padding:"10px 12px", borderRadius:8, borderLeft:`3px solid ${c}`, background:`${c}0d`, marginBottom:8 }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:c, marginTop:5, flexShrink:0 }}/>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:12, fontWeight:600, color:c }}>{zone}</span>
          <span style={{ fontSize:11, color:"#4b5563" }}>{time}</span>
        </div>
        <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{message}</div>
      </div>
    </div>
  );
}

function ErrBox({ msg }) {
  return <div style={{ background:"#ef444415", border:"1px solid #ef444430", borderRadius:8, padding:"12px 14px", fontSize:12, color:"#ef4444", marginTop:12 }}>⚠ {msg}</div>;
}

function Spin({ text="Loading..." }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 20px", color:"#4b5563", fontSize:13 }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:"inline-block", width:20, height:20, border:"2px solid #1f2937", borderTopColor:"#00d4ff", borderRadius:"50%", animation:"sp 0.8s linear infinite", marginBottom:10 }}/>
      <div>{text}</div>
    </div>
  );
}

function MiniBar({ values=[], labels=[], colors=[] }) {
  const max = Math.max(...values,1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:110, padding:"0 2px" }}>
      {values.map((v,i)=>(
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <div style={{ fontSize:9, color:colors[i]||"#00d4ff" }}>{v}</div>
          <div style={{ width:"100%", height:Math.max(4,Math.round((v/max)*80)), background:colors[i]||"#00d4ff", borderRadius:"3px 3px 0 0", opacity:0.85 }}/>
          <div style={{ fontSize:8, color:"#4b5563", textAlign:"center", overflow:"hidden", maxWidth:"100%", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
            {(labels[i]||"").replace(" Zone","").replace("Zone ","Z")}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProbBar({ label, pct, color }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
        <span style={{ color:"#c9d1d9" }}>{label}</span>
        <span style={{ fontWeight:600, color }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height:5, background:"#1f2937", borderRadius:3 }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.7s" }}/>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE: LOGIN
// ══════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [uname,setUname]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [load,setLoad]=useState(false);

  function login() {
    if(!uname||!pass){setErr("Please enter username and password.");return;}
    setLoad(true);setErr("");
    setTimeout(()=>{
      const u=DEMO_USERS[uname.toLowerCase()];
      if(u&&u.password===pass){onLogin({username:uname.toLowerCase(),role:u.role});}
      else{setErr("Invalid username or password.");setLoad(false);}
    },700);
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20, background:"radial-gradient(ellipse at 20% 50%,#00d4ff07 0%,transparent 50%),radial-gradient(ellipse at 80% 50%,#7c3aed07 0%,transparent 50%),#070d17" }}>
      <div style={{ width:"100%", maxWidth:400 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:"#00d4ff12", border:"1px solid #00d4ff28", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:26 }}>🚑</div>
          <div style={{ fontSize:22, fontWeight:700, color:"#e5e7eb" }}>SIEHS Analytics</div>
          <div style={{ fontSize:12, color:"#4b5563", marginTop:5 }}>Sindh Integrated Emergency Health Services</div>
          <div style={{ fontSize:11, color:"#374151", marginTop:4, letterSpacing:"0.06em" }}>PREDICTIVE ANALYTICS SYSTEM</div>
        </div>

        {/* Form */}
        <Card style={{ marginBottom:12 }}>
          <div style={{ marginBottom:14 }}>
            <Lbl>Username</Lbl>
            <input style={C.input} placeholder="Enter username" value={uname} onChange={e=>setUname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} autoComplete="username"/>
          </div>
          <div style={{ marginBottom:18 }}>
            <Lbl>Password</Lbl>
            <input type="password" style={C.input} placeholder="Enter password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} autoComplete="current-password"/>
          </div>
          {err&&<ErrBox msg={err}/>}
          <button onClick={login} disabled={load} style={{ width:"100%", marginTop:err?12:0, padding:11, fontSize:14, fontWeight:600, borderRadius:8, background:"#00d4ff", color:"#070d17", border:"none", cursor:load?"not-allowed":"pointer", opacity:load?0.7:1, fontFamily:"inherit" }}>
            {load?"Signing in...":"Sign in →"}
          </button>
        </Card>

        {/* Demo creds */}
        <div style={{ background:"#0d1520", border:"1px solid #1f2937", borderRadius:10, padding:14 }}>
          <div style={{ fontSize:11, color:"#4b5563", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Demo credentials — click to fill</div>
          {Object.entries(DEMO_USERS).map(([u,d])=>(
            <div key={u} onClick={()=>{setUname(u);setPass(d.password);}} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid #1f293740", cursor:"pointer", fontSize:12 }}>
              <span style={{ color:"#00d4ff77" }}>{u}</span>
              <span style={{ color:"#374151", fontFamily:"monospace" }}>{d.password}</span>
              <span style={{ fontSize:10, color:"#374151" }}>{d.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE: DASHBOARD
// ══════════════════════════════════════════════════════════
function DashboardPage() {
  const [zone,setZone]=useState("Zone 1");
  const [horizon,setHorizon]=useState("day");
  const [res,setRes]=useState(null);
  const [load,setLoad]=useState(false);

  async function predict(){
    setLoad(true);setRes(null);
    const d=await callAPI(`${PRED}/predict/demand`,{zone,horizon});
    setRes(d);setLoad(false);
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, color:"#4b5563" }}>Operations Overview</div>
        <div style={{ fontSize:20, fontWeight:700, color:"#e5e7eb", marginTop:2 }}>SIEHS Dashboard</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        <Metric label="Total Calls Today" value="847"     sub="All 8 zones"        color="#00d4ff"/>
        <Metric label="Active Crew"       value="142"     sub="On duty"             color="#10b981"/>
        <Metric label="Avg Response"      value="8.4 min" sub="Last 24h"            color="#f59e0b"/>
        <Metric label="Critical Cases"    value="23"      sub="Alpha & Echo priority" color="#ef4444"/>
      </div>

      {/* Alerts + Quick predict */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        <Card>
          <STitle t="Live Alerts"/>
          <Alert level="HIGH"   zone="Zone 1"      message="Call volume 40% above average"      time="2 min ago"/>
          <Alert level="MEDIUM" zone="Shahbaz Zone" message="ALS unit delayed — traffic"         time="8 min ago"/>
          <Alert level="HIGH"   zone="Bhitai Zone"  message="Critical cardiac arrest dispatched"  time="12 min ago"/>
          <Alert level="LOW"    zone="Aror Zone"    message="Crew rotation scheduled at 14:00"   time="22 min ago"/>
          <Alert level="MEDIUM" zone="Zone 2"       message="3 transfer calls pending"            time="30 min ago"/>
        </Card>

        <Card>
          <STitle t="Quick Predict"/>
          <div style={{ marginBottom:10 }}>
            <Lbl>Zone</Lbl>
            <Sel value={zone} onChange={setZone} options={ZONES}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <Lbl>Horizon</Lbl>
            <Sel value={horizon} onChange={setHorizon} options={[{v:"hour",l:"Next Hour"},{v:"day",l:"Tomorrow"},{v:"week",l:"Next 7 Days"}]}/>
          </div>
          <Btn onClick={predict} disabled={load} full>{load?"Predicting...":"Run Prediction →"}</Btn>
          {res&&!res.error&&(
            <div style={{ marginTop:14, background:"#00d4ff0d", border:"1px solid #00d4ff25", borderRadius:8, padding:14, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#6b7280", marginBottom:4 }}>{horizon==="week"?"Weekly Total":"Predicted Calls"}</div>
              <div style={{ fontSize:32, fontWeight:700, color:"#00d4ff" }}>
                {horizon==="week"?(res.total_week||0).toLocaleString():res.predicted_calls||0}
              </div>
              <div style={{ fontSize:11, color:"#4b5563", marginTop:3 }}>{zone} · {res.day_name||res.prediction_for||""}</div>
            </div>
          )}
          {res?.error&&<ErrBox msg={res.error}/>}
        </Card>
      </div>

      {/* Fleet */}
      <Card>
        <STitle t="Fleet Status"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
          <Metric label="BLS Units"     value="98" sub="Basic Life Support"    color="#00d4ff"/>
          <Metric label="ALS Units"     value="31" sub="Advanced Life Support" color="#ff6b35"/>
          <Metric label="Mortuary Vans" value="13" sub="Active assignments"    color="#7c3aed"/>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE: DEMAND FORECAST
// ══════════════════════════════════════════════════════════
function DemandPage() {
  const [zone,setZone]=useState("Zone 1");
  const [horizon,setHorizon]=useState("week");
  const [res,setRes]=useState(null);
  const [load,setLoad]=useState(false);

  async function predict(){
    setLoad(true);setRes(null);
    const d=await callAPI(`${PRED}/predict/demand`,{zone,horizon});
    setRes(d);setLoad(false);
  }

  const fc  = res?.forecast||[];
  const mx  = Math.max(...fc.map(f=>f.predicted_calls),1);

  return (
    <Card>
      <STitle t="Demand Forecast"/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:12, marginBottom:16, alignItems:"flex-end" }}>
        <div><Lbl>Zone</Lbl><Sel value={zone} onChange={setZone} options={ZONES}/></div>
        <div><Lbl>Time Horizon</Lbl><Sel value={horizon} onChange={setHorizon} options={[{v:"hour",l:"Next Hour"},{v:"day",l:"Tomorrow"},{v:"week",l:"Next 7 Days"},{v:"month",l:"Next Month"}]}/></div>
        <Btn onClick={predict} disabled={load}>{load?"Loading...":"Predict →"}</Btn>
      </div>

      {load&&<Spin text="Running prediction model..."/>}

      {res&&!res.error&&(
        <>
          {/* WEEK */}
          {horizon==="week"&&fc.length>0&&(
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                <Metric label="Total Week"    value={(res.total_week||0).toLocaleString()} sub="predicted calls" color="#00d4ff"/>
                <Metric label="Daily Average" value={res.daily_average||0}                 sub="per day"         color="#10b981"/>
                <Metric label="Peak Day"      value={res.peak_day?.day||"—"}               sub={(res.peak_day?.predicted_calls||"")+" calls"} color="#f59e0b"/>
                <Metric label="Model"         value="Ensemble"                              sub="XGB+RF+KNN"      color="#7c3aed"/>
              </div>
              <div style={{ background:"#0d1520", borderRadius:8, padding:"14px 16px", marginBottom:20 }}>
                <div style={{ fontSize:11, color:"#4b5563", marginBottom:8 }}>Weekly demand chart</div>
                <MiniBar values={fc.map(f=>f.predicted_calls)} labels={fc.map(f=>f.day)} colors={fc.map(f=>f.is_weekend?"#ff6b35":"#00d4ff")}/>
                <div style={{ display:"flex", gap:16, marginTop:10, fontSize:10, color:"#4b5563" }}>
                  <span><span style={{color:"#00d4ff"}}>■</span> Weekday</span>
                  <span><span style={{color:"#ff6b35"}}>■</span> Weekend</span>
                </div>
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid #1f2937" }}>
                    {["Date","Day","Predicted Calls","Type"].map(h=>(
                      <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, color:"#6b7280", fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fc.map((f,i)=>(
                    <tr key={i} style={{ borderBottom:"1px solid #0d1520" }}>
                      <td style={{ padding:"9px 10px", color:"#6b7280" }}>{f.date}</td>
                      <td style={{ padding:"9px 10px", color:"#c9d1d9" }}>{f.day}</td>
                      <td style={{ padding:"9px 10px", fontWeight:600, color:"#00d4ff" }}>{f.predicted_calls}</td>
                      <td style={{ padding:"9px 10px" }}>
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:f.is_weekend?"#ff6b3520":"#10b98120", color:f.is_weekend?"#ff6b35":"#10b981" }}>
                          {f.is_weekend?"Weekend":"Weekday"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {/* HOUR/DAY — big number */}
          {(horizon==="hour"||horizon==="day")&&(
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:11, color:"#6b7280", marginBottom:8, letterSpacing:"0.1em" }}>PREDICTED CALLS</div>
              <div style={{ fontSize:72, fontWeight:700, color:"#00d4ff", lineHeight:1 }}>{res.predicted_calls||0}</div>
              <div style={{ fontSize:13, color:"#4b5563", marginTop:10 }}>{res.prediction_for||res.day_name||""} · {zone}</div>
              <div style={{ fontSize:11, color:"#374151", marginTop:4 }}>{res.model_used||""}</div>
            </div>
          )}
          {/* MONTH */}
          {horizon==="month"&&(
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:11, color:"#6b7280", marginBottom:8 }}>MONTHLY ESTIMATE</div>
              <div style={{ fontSize:64, fontWeight:700, color:"#f59e0b", lineHeight:1 }}>{(res.predicted_calls||0).toLocaleString()}</div>
              <div style={{ fontSize:12, color:"#4b5563", marginTop:10 }}>{res.note||"Based on historical average"}</div>
            </div>
          )}
        </>
      )}
      {res?.error&&<ErrBox msg={res.error}/>}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE: AMBULANCE TYPE
// ══════════════════════════════════════════════════════════
function TypePage() {
  const [zone,setZone]=useState("Zone 1");
  const [complaint,setComplaint]=useState("Breathing Problems");
  const [shift,setShift]=useState("Morning");
  const [res,setRes]=useState(null);
  const [load,setLoad]=useState(false);

  async function predict(){
    setLoad(true);setRes(null);
    const d=await callAPI(`${PRED}/predict/type`,{zone,complaint,shift});
    setRes(d);setLoad(false);
  }

  const rec=res?.recommendation;
  const rc=TYPE_COLORS[rec]||"#00d4ff";

  return (
    <Card>
      <STitle t="Ambulance Type Prediction"/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
        <div><Lbl>Zone</Lbl><Sel value={zone} onChange={setZone} options={ZONES}/></div>
        <div><Lbl>Chief Complaint</Lbl><Sel value={complaint} onChange={setComplaint} options={COMPLAINTS}/></div>
        <div><Lbl>Shift</Lbl><Sel value={shift} onChange={setShift} options={["Morning","Afternoon","Night"]}/></div>
      </div>
      <Btn onClick={predict} disabled={load} color="#7c3aed" full>{load?"Classifying...":"Predict Ambulance Type →"}</Btn>

      {load&&<Spin text="Running type classifier..."/>}

      {res&&!res.error&&(
        <div style={{ marginTop:20 }}>
          {/* Banner */}
          <div style={{ background:`${rc}12`, border:`1.5px solid ${rc}40`, borderRadius:12, padding:"22px 24px", textAlign:"center", marginBottom:24 }}>
            <div style={{ fontSize:11, color:"#6b7280", letterSpacing:"0.1em", marginBottom:6 }}>RECOMMENDATION</div>
            <div style={{ fontSize:40, fontWeight:700, color:rc, lineHeight:1 }}>SEND {rec?.toUpperCase()}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:8 }}>
              Confidence: <strong style={{color:rc}}>{res.confidence}%</strong> · {zone} · {shift} shift
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            {/* Prob bars */}
            <div>
              <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Probability Breakdown</div>
              {res.probabilities&&Object.entries(res.probabilities).sort((a,b)=>b[1]-a[1]).map(([t,p])=>(
                <ProbBar key={t} label={t} pct={p} color={TYPE_COLORS[t]||"#6b7280"}/>
              ))}
            </div>

            {/* Mix */}
            <div>
              <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Per 10 Calls Mix</div>
              {res.mix_per_10_calls&&Object.entries(res.mix_per_10_calls).filter(([,v])=>v>0).map(([t,n])=>(
                <div key={t} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", background:"#0d1520", borderRadius:8, border:`1px solid ${TYPE_COLORS[t]||"#1f2937"}30`, marginBottom:8 }}>
                  <div style={{ fontSize:28, fontWeight:700, color:TYPE_COLORS[t]||"#00d4ff", minWidth:32 }}>{n}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#c9d1d9" }}>{t}</div>
                    <div style={{ fontSize:11, color:"#4b5563" }}>units to dispatch</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:12, background:"#10b98112", border:"1px solid #10b98130", borderRadius:8, padding:"12px 14px", fontSize:12, color:"#10b981", lineHeight:1.6 }}>
                ✅ Send <strong>{rec}</strong> for {complaint} in {zone} during {shift} shift.
              </div>
            </div>
          </div>
        </div>
      )}
      {res?.error&&<ErrBox msg={res.error}/>}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE: ALL ZONES
// ══════════════════════════════════════════════════════════
function ZonesPage() {
  const [horizon,setHorizon]=useState("day");
  const [res,setRes]=useState(null);
  const [load,setLoad]=useState(false);

  async function load_zones(){
    setLoad(true);setRes(null);
    const d=await callAPI(`${PRED}/predict/all-zones`,{horizon});
    setRes(d);setLoad(false);
  }

  const preds=res?.predictions||[];
  const total=res?.total_system||0;

  return (
    <Card>
      <STitle t="All Zones Comparison"/>
      <div style={{ display:"flex", gap:12, marginBottom:16, alignItems:"flex-end" }}>
        <div style={{ width:200 }}><Lbl>Forecast Horizon</Lbl><Sel value={horizon} onChange={setHorizon} options={[{v:"day",l:"Tomorrow"},{v:"week",l:"Next 7 Days"}]}/></div>
        <Btn onClick={load_zones} disabled={load} color="#10b981">{load?"Loading...":"Compare All Zones →"}</Btn>
      </div>

      {load&&<Spin text="Predicting for all 8 zones..."/>}

      {res&&!res.error&&(
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
            <Metric label="Busiest Zone"  value={res.busiest_zone||"—"}  color="#00d4ff"/>
            <Metric label="Quietest Zone" value={res.quietest_zone||"—"} color="#10b981"/>
            <Metric label="Total System"  value={(total).toLocaleString()} sub="predicted calls" color="#f59e0b"/>
            <Metric label="Zones Active"  value={preds.length||8}          color="#7c3aed"/>
          </div>
          <div style={{ background:"#0d1520", borderRadius:8, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:11, color:"#4b5563", marginBottom:8 }}>Demand by zone</div>
            <MiniBar values={preds.map(p=>p.predicted_calls)} labels={preds.map(p=>p.zone)} colors={ZONE_COLORS}/>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #1f2937" }}>
                {["Rank","Zone","Predicted Calls","Share %"].map(h=>(
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, color:"#6b7280", fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preds.map((p,i)=>(
                <tr key={i} style={{ borderBottom:"1px solid #0d1520" }}>
                  <td style={{ padding:"9px 10px", color:"#4b5563" }}>{["🥇","🥈","🥉","4","5","6","7","8"][i]||i+1}</td>
                  <td style={{ padding:"9px 10px", fontWeight:600, color:"#c9d1d9" }}>{p.zone}</td>
                  <td style={{ padding:"9px 10px", fontWeight:600, color:ZONE_COLORS[i]||"#00d4ff" }}>{(p.predicted_calls||0).toLocaleString()}</td>
                  <td style={{ padding:"9px 10px", color:"#6b7280" }}>{total?((p.predicted_calls/total)*100).toFixed(1)+"%":"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {res?.error&&<ErrBox msg={res.error}/>}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE: PEAK HOURS
// ══════════════════════════════════════════════════════════
function PeakPage() {
  const [zone,setZone]=useState("Zone 1");
  const [days,setDays]=useState("7");
  const [res,setRes]=useState(null);
  const [load,setLoad]=useState(false);

  async function generate(){
    setLoad(true);setRes(null);
    const d=await callAPI(`${VIZ}/viz/peak/heatmap`,{zone,days:parseInt(days)});
    setRes(d);setLoad(false);
  }

  const cd=res?.chart_data||{};

  return (
    <Card>
      <STitle t="Peak Hours Heatmap"/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:12, marginBottom:16, alignItems:"flex-end" }}>
        <div><Lbl>Zone</Lbl><Sel value={zone} onChange={setZone} options={ZONES}/></div>
        <div><Lbl>Days</Lbl><Sel value={days} onChange={setDays} options={[{v:"3",l:"3 Days"},{v:"5",l:"5 Days"},{v:"7",l:"7 Days"}]} style={{width:120}}/></div>
        <Btn onClick={generate} disabled={load} color="#f59e0b">{load?"Building...":"Generate Heatmap →"}</Btn>
      </div>

      {load&&<Spin text="Building heatmap matrix..."/>}

      {res&&!res.error&&cd.z&&(
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
            <Metric label="Peak Day"  value={res.peak_day||"—"}  color="#f59e0b"/>
            <Metric label="Peak Hour" value={res.peak_hour||"—"} color="#ff6b35"/>
            <Metric label="Zone"      value={zone}                color="#00d4ff"/>
          </div>

          {/* Heatmap grid */}
          <div style={{ background:"#0d1520", borderRadius:8, padding:16, overflowX:"auto" }}>
            <div style={{ fontSize:11, color:"#4b5563", marginBottom:12 }}>Predicted calls per hour — darker = more calls</div>
            {/* Hour labels */}
            <div style={{ display:"flex", marginBottom:4, paddingLeft:64 }}>
              {(cd.x||[]).map((h,i)=>(
                <div key={i} style={{ flex:1, fontSize:7, color:"#374151", textAlign:"center", minWidth:0, overflow:"hidden" }}>
                  {i%4===0?h:""}
                </div>
              ))}
            </div>
            {/* Rows */}
            {(cd.y||[]).map((day,di)=>{
              const row=cd.z?.[di]||[];
              const rmax=Math.max(...row,1);
              return (
                <div key={di} style={{ display:"flex", gap:1, marginBottom:2, alignItems:"center" }}>
                  <div style={{ width:60, fontSize:9, color:"#4b5563", flexShrink:0, overflow:"hidden", whiteSpace:"nowrap" }}>{day.slice(0,10)}</div>
                  {row.map((v,hi)=>{
                    const intensity=v/rmax;
                    return (
                      <div key={hi} title={`${cd.x?.[hi]}: ${v} calls`} style={{
                        flex:1, height:18, minWidth:0,
                        background:`rgba(0,${Math.round(212*(1-intensity)+107*intensity)},${Math.round(255*(1-intensity)+53*intensity)},${0.15+intensity*0.75})`,
                        borderRadius:2, cursor:"default",
                      }}/>
                    );
                  })}
                </div>
              );
            })}
            {/* Legend */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12, fontSize:10, color:"#4b5563" }}>
              <span>Low</span>
              <div style={{ width:120, height:8, background:"linear-gradient(to right,rgba(0,212,255,0.2),rgba(255,107,53,0.85))", borderRadius:4 }}/>
              <span>High</span>
            </div>
          </div>

          <div style={{ marginTop:14, background:"#f59e0b12", border:"1px solid #f59e0b30", borderRadius:8, padding:"12px 14px", fontSize:12, color:"#f59e0b", lineHeight:1.6 }}>
            📊 Peak demand in {zone} expected on <strong>{res.peak_day}</strong> at <strong>{res.peak_hour}</strong>. Ensure maximum availability during 08:00–10:00 and 17:00–19:00.
          </div>
        </>
      )}
      {res?.error&&<ErrBox msg={res.error}/>}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE: ASK AI
// ══════════════════════════════════════════════════════════
function ChatPage() {
  const [msgs,setMsgs]=useState([{role:"assistant",text:"Hello! Ask me anything about ambulance demand or type predictions for any zone."}]);
  const [input,setInput]=useState("");
  const [load,setLoad]=useState(false);

  const QUICK=["Zone 1 demand tomorrow","Breathing problem Zone 2 morning","Which zone is busiest","Cardiac arrest ALS or BLS Zone 1","Compare all zones"];

  async function send(text) {
    const q=(text||input).trim();
    if(!q||load)return;
    setMsgs(m=>[...m,{role:"user",text:q}]);
    setInput("");setLoad(true);
    const ql=q.toLowerCase();
    let ans="";

    try {
      const zone=ZONES.find(z=>ql.includes(z.toLowerCase()))||"Zone 1";
      if(ql.includes("demand")||ql.includes("how many")||ql.includes("calls")||ql.includes("need")){
        const horizon=ql.includes("week")?"week":ql.includes("hour")?"hour":"day";
        const d=await callAPI(`${PRED}/predict/demand`,{zone,horizon});
        if(d.error){ans=d.error;}
        else if(horizon==="week"){ans=`📊 ${zone} needs ${(d.total_week||0).toLocaleString()} calls over 7 days. Daily avg: ${d.daily_average||0}. Peak: ${d.peak_day?.day} with ${d.peak_day?.predicted_calls} calls.`;}
        else{ans=`📊 ${zone} needs ${d.predicted_calls||0} calls ${horizon==="hour"?"next hour":"tomorrow"}.`;}
      } else if(ql.includes("type")||ql.includes("bls")||ql.includes("als")||ql.includes("send")){
        const complaint=COMPLAINTS.find(c=>ql.includes(c.toLowerCase().slice(0,8)))||"Breathing Problems";
        const shift=ql.includes("night")?"Night":ql.includes("afternoon")?"Afternoon":"Morning";
        const d=await callAPI(`${PRED}/predict/type`,{zone,complaint,shift});
        if(d.error){ans=d.error;}
        else{
          const mix=Object.entries(d.mix_per_10_calls||{}).filter(([,v])=>v>0).map(([t,n])=>`${n}x ${t}`).join(", ");
          ans=`🚑 For ${complaint} in ${zone} — send ${d.recommendation} (${d.confidence}% confidence). Per 10 calls: ${mix}.`;
        }
      } else if(ql.includes("busiest")||ql.includes("all zone")||ql.includes("compare")||ql.includes("which zone")){
        const d=await callAPI(`${PRED}/predict/all-zones`,{horizon:"day"});
        if(d.error){ans=d.error;}
        else{
          const top=(d.predictions||[]).slice(0,3).map(p=>`${p.zone}(${p.predicted_calls})`).join(", ");
          ans=`📊 Busiest tomorrow: ${d.busiest_zone}. Total: ${(d.total_system||0).toLocaleString()}. Top 3: ${top}.`;
        }
      } else {
        ans="I can help with demand forecasts, type recommendations, and zone comparisons. Try: 'Zone 1 demand tomorrow' or 'What type for breathing problem in Zone 2?'";
      }
    } catch { ans="Cannot reach the API. Make sure predictive_agent.py is running on port 8000."; }

    setMsgs(m=>[...m,{role:"assistant",text:ans}]);
    setLoad(false);
  }

  return (
    <Card>
      <STitle t="Ask AI — Predictive Assistant"/>
      <div style={{ background:"#0d1520", borderRadius:8, padding:16, minHeight:320, maxHeight:420, overflowY:"auto", marginBottom:14, display:"flex", flexDirection:"column", gap:10 }}>
        {msgs.map((m,i)=>(
          <div key={i} style={{ display:"flex", gap:10, flexDirection:m.role==="user"?"row-reverse":"row" }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:m.role==="user"?"#00d4ff20":"#7c3aed20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
              {m.role==="user"?"👤":"🚑"}
            </div>
            <div style={{ background:m.role==="user"?"#00d4ff15":"#1f2937", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#c9d1d9", maxWidth:"80%", lineHeight:1.65 }}>
              {m.text}
            </div>
          </div>
        ))}
        {load&&(
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", background:"#7c3aed20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🚑</div>
            <div style={{ background:"#1f2937", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#6b7280" }}>Thinking...</div>
          </div>
        )}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:10 }}>
        <input style={{...C.input,flex:1}} value={input} placeholder="Ask about demand, type, or zones..." onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <Btn onClick={()=>send()} disabled={load} color="#7c3aed">Send →</Btn>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {QUICK.map(q=>(
          <button key={q} onClick={()=>send(q)} style={{ fontSize:11, padding:"5px 10px", background:"#0d1520", border:"1px solid #1f2937", borderRadius:20, cursor:"pointer", color:"#6b7280", fontFamily:"inherit" }}>{q}</button>
        ))}
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN APP SHELL
// ══════════════════════════════════════════════════════════
function MainApp({ user, onSignOut }) {
  const [nav,setNav]=useState("dashboard");
  const [apiOk,setApiOk]=useState(null);

  useEffect(()=>{ callAPI(`${PRED}/health`).then(d=>setApiOk(!d.error)); },[]);

  const NAV=[
    {id:"dashboard",icon:"◈",label:"Dashboard"},
    {id:"demand",   icon:"◉",label:"Demand Forecast"},
    {id:"type",     icon:"◎",label:"Ambulance Type"},
    {id:"zones",    icon:"◫",label:"All Zones"},
    {id:"peak",     icon:"◬",label:"Peak Hours"},
    {id:"chat",     icon:"◇",label:"Ask AI"},
  ];

  const Page=()=>{
    if(nav==="dashboard") return <DashboardPage/>;
    if(nav==="demand")    return <DemandPage/>;
    if(nav==="type")      return <TypePage/>;
    if(nav==="zones")     return <ZonesPage/>;
    if(nav==="peak")      return <PeakPage/>;
    if(nav==="chat")      return <ChatPage/>;
    return null;
  };

  const statusColor = apiOk===null?"#f59e0b":apiOk?"#10b981":"#ef4444";
  const statusText  = apiOk===null?"Checking...":apiOk?"API Online":"API Offline";

  return (
    <div style={{ display:"flex", minHeight:"100vh" }}>

      {/* Sidebar */}
      <div style={{ width:210, flexShrink:0, background:"#0a1628", borderRight:"1px solid #1f2937", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, height:"100vh", zIndex:100 }}>
        <div style={{ padding:16, borderBottom:"1px solid #1f2937", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:"#00d4ff12", border:"1px solid #00d4ff25", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🚑</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#e5e7eb" }}>SIEHS</div>
            <div style={{ fontSize:9, color:"#374151", letterSpacing:"0.06em" }}>ANALYTICS SYSTEM</div>
          </div>
        </div>
        <nav style={{ flex:1, paddingTop:8 }}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>setNav(n.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", cursor:"pointer", fontSize:13, color:nav===n.id?"#00d4ff":"#6b7280", background:nav===n.id?"#00d4ff0d":"transparent", borderLeft:`2px solid ${nav===n.id?"#00d4ff":"transparent"}`, transition:"all 0.12s" }}>
              <span style={{ fontSize:14 }}>{n.icon}</span>{n.label}
            </div>
          ))}
        </nav>
        <div style={{ padding:14, borderTop:"1px solid #1f2937" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"#00d4ff22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#00d4ff" }}>
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:"#c9d1d9" }}>{user.username}</div>
              <div style={{ fontSize:10, color:"#4b5563" }}>{user.role}</div>
            </div>
          </div>
          <button onClick={onSignOut} style={{ width:"100%", padding:7, fontSize:12, color:"#6b7280", background:"transparent", border:"1px solid #1f2937", borderRadius:7, cursor:"pointer", fontFamily:"inherit" }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ marginLeft:210, flex:1, display:"flex", flexDirection:"column" }}>
        <div style={{ background:"#0a1628", borderBottom:"1px solid #1f2937", padding:"0 24px", height:54, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#e5e7eb" }}>{NAV.find(n=>n.id===nav)?.label}</div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:statusColor, boxShadow:`0 0 6px ${statusColor}` }}/>
            <span style={{ fontSize:12, color:statusColor }}>{statusText}</span>
          </div>
        </div>
        <div style={{ padding:24, flex:1 }}><Page/></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]=useState(null);
  return user
    ? <MainApp user={user} onSignOut={()=>setUser(null)}/>
    : <LoginPage onLogin={setUser}/>;
}
