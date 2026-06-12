if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/static/sw.js').catch(() => {});
}

/* ─── NEURAL NET BACKGROUND ──────────────────────────────────────────────── */
(function () {
  const cv = document.getElementById('bg-canvas'), ctx = cv.getContext('2d');
  const N = 36, D = 165;
  let W, H, nodes = [];
  function init() {
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
    nodes = Array.from({length:N}, () => ({
      x:Math.random()*W, y:Math.random()*H,
      vx:(Math.random()-.5)*.26, vy:(Math.random()-.5)*.26,
      r:Math.random()*1.1+.4,
      violet:Math.random() > .4,
    }));
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    nodes.forEach(n => {
      n.x+=n.vx; n.y+=n.vy;
      if(n.x<0||n.x>W)n.vx*=-1; if(n.y<0||n.y>H)n.vy*=-1;
    });
    for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){
      const dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<D){
        const a=(1-d/D)*.038;
        ctx.strokeStyle=`rgba(124,58,237,${a})`;
        ctx.lineWidth=.5; ctx.beginPath();
        ctx.moveTo(nodes[i].x,nodes[i].y); ctx.lineTo(nodes[j].x,nodes[j].y); ctx.stroke();
      }
    }
    nodes.forEach(n=>{
      ctx.fillStyle=n.violet?'rgba(124,58,237,0.07)':'rgba(6,182,212,0.04)';
      ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  init(); draw(); window.addEventListener('resize',init);
})();

/* ─── BOOT SEQUENCE ──────────────────────────────────────────────────────── */
(function () {
  const LINES = [
    ['> FACEID SYS/2.0 INITIALIZING...','c-cyan',0],
    ['> ─────────────────────────────────────────','c-muted',120],
    ['> Loading InsightFace engine (buffalo_l)...','c-text',280],
    ['> Detection : RetinaFace  [640×640]','c-text',500],
    ['> Embedding : ArcFace  [512-dim cosine]','c-text',680],
    ['> Inference : ONNX Runtime — CPU mode','c-text',860],
    ['> Database  : SQLite — loading indices...','c-text',1040],
    ['> HTTP      : FastAPI + Uvicorn','c-text',1180],
    ['> ','c-muted',1280],
    ['> [████████████████████] 100%  ALL SYSTEMS GO','c-green',1360],
    ['> ','c-muted',1500],
    ['> ACCESS GRANTED','c-white',1560],
  ];
  const el = document.getElementById('boot-lines');
  LINES.forEach(([t,c,d]) => setTimeout(() => {
    const div = document.createElement('div');
    div.className = 'boot-line '+c; div.textContent = t; el.appendChild(div);
  }, d));
  setTimeout(() => {
    document.getElementById('boot-cursor').style.display='none';
    const boot = document.getElementById('boot');
    boot.classList.add('hide');
    document.getElementById('app').classList.add('visible');
    boot.addEventListener('transitionend', () => boot.remove(), {once:true});
  }, 2360);
})();

/* ─── HUD TICKER ─────────────────────────────────────────────────────────── */
(function () {
  const el = document.getElementById('hud-stream');
  const r4 = () => Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0');
  const up = () => { el.textContent = `0x${r4()} · SEQ:${Math.floor(Math.random()*999).toString().padStart(3,'0')}`; };
  up(); setInterval(up, 2800);
})();

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function toast(msg, ok=true) {
  const t=$('toast'); t.textContent=msg;
  t.style.borderColor=ok?'rgba(16,185,129,.25)':'rgba(239,68,68,.25)';
  t.classList.add('show'); clearTimeout(toast._t);
  toast._t=setTimeout(()=>t.classList.remove('show'),2800);
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showErr(id,msg) {
  const el=$(id); el.textContent='⚠ '+msg; el.classList.add('show');
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
}
function countUp(el, end, dur, dec, suf) {
  const t0=performance.now();
  (function f(now){
    const p=Math.min((now-t0)/dur,1), e=1-Math.pow(1-p,3);
    el.textContent=(end*e).toFixed(dec)+suf;
    if(p<1)requestAnimationFrame(f);
  })(performance.now());
}
function typewriter(el, text, speed, done) {
  el.textContent=''; let i=0;
  (function n(){ if(i<text.length){el.textContent+=text[i++];setTimeout(n,speed);}else if(done)done(); })();
}
function triggerScan(zoneId) {
  const z=$(zoneId), l=document.createElement('div');
  l.className='scan-line'; z.appendChild(l);
  l.addEventListener('animationend',()=>l.remove(),{once:true});
}
function addRipple(e, btn) {
  const r=btn.getBoundingClientRect(), s=Math.max(r.width,r.height);
  const x=(e.clientX||r.left+r.width/2)-r.left-s/2;
  const y=(e.clientY||r.top+r.height/2)-r.top-s/2;
  const el=document.createElement('span');
  el.style.cssText=`position:absolute;border-radius:50%;background:rgba(255,255,255,.12);transform:scale(0);animation:ripple .5s linear forwards;width:${s}px;height:${s}px;left:${x}px;top:${y}px;pointer-events:none`;
  const sheet=document.createElement('style');
  if(!document.getElementById('ripple-kf')){
    sheet.id='ripple-kf'; sheet.textContent='@keyframes ripple{to{transform:scale(3.5);opacity:0;}}';
    document.head.appendChild(sheet);
  }
  btn.appendChild(el); el.addEventListener('animationend',()=>el.remove(),{once:true});
}
function gridPulse() {
  const g=$('grid'); g.classList.remove('pulse'); void g.offsetWidth; g.classList.add('pulse');
}
function hudProc(ms) {
  const el=$('hud-stream'), c=el.textContent;
  el.textContent=c.replace(/SEQ:\d+/,`PROC:${ms}ms`);
}

/* ─── HEALTH CHECK ───────────────────────────────────────────────────────── */
async function checkHealth() {
  try {
    const r=await fetch('/api/health');
    if(r.ok){$('status-dot').className='online';$('status-text').textContent='ONLINE';}
    else throw 0;
  } catch {
    $('status-dot').className='offline';$('status-text').textContent='OFFLINE';
  }
}
checkHealth(); setInterval(checkHealth,30000);

/* ─── TABS ───────────────────────────────────────────────────────────────── */
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  $('tab-'+name).classList.add('active');
  btn.classList.add('active');
}

/* ─── FILE UPLOAD / DRAG-DROP ────────────────────────────────────────────── */
function onFileChange(inputId, prevId, phId, zoneId) {
  const file=$(inputId).files[0]; if(!file)return;
  const prev=$(prevId);
  prev.src=URL.createObjectURL(file);
  prev.classList.add('active');
  $(phId).style.display='none';
  if(zoneId){ $(zoneId).classList.add('has-image'); triggerScan(zoneId); }
}
function onDragOver(e,zoneId){ e.preventDefault(); $(zoneId).classList.add('drag-over'); }
function onDragLeave(zoneId) { $(zoneId).classList.remove('drag-over'); }
function onDrop(e,zoneId,inputId,prevId,phId) {
  e.preventDefault(); $(zoneId).classList.remove('drag-over');
  const f=e.dataTransfer.files[0]; if(!f||!f.type.startsWith('image/'))return;
  const dt=new DataTransfer(); dt.items.add(f); $(inputId).files=dt.files;
  onFileChange(inputId,prevId,phId,zoneId);
}

/* ─── BUTTON STATE ───────────────────────────────────────────────────────── */
function setBusy(btnId,icoId,spinId,txtId,busy,idle) {
  $(btnId).disabled=busy;
  busy?$(icoId).classList.add('hidden'):$(icoId).classList.remove('hidden');
  busy?$(spinId).classList.remove('hidden'):$(spinId).classList.add('hidden');
  $(txtId).textContent=busy?'Processing…':idle;
}

/* ─── ZONE CANVAS ────────────────────────────────────────────────────────── */
const _zoneRafs = {};

function _project(nx, ny, imgEl, canvas) {
  const iW = imgEl.naturalWidth  || canvas.offsetWidth;
  const iH = imgEl.naturalHeight || canvas.offsetHeight;
  const bW = canvas.offsetWidth;
  const bH = canvas.offsetHeight;
  const s  = Math.max(bW/iW, bH/iH);
  return { x: nx*iW*s + (bW-iW*s)/2, y: ny*iH*s + (bH-iH*s)/2 };
}

function animateZoneCanvas(canvasId, imgId, spatial, color) {
  if(_zoneRafs[canvasId]){ cancelAnimationFrame(_zoneRafs[canvasId]); }
  const canvas=$(canvasId), imgEl=$(imgId);
  if(!canvas||!imgEl||!spatial||!spatial.landmarks)return;

  const dpr = Math.min(window.devicePixelRatio||1,2);
  const W=canvas.offsetWidth, H=canvas.offsetHeight;
  canvas.width=W*dpr; canvas.height=H*dpr;
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);

  const pts=spatial.landmarks.map(([nx,ny])=>_project(nx,ny,imgEl,canvas));
  const sorted=[...pts.map((p,i)=>({...p,i}))].sort((a,b)=>a.y-b.y);

  const bW=(spatial.bbox[2]-spatial.bbox[0])*W;
  const edgeDist=bW*(spatial.lm_count===106?0.13:0.26);
  const edges=[];
  for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
    if(Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y)<edgeDist) edges.push([i,j]);
  }

  const [r,g,b]=color;
  const T_D=700,T_E=1400,T_HOLD=2200;
  const t0=performance.now();

  function frame(now){
    const el=now-t0;
    ctx.clearRect(0,0,W,H);

    const dotFrac=Math.min(1,(1-Math.pow(1-Math.min(el/T_D,1),3)));
    const edgeFrac=el>T_D?Math.min(1,(1-Math.pow(1-Math.min((el-T_D)/(T_E-T_D),1),3))):0;

    const ne=Math.floor(edges.length*edgeFrac);
    ctx.lineWidth=0.5;
    for(let i=0;i<ne;i++){
      ctx.strokeStyle=`rgba(${r},${g},${b},.35)`;
      ctx.beginPath();
      ctx.moveTo(pts[edges[i][0]].x,pts[edges[i][0]].y);
      ctx.lineTo(pts[edges[i][1]].x,pts[edges[i][1]].y);
      ctx.stroke();
    }

    const nd=Math.floor(sorted.length*dotFrac);
    for(let i=0;i<nd;i++){
      const p=pts[sorted[i].i];
      ctx.beginPath();
      ctx.fillStyle=`rgba(${r},${g},${b},.80)`;
      ctx.arc(p.x,p.y,1.4,0,Math.PI*2);
      ctx.fill();
    }

    if(el<T_HOLD){ _zoneRafs[canvasId]=requestAnimationFrame(frame); }
    else {
      ctx.clearRect(0,0,W,H);
      edges.forEach(([ai,bi])=>{
        ctx.strokeStyle=`rgba(${r},${g},${b},.12)`;
        ctx.lineWidth=0.5; ctx.beginPath();
        ctx.moveTo(pts[ai].x,pts[ai].y); ctx.lineTo(pts[bi].x,pts[bi].y); ctx.stroke();
      });
      pts.forEach(p=>{
        ctx.beginPath();
        ctx.fillStyle=`rgba(${r},${g},${b},.40)`;
        ctx.arc(p.x,p.y,1.2,0,Math.PI*2);
        ctx.fill();
      });
    }
  }
  _zoneRafs[canvasId]=requestAnimationFrame(frame);
}

/* ─── MESH CANVAS ────────────────────────────────────────────────────────── */
const _ease3 = t => 1-Math.pow(1-t,3);
const _easeIO = t => t<.5?2*t*t:1-2*(1-t)*(1-t);
const _rgba = (r,g,b,a) => `rgba(${r},${g},${b},${a})`;
const _lerp3 = (c1,c2,t) => c1.map((v,i)=>Math.round(v+(c2[i]-v)*t));
let _meshRaf=null;

function _buildMesh(spatial) {
  const {landmarks,lm_count,bbox}=spatial;
  const [bx1,by1,bx2,by2]=bbox;
  const bw=bx2-bx1,bh=by2-by1,bcx=(bx1+bx2)/2,bcy=(by1+by2)/2;
  let pts;
  if(lm_count===106){
    pts=landmarks.map(([x,y])=>({x,y,kp:false}));
  } else {
    pts=landmarks.map(([x,y])=>({x,y,kp:true}));
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){
      const nx=(c/8)*2-1,ny=(r/9)*2-1;
      const rx=0.88-Math.abs(ny)*.18;
      if((nx*nx)/(rx*rx)+ny*ny>1)continue;
      const jx=Math.sin(r*17.3+c*31.7)*bw*.025;
      const jy=Math.cos(r*29.1+c*13.9)*bh*.02;
      const px=bcx+nx*bw*.46+jx,py=bcy+ny*bh*.51+jy;
      if(pts.every(p=>Math.hypot(p.x-px,p.y-py)>bw*.07)) pts.push({x:px,y:py,kp:false});
    }
  }
  pts.sort((a,b)=>a.y-b.y);
  const edgeDist=lm_count===106?bw*.12:bw*.20;
  const edges=[];
  for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
    if(Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y)<edgeDist) edges.push([i,j]);
  }
  return {pts,edges,bcx,bcy,bw,bh};
}

function _plotPt(pt,mesh,cx,cy,sc){return{x:cx+(pt.x-mesh.bcx)*sc,y:cy+(pt.y-mesh.bcy)*sc};}

function _drawMesh(ctx,mesh,cx,cy,sc,col,dotA,edgeA,dotFrac,edgeFrac){
  const {pts,edges}=mesh;
  const ne=Math.floor(edges.length*edgeFrac);
  ctx.lineWidth=0.55;
  for(let i=0;i<ne;i++){
    const a=_plotPt(pts[edges[i][0]],mesh,cx,cy,sc);
    const b=_plotPt(pts[edges[i][1]],mesh,cx,cy,sc);
    ctx.strokeStyle=_rgba(...col,edgeA*.35); ctx.beginPath();
    ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  const nd=Math.floor(pts.length*dotFrac);
  for(let i=0;i<nd;i++){
    const p=_plotPt(pts[i],mesh,cx,cy,sc);
    const rv=pts[i].kp?2.6:1.2;
    ctx.beginPath(); ctx.fillStyle=_rgba(...col,dotA);
    if(pts[i].kp){ctx.shadowColor=_rgba(...col,0.8);ctx.shadowBlur=6;}
    ctx.arc(p.x,p.y,rv,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  }
}

function animateMesh(spatial1, spatial2, isMatch, onReady) {
  if(_meshRaf){cancelAnimationFrame(_meshRaf);_meshRaf=null;}
  const canvas=$('mesh-canvas'), ctx=canvas.getContext('2d');
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const WCSS=canvas.offsetWidth||320, HCSS=230;
  canvas.width=WCSS*dpr; canvas.height=HCSS*dpr; canvas.style.height=HCSS+'px';
  ctx.scale(dpr,dpr); const cw=WCSS,ch=HCSS;

  const m1=_buildMesh(spatial1), m2=_buildMesh(spatial2);
  const pad=1.35;
  const s1=Math.min((cw*.41)/(m1.bw*pad),(ch*.8)/(m1.bh*pad));
  const s2=Math.min((cw*.41)/(m2.bw*pad),(ch*.8)/(m2.bh*pad));
  const sc=Math.min(s1,s2);
  const CY=ch*.5,CXL=cw*.25,CXR=cw*.75,CXC=cw*.5;
  const C1=[124,58,237],C2=[6,182,212],CM=isMatch?[16,185,129]:[239,68,68];
  const T1=700,T2=1400,T3=1900,T4=2500;
  let fired=false; const t0=performance.now();

  function frame(now){
    const el=now-t0;
    ctx.clearRect(0,0,cw,ch);
    ctx.fillStyle='rgba(2,6,23,.55)'; ctx.fillRect(0,0,cw,ch);

    let cx1,cx2,col1=C1,col2=C2,dF1,dF2,eF1=0,eF2=0,dA=.9,eA=.9;

    if(el<T1){ const p=_ease3(el/T1); cx1=CXL;cx2=CXR; dF1=dF2=p; }
    else if(el<T2){ const p=_ease3((el-T1)/(T2-T1)); cx1=CXL;cx2=CXR; dF1=dF2=1;eF1=eF2=p; }
    else if(el<T3){
      const p=_easeIO((el-T2)/(T3-T2));
      cx1=CXL+(CXC-CXL)*p; cx2=CXR-(CXR-CXC)*p; dF1=dF2=eF1=eF2=1;
      if(!fired&&p>.6){fired=true;onReady&&onReady();}
    } else if(el<T4){
      const p=(el-T3)/(T4-T3); cx1=cx2=CXC; dF1=dF2=eF1=eF2=1;
      col1=_lerp3(C1,CM,p); col2=_lerp3(C2,CM,p);
      if(!fired){fired=true;onReady&&onReady();}
    } else {
      cx1=cx2=CXC; dF1=dF2=eF1=eF2=1; col1=col2=CM;
      const pulse=.55+.35*Math.sin((el-T4)/550*Math.PI); dA=pulse;eA=pulse*.75;
    }

    if(el<T2){
      const a=Math.max(0,1-el/T2)*.22;
      ctx.strokeStyle=`rgba(124,58,237,${a})`; ctx.lineWidth=.5;
      ctx.setLineDash([3,6]); ctx.beginPath();
      ctx.moveTo(cw/2,12); ctx.lineTo(cw/2,ch-12); ctx.stroke(); ctx.setLineDash([]);
    }
    if(el<T3){
      const fadeIn=Math.min(1,el/150),fadeOut=Math.max(0,1-(el-T2)/(T3-T2)*1.5);
      const a=fadeIn*fadeOut;
      ctx.font='9px "Fira Code","Courier New"'; ctx.textAlign='center';
      ctx.fillStyle=_rgba(...C1,a*.65); ctx.fillText('SUBJECT 01',CXL,14);
      ctx.fillStyle=_rgba(...C2,a*.65); ctx.fillText('SUBJECT 02',CXR,14);
    }

    ctx.font='9px "Fira Code","Courier New"'; ctx.textAlign='center';
    if(el<T1){ctx.fillStyle='rgba(124,58,237,.40)';ctx.fillText('PROJECTING DOT MATRIX...',cw/2,ch-9);}
    else if(el<T2){ctx.fillStyle='rgba(124,58,237,.40)';ctx.fillText('CONSTRUCTING BIOMETRIC MESH...',cw/2,ch-9);}
    else if(el<T3){ctx.fillStyle='rgba(124,58,237,.40)';ctx.fillText('ALIGNING FACIAL VECTORS...',cw/2,ch-9);}
    else if(el<T4){ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillText('COMPARING BIOMETRIC SIGNATURES...',cw/2,ch-9);}
    else{
      const pulse=.5+.45*Math.abs(Math.sin((el-T4)/420));
      ctx.fillStyle=_rgba(...CM,pulse);
      ctx.fillText(isMatch?'— IDENTITY CONFIRMED —':'— IDENTITY MISMATCH —',cw/2,ch-9);
    }

    _drawMesh(ctx,m1,cx1,CY,sc,col1,dA,eA,dF1,eF1);
    _drawMesh(ctx,m2,cx2,CY,sc,col2,dA,eA,dF2,eF2);
    _meshRaf=requestAnimationFrame(frame);
  }
  _meshRaf=requestAnimationFrame(frame);
}

let _singleRaf=null;
function animateSingleMesh(canvasId, spatial, color, statusLines, onDone) {
  if(_singleRaf){cancelAnimationFrame(_singleRaf);_singleRaf=null;}
  const canvas=$(canvasId), ctx=canvas.getContext('2d');
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const WCSS=canvas.offsetWidth||300, HCSS=180;
  canvas.width=WCSS*dpr; canvas.height=HCSS*dpr; canvas.style.height=HCSS+'px';
  ctx.scale(dpr,dpr); const cw=WCSS,ch=HCSS;

  const mesh=_buildMesh(spatial);
  const pad=1.4;
  const sc=Math.min((cw*.7)/(mesh.bw*pad),(ch*.75)/(mesh.bh*pad));
  const cx=cw*.5,cy=ch*.5;
  const [r,g,b]=color;
  const T1=700,T2=1400,T3=2000;
  const t0=performance.now();

  function frame(now){
    const el=now-t0;
    ctx.clearRect(0,0,cw,ch);
    ctx.fillStyle='rgba(2,6,23,.55)'; ctx.fillRect(0,0,cw,ch);

    const dotFrac=Math.min(1,_ease3(el/T1));
    const edgeFrac=el>T1?Math.min(1,_ease3((el-T1)/(T2-T1))):0;

    _drawMesh(ctx,mesh,cx,cy,sc,[r,g,b],.9,.9,dotFrac,edgeFrac);

    ctx.font='9px "Fira Code","Courier New"'; ctx.textAlign='center';
    if(statusLines&&statusLines.length){
      const si=Math.min(Math.floor(el/(T3/statusLines.length)),statusLines.length-1);
      ctx.fillStyle=`rgba(${r},${g},${b},.45)`;
      ctx.fillText(statusLines[si],cw/2,ch-9);
    }

    if(el<T3){ _singleRaf=requestAnimationFrame(frame); }
    else {
      (function pulse(){
        const t=performance.now()-t0-T3;
        ctx.clearRect(0,0,cw,ch);
        ctx.fillStyle='rgba(2,6,23,.55)'; ctx.fillRect(0,0,cw,ch);
        const p=.55+.35*Math.sin(t/600*Math.PI);
        _drawMesh(ctx,mesh,cx,cy,sc,[r,g,b],p,p*.75,1,1);
        ctx.font='9px "Fira Code","Courier New"'; ctx.textAlign='center';
        if(statusLines&&statusLines.length){
          ctx.fillStyle=`rgba(${r},${g},${b},.40)`;
          ctx.fillText(statusLines[statusLines.length-1],cw/2,ch-9);
        }
        _singleRaf=requestAnimationFrame(pulse);
      })();
      if(onDone) onDone();
    }
  }
  _singleRaf=requestAnimationFrame(frame);
}

/* ─── COMPARE ────────────────────────────────────────────────────────────── */
async function doCompare(e) {
  addRipple(e,$('cmp-btn'));
  const f1=$('file1').files[0], f2=$('file2').files[0];
  $('cmp-err').classList.remove('show');
  $('cmp-result').classList.remove('show');
  hide('mesh-wrap');

  if(!f1){showErr('cmp-err','Please upload Subject 1 image.');return;}
  if(!f2){showErr('cmp-err','Please upload Subject 2 image.');return;}

  setBusy('cmp-btn','cmp-ico','cmp-spin','cmp-txt',true,'Run Comparison');
  $('zone1').classList.add('analyzing');
  $('zone2').classList.add('analyzing');
  gridPulse();

  const t0=performance.now();
  try {
    const fd=new FormData();
    fd.append('image1',f1); fd.append('image2',f2);
    const res=await fetch('/api/compare',{method:'POST',body:fd});
    const d=await res.json();
    if(!res.ok){showErr('cmp-err',d.detail||'Server error');return;}
    hudProc(Math.round(performance.now()-t0));
    _renderCompare(d);
  } catch { showErr('cmp-err','Network error — is the server reachable?'); }
  finally {
    setBusy('cmp-btn','cmp-ico','cmp-spin','cmp-txt',false,'Run Comparison');
    $('zone1').classList.remove('analyzing');
    $('zone2').classList.remove('analyzing');
  }
}

function _showBanner(d) {
  const pct=d.similarity_pct;
  const el=$('cmp-result');
  const matchClass=d.is_match?(pct>=60?'match':'likely'):'nomatch';
  el.className='result-panel show '+matchClass;

  const color=d.is_match?(pct>=60?'var(--green)':'var(--amber)'):'var(--red)';
  const badgeClass=d.is_match?(pct>=60?'badge-success':'badge-warning'):'badge-danger';
  const badgeText=d.is_match?(pct>=60?'High Match':'Likely Match'):'No Match';
  const b=$('r-badge');
  b.className='badge '+badgeClass;
  b.textContent=badgeText;

  const pe=$('r-pct'); pe.style.color=color;
  countUp(pe,pct,1200,1,'%');
  const ve=$('r-verdict'); ve.style.color=color;
  typewriter(ve,d.label,38);
  $('r-conf').textContent=d.confidence+' confidence · cosine '+d.similarity.toFixed(4);
  $('r-fc1').textContent=d.face_count_1; $('r-fc2').textContent=d.face_count_2;
  $('r-ds1').textContent=d.det_score_1;  $('r-ds2').textContent=d.det_score_2;
  const m=$('r-meter'); m.style.background=color; m.style.width='0%';
  setTimeout(()=>{m.style.width=Math.min(pct,100)+'%';},80);
}

function _renderCompare(d) {
  $('cmp-result').classList.remove('show'); hide('mesh-wrap');
  if(d.face1_spatial) animateZoneCanvas('zc1','prev1',d.face1_spatial,[124,58,237]);
  if(d.face2_spatial) animateZoneCanvas('zc2','prev2',d.face2_spatial,[6,182,212]);
  if(d.face1_spatial&&d.face2_spatial) {
    show('mesh-wrap');
    animateMesh(d.face1_spatial,d.face2_spatial,d.is_match,()=>_showBanner(d));
  } else {
    _showBanner(d);
  }
}

/* ─── ENROLL ─────────────────────────────────────────────────────────────── */
async function doEnroll(e) {
  addRipple(e,$('enr-btn'));
  const file=$('file-enr').files[0], name=$('enr-name').value.trim();
  $('enr-err').classList.remove('show'); $('enr-ok').classList.remove('show');

  if(!file){showErr('enr-err','Please upload a face photo.');return;}
  if(!name){showErr('enr-err','Please enter a name or ID.');return;}

  setBusy('enr-btn','enr-ico','enr-spin','enr-txt',true,'Enroll to Database');
  $('zone-enr').classList.add('analyzing');
  gridPulse();

  try {
    const fd=new FormData(); fd.append('image',file); fd.append('name',name);
    const res=await fetch('/api/add',{method:'POST',body:fd});
    const d=await res.json();
    if(!res.ok){showErr('enr-err',d.detail||'Server error');return;}

    if(d.face_spatial) animateZoneCanvas('zc-enr','prev-enr',d.face_spatial,[16,185,129]);

    $('zone-enr').classList.add('success-glow');
    $('zone-enr').addEventListener('animationend',()=>$('zone-enr').classList.remove('success-glow'),{once:true});

    const ok=$('enr-ok'); ok.classList.add('show');
    typewriter(ok,'✓ '+d.name+' enrolled — ID #'+d.id,22);
    toast('Subject enrolled');

    fetch('/api/faces').then(r=>r.json()).then(faces=>{
      const n=faces.length;
      $('db-nav-badge').textContent=n;
      $('db-nav-badge').classList.toggle('show',n>0);
    }).catch(()=>{});

    setTimeout(()=>{
      $('file-enr').value='';
      $('prev-enr').classList.remove('active');
      $('prev-enr').src='';
      $('ph-enr').style.display='';
      $('zone-enr').classList.remove('has-image');
      $('enr-name').value='';
      const zc=$('zc-enr'); if(zc)zc.getContext('2d').clearRect(0,0,zc.width,zc.height);
    },3500);
  } catch { showErr('enr-err','Network error.'); }
  finally {
    setBusy('enr-btn','enr-ico','enr-spin','enr-txt',false,'Enroll to Database');
    $('zone-enr').classList.remove('analyzing');
  }
}

/* ─── IDENTIFY ───────────────────────────────────────────────────────────── */
async function doIdentify(e) {
  addRipple(e,$('id-btn'));
  const file=$('file-id').files[0];
  $('id-err').classList.remove('show');
  hide('id-results'); hide('id-mesh-wrap');

  if(!file){showErr('id-err','Please upload a face photo.');return;}

  setBusy('id-btn','id-ico','id-spin','id-txt',true,'Search Database');
  $('zone-id').classList.add('analyzing');
  gridPulse();

  const t0=performance.now();
  try {
    const fd=new FormData(); fd.append('image',file);
    const res=await fetch('/api/search',{method:'POST',body:fd});
    const d=await res.json();
    if(!res.ok){showErr('id-err',d.detail||'Server error');return;}
    hudProc(Math.round(performance.now()-t0));

    if(d.face_spatial) animateZoneCanvas('zc-id','prev-id',d.face_spatial,[124,58,237]);

    if(d.face_spatial){
      show('id-mesh-wrap');
      animateSingleMesh('id-mesh-canvas',d.face_spatial,[124,58,237],
        ['SCANNING BIOMETRIC FEATURES...','QUERYING DATABASE...','RANKING MATCHES...'],
        ()=>_renderIdResults(d)
      );
    } else { _renderIdResults(d); }
  } catch { showErr('id-err','Network error.'); }
  finally {
    setBusy('id-btn','id-ico','id-spin','id-txt',false,'Search Database');
    $('zone-id').classList.remove('analyzing');
  }
}

function _renderIdResults(d) {
  $('id-count').textContent=d.total;
  const list=$('id-list'); list.innerHTML='';

  if(d.total===0){
    list.innerHTML='<p style="text-align:center;color:var(--muted);font-size:13px;padding:24px 0">No matches found in database.</p>';
  } else {
    d.matches.forEach((m,i)=>{
      const color=m.is_match?(m.similarity_pct>=60?'var(--green)':'var(--amber)'):'var(--red)';
      const row=document.createElement('div');
      row.className='match-row';
      row.style.animationDelay=(i*60)+'ms';
      row.innerHTML=`
        <div class="match-rank">#${i+1}</div>
        ${m.image_url
          ?`<img class="match-thumb" src="${escHtml(m.image_url)}" alt="">`
          :`<div class="match-no-av"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M3 21c0-4 4-7 9-7s9 3 9 7" stroke-linecap="round"/></svg></div>`}
        <div style="flex:1;min-width:0">
          <div class="match-name">${escHtml(m.name)}</div>
          <div class="match-conf">${escHtml(m.label)} · ${escHtml(m.confidence)} confidence</div>
        </div>
        <div class="match-pct" style="color:${color}">${m.similarity_pct.toFixed(1)}%</div>`;
      list.appendChild(row);
    });
  }
  show('id-results');
}

/* ─── DATABASE ───────────────────────────────────────────────────────────── */
let _faces=[];
async function loadDb() {
  try {
    const res=await fetch('/api/faces'); _faces=await res.json(); renderDb(_faces);
  } catch { toast('Failed to load database',false); }
}
function renderDb(faces){
  const grid=$('face-grid');
  const n=faces.length;
  $('db-badge').textContent=n+' enrolled';
  $('db-nav-badge').textContent=n;
  $('db-nav-badge').classList.toggle('show',n>0);
  grid.innerHTML='';
  if(!n){show('db-empty');return;}
  hide('db-empty');
  faces.forEach((f,i)=>{
    const card=document.createElement('div');
    card.className='face-card'; card.dataset.name=f.name.toLowerCase();
    card.style.animationDelay=(i*40)+'ms';
    const date=new Date(f.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'2-digit'});
    card.innerHTML=`
      ${f.image_url
        ?`<img src="${escHtml(f.image_url)}" alt="${escHtml(f.name)}">`
        :`<div class="no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="8" r="4"/><path d="M3 21c0-4 4-7 9-7s9 3 9 7" stroke-linecap="round"/></svg></div>`}
      <div class="face-card-info">
        <div class="face-card-name">${escHtml(f.name)}</div>
        <div class="face-card-meta"><span>${date}</span><span>#${f.id}</span></div>
      </div>
      <button class="face-card-del" onclick="deleteFace(${f.id},this)" title="Delete">✕</button>`;
    grid.appendChild(card);
  });
}
function filterDb(q){renderDb(q?_faces.filter(f=>f.name.toLowerCase().includes(q.toLowerCase())):_faces);}
async function deleteFace(id,btn){
  if(!confirm('Remove this subject from the database?'))return;
  btn.disabled=true;
  try {
    const res=await fetch('/api/faces/'+id,{method:'DELETE'});
    if(res.ok){toast('Subject removed');loadDb();}
    else{toast('Delete failed',false);btn.disabled=false;}
  } catch{toast('Network error',false);btn.disabled=false;}
}

loadDb();
