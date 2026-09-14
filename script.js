const STORAGE_KEY = "jceDefensaNotaV2";
let app = loadApp();
let activeView = "dashboard";
let spinning = false;
let wheelRotation = 0;

function uid(prefix="id"){
  return prefix + "-" + Math.random().toString(36).slice(2,9) + "-" + Date.now().toString(36);
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function loadApp(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.activities?.length) return parsed;
    }
  }catch(e){}
  const activity = normalizeActivity(clone(SEED_ACTIVITY));
  return {activities:[activity], activeActivityId:activity.id};
}
function saveApp(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(app)); }
function normalizeActivity(a){
  a.id ||= uid("act");
  a.initialScore = Number(a.initialScore ?? 5);
  a.penalty = Number(a.penalty ?? .5);
  a.questionsPerGroup = Number(a.questionsPerGroup ?? 5);
  a.groups = (a.groups || []).map((g,i)=>({
    id:g.id ?? i+1,
    nombre:g.nombre || `Grupo ${i+1}`,
    color:g.color || "#4f46e5",
    integrantes:g.integrantes || [],
    preguntas:Array.from({length:a.questionsPerGroup},(_,q)=>g.preguntas?.[q] || ""),
    respuestas:Array.from({length:a.questionsPerGroup},(_,q)=>g.respuestas?.[q] || null)
  }));
  if(!a.game) a.game = {schedule:[],currentTurn:0,history:[],started:false,completed:false};
  return a;
}
function currentActivity(){ return app.activities.find(a=>a.id===app.activeActivityId) || app.activities[0]; }
function score(g,a){
  const incorrect = (g.respuestas||[]).filter(x=>x==="incorrect").length;
  return Math.max(0, a.initialScore - incorrect*a.penalty);
}
function answered(g){ return (g.respuestas||[]).filter(Boolean).length; }
function completeQuestions(g,a){ return answered(g) >= a.questionsPerGroup; }
function allQuestionsReady(a){ return a.groups.every(g=>g.preguntas.every(q=>q.trim())); }
function scheduleLength(a){ return a.groups.length * a.questionsPerGroup; }

function generateSchedule(a){
  const n=a.groups.length, q=a.questionsPerGroup;
  if(n<2 || q<1) return [];
  const ids = shuffle(a.groups.map(g=>g.id));
  const possibleShifts = shuffle(Array.from({length:n-1},(_,i)=>i+1));
  const shifts=[];
  for(let r=0;r<q;r++) shifts.push(possibleShifts[r % possibleShifts.length]);

  const questionOrders = {};
  a.groups.forEach(g=> questionOrders[g.id]=shuffle(Array.from({length:q},(_,i)=>i)));

  const turns=[];
  for(let r=0;r<q;r++){
    const shift=shifts[r];
    for(let i=0;i<n;i++){
      const asker=ids[i];
      const receiver=ids[(i+shift)%n];
      turns.push({
        id:uid("turn"),
        round:r+1,
        askerId:asker,
        receiverId:receiver,
        questionIndex:questionOrders[receiver][r]
      });
    }
  }
  return shuffle(turns);
}
function resetGame(a){
  a.groups.forEach(g=>g.respuestas=Array.from({length:a.questionsPerGroup},()=>null));
  a.game={schedule:generateSchedule(a),currentTurn:0,history:[],started:false,completed:false};
  saveApp(); renderAll(); showToast("Ronda reiniciada.");
}
function ensureSchedule(a){
  if(!a.game.schedule || a.game.schedule.length!==scheduleLength(a)){
    a.game.schedule=generateSchedule(a);
    a.game.currentTurn=0;a.game.history=[];a.game.started=false;a.game.completed=false;
    a.groups.forEach(g=>g.respuestas=Array.from({length:a.questionsPerGroup},()=>null));
    saveApp();
  }
}
function groupById(a,id){ return a.groups.find(g=>String(g.id)===String(id)); }
function groupIndex(a,id){ return a.groups.findIndex(g=>String(g.id)===String(id)); }
function groupName(a,id){ return groupById(a,id)?.nombre || "Grupo"; }

function renderAll(){
  const a=currentActivity();
  document.getElementById("activitySubtitle").textContent = `${a.nombre} · ${a.groups.length} grupos · ${a.questionsPerGroup} preguntas por grupo`;
  renderDashboard(a); renderGame(a); renderGroups(a); renderResults(a); renderSettings(a);
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===activeView));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+activeView));
}
function renderDashboard(a){
  const total=scheduleLength(a), done=a.game.history.length, ready=a.groups.filter(g=>g.preguntas.every(q=>q.trim())).length;
  const avg=a.groups.length ? (a.groups.reduce((s,g)=>s+score(g,a),0)/a.groups.length).toFixed(2):"0.00";
  document.getElementById("view-dashboard").innerHTML=`
    <div class="section-head"><div><h2>Panel principal</h2><p class="muted">${a.descripcion}</p></div>
    <button class="btn btn-primary" onclick="goView('game')">Ir al juego →</button></div>
    ${ready<a.groups.length?`<div class="notice">⚠️ Faltan preguntas en <b>${a.groups.length-ready} grupo(s)</b>. Completa todas las preguntas antes de iniciar la ronda.</div>`:""}
    <div class="grid grid-4">
      <div class="card stat"><div><div class="stat-number">${a.groups.length}</div><div class="stat-label">Grupos</div></div><span>👥</span></div>
      <div class="card stat"><div><div class="stat-number">${total}</div><div class="stat-label">Preguntas totales</div></div><span>❓</span></div>
      <div class="card stat"><div><div class="stat-number">${done}/${total}</div><div class="stat-label">Turnos evacuados</div></div><span>🎯</span></div>
      <div class="card stat"><div><div class="stat-number">${avg}</div><div class="stat-label">Promedio actual</div></div><span>⭐</span></div>
    </div>
    <div style="height:18px"></div>
    <div class="card">
      <div class="section-head"><h2>Estado de los grupos</h2><span class="tag">${done===total&&total>0?"Ronda completada":"En curso"}</span></div>
      <div class="grid grid-3">${a.groups.map(groupCard).join("")}</div>
    </div>`;
}
function groupCard(g){
  const a=currentActivity(), ans=answered(g), pct=Math.round(ans/a.questionsPerGroup*100), sc=score(g,a);
  return `<div class="card group-card">
    <div class="group-accent" style="background:${g.color}"></div>
    <div class="group-top"><div class="avatar" style="background:${g.color}">${String(g.nombre).replace(/\D/g,"")||"G"}</div>
      <div><div class="group-name">${escapeHtml(g.nombre)}</div><div class="mini">${g.integrantes.length} integrante(s)</div></div>
      <div style="margin-left:auto;text-align:right"><div class="score">${sc.toFixed(1)}</div><div class="mini">nota</div></div>
    </div>
    <div class="members">${g.integrantes.map(escapeHtml).join(" · ")}</div>
    <div class="progress"><span style="width:${pct}%;background:${g.color}"></span></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><div class="dots">${g.respuestas.map(x=>`<span class="dot ${x||""}"></span>`).join("")}</div><span class="mini">${ans}/${a.questionsPerGroup} respondidas</span></div>
  </div>`;
}
function renderGame(a){
  ensureSchedule(a);
  const total=scheduleLength(a), current=a.game.schedule[a.game.currentTurn];
  const ready=allQuestionsReady(a);
  const done=a.game.currentTurn>=total;
  const wheelHtml=buildWheel(a,current);
  document.getElementById("view-game").innerHTML=`
    <div class="section-head"><div><h2>🎡 Ronda de preguntas</h2><p class="muted">La ruleta elige el grupo receptor. El sistema asigna de forma aleatoria y válida quién pregunta, sin auto-preguntas ni preguntas repetidas.</p></div>
      <span class="tag ${done?"success":""}">Turno ${Math.min(a.game.currentTurn+1,total)} de ${total}</span></div>
    ${!ready?`<div class="notice danger">🚫 La ronda no puede comenzar todavía. Ve a <b>Grupos y preguntas</b> y completa las preguntas faltantes.</div>`:""}
    <div class="game-layout">
      <div class="card wheel-card">
        ${wheelHtml}
      </div>
      <div class="card question-card">
        ${renderQuestionPanel(a,current,done)}
      </div>
    </div>`;
}
function buildWheel(a,current){
  const n=a.groups.length, seg=360/n;
  const stops=a.groups.map((g,i)=>`${g.color} ${i*seg}deg ${(i+1)*seg}deg`).join(",");
  const labels=a.groups.map((g,i)=>{
    const angle=i*seg+seg/2;
    return `<div class="wheel-label" style="transform:rotate(${angle}deg)">${escapeHtml(g.nombre)}</div>`;
  }).join("");
  return `<div class="wheel-wrap">
    <div class="pointer"></div>
    <div id="wheel" class="wheel" style="background:conic-gradient(from -90deg,${stops});transform:rotate(${wheelRotation}deg)">${labels}</div>
    <button id="spinBtn" class="wheel-center" onclick="spinWheel()" ${spinning||!allQuestionsReady(a)||a.game.currentTurn>=scheduleLength(a)?"disabled":""}>${a.game.currentTurn>=scheduleLength(a)?"FIN":"GIRAR"}</button>
  </div>
  <div class="turn-counter">${a.game.currentTurn>=scheduleLength(a)?"Las 60 preguntas fueron evacuadas.":"Presiona GIRAR para seleccionar el siguiente grupo receptor."}</div>
  <div id="pairResultArea"></div>`;
}
function renderQuestionPanel(a,current,done){
  if(done) return `<div class="empty"><div style="font-size:50px">🏆</div><h2>Ronda completada</h2><p>Se evacuaron ${scheduleLength(a)} de ${scheduleLength(a)} preguntas. Todos los grupos preguntaron ${a.questionsPerGroup} veces y respondieron ${a.questionsPerGroup} veces.</p><button class="btn btn-primary" onclick="goView('results')">Ver resultados</button></div>`;
  return `<div class="section-head"><h2>Pregunta del turno</h2><span class="tag">Oculta</span></div>
    <div id="questionPanelBody">
      <div class="empty"><div style="font-size:44px">🎲</div><h3>Gira la ruleta</h3><p>Primero se determina la pareja del turno. Después podrás revelar la pregunta.</p></div>
    </div>`;
}
function showPairResult(a,turn){
  const receiver=groupById(a,turn.receiverId), asker=groupById(a,turn.askerId);
  const area=document.getElementById("pairResultArea");
  if(!area)return;
  area.innerHTML=`<div class="pair-result">
    <div class="mini">RESULTADO DEL TURNO ${a.game.currentTurn+1}</div>
    <div class="pair"><span style="color:${asker.color}">${escapeHtml(asker.nombre)}</span><span class="arrow">→</span><span style="color:${receiver.color}">${escapeHtml(receiver.nombre)}</span></div>
    <div class="mini">${escapeHtml(asker.nombre)} realiza la pregunta · ${escapeHtml(receiver.nombre)} responde</div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="revealQuestion()">👁️ Revelar pregunta</button>
  </div>`;
}
function revealQuestion(){
  const a=currentActivity(), turn=a.game.schedule[a.game.currentTurn], receiver=groupById(a,turn.receiverId);
  const q=receiver.preguntas[turn.questionIndex];
  const body=document.getElementById("questionPanelBody");
  if(!body)return;
  body.innerHTML=`<div class="mini">RESPONDE ${escapeHtml(receiver.nombre)}</div>
    <div class="question-box" style="margin-top:8px">${escapeHtml(q)}</div>
    <div class="answer-actions">
      <button class="btn btn-success big-answer" onclick="registerAnswer('correct')">✓ RESPUESTA CORRECTA</button>
      <button class="btn btn-danger big-answer" onclick="registerAnswer('incorrect')">✕ RESPUESTA INCORRECTA (-${a.penalty})</button>
    </div>`;
}
function spinWheel(){
  if(spinning)return;
  const a=currentActivity(); ensureSchedule(a);
  if(!allQuestionsReady(a)){showToast("Completa todas las preguntas antes de jugar.");goView("groups");return;}
  const turn=a.game.schedule[a.game.currentTurn];
  const idx=groupIndex(a,turn.receiverId);
  if(idx<0)return;
  spinning=true;
  const n=a.groups.length, seg=360/n, center=idx*seg+seg/2;
  const currentMod=((wheelRotation%360)+360)%360;
  const delta=((360-(center+currentMod)%360)%360)+360*(5+Math.floor(Math.random()*3));
  wheelRotation+=delta;
  const wheel=document.getElementById("wheel");
  const btn=document.getElementById("spinBtn");
  btn.disabled=true;
  wheel.style.transform=`rotate(${wheelRotation}deg)`;
  setTimeout(()=>{
    spinning=false;
    showPairResult(a,turn);
    const body=document.getElementById("questionPanelBody");
    if(body) body.innerHTML=`<div class="empty"><div style="font-size:44px">🎯</div><h3>Grupo seleccionado</h3><p>Ahora revisa el resultado de la ruleta y pulsa <b>Revelar pregunta</b>.</p></div>`;
  },4300);
}
function registerAnswer(status){
  const a=currentActivity(), turn=a.game.schedule[a.game.currentTurn], receiver=groupById(a,turn.receiverId);
  if(receiver.respuestas[turn.questionIndex]){showToast("Esta pregunta ya tiene resultado.");return;}
  receiver.respuestas[turn.questionIndex]=status;
  a.game.history.push({...clone(turn),status,answeredAt:new Date().toISOString()});
  a.game.currentTurn++;
  a.game.started=true;
  a.game.completed=a.game.currentTurn>=scheduleLength(a);
  saveApp(); renderAll(); goView("game");
  showToast(status==="correct"?"Respuesta registrada: correcta ✓":"Respuesta registrada: incorrecta (-"+a.penalty+")");
}
function renderGroups(a){
  document.getElementById("view-groups").innerHTML=`
    <div class="section-head"><div><h2>👥 Grupos y preguntas</h2><p class="muted">Edita integrantes y las ${a.questionsPerGroup} preguntas de cada grupo.</p></div>
      <button class="btn btn-primary" onclick="openGroupModal()">+ Agregar grupo</button></div>
    ${a.groups.map(g=>`
      <div class="card" style="margin-bottom:14px">
        <div class="section-head">
          <div class="group-top" style="margin:0"><div class="avatar" style="background:${g.color}">${String(g.nombre).replace(/\D/g,"")||"G"}</div><div><h3 style="margin:0">${escapeHtml(g.nombre)}</h3><div class="mini">${g.integrantes.length} integrante(s) · ${g.preguntas.filter(q=>q.trim()).length}/${a.questionsPerGroup} preguntas listas</div></div></div>
          <div style="display:flex;gap:7px"><button class="btn btn-secondary btn-small" onclick="openGroupModal(${g.id})">Editar</button><button class="btn btn-ghost btn-small" onclick="openQuestionsModal(${g.id})">Preguntas</button></div>
        </div>
        <div class="kpi-row">${g.integrantes.map(x=>`<span class="kpi">${escapeHtml(x)}</span>`).join("")}</div>
      </div>`).join("")}`;
}
function renderResults(a){
  const total=scheduleLength(a),done=a.game.history.length;
  const rows=a.game.history.map((h,i)=>`<tr>
    <td>${i+1}</td><td>${escapeHtml(groupName(a,h.askerId))}</td><td>→</td><td>${escapeHtml(groupName(a,h.receiverId))}</td>
    <td>Pregunta ${h.questionIndex+1}</td><td><span class="tag ${h.status==="correct"?"success":"danger"}">${h.status==="correct"?"Correcta":"Incorrecta"}</span></td>
    <td><button class="btn btn-secondary btn-small" onclick="openResultModal(${i})">Corregir</button></td>
  </tr>`).join("");
  document.getElementById("view-results").innerHTML=`
    <div class="section-head"><div><h2>📊 Resultados</h2><p class="muted">${done}/${total} turnos registrados.</p></div>
      <div style="display:flex;gap:8px"><button class="btn btn-secondary" onclick="undoLastTurn()" ${done?"":"disabled"}>↩ Deshacer último</button><button class="btn btn-ghost" onclick="exportData()">Exportar JSON</button></div></div>
    <div class="grid grid-3" style="margin-bottom:18px">
      ${a.groups.map(g=>`<div class="card"><div class="section-head"><b>${escapeHtml(g.nombre)}</b><strong>${score(g,a).toFixed(1)}/5.0</strong></div><div class="mini">${answered(g)}/${a.questionsPerGroup} respuestas · ${g.respuestas.filter(x=>x==="incorrect").length} incorrectas</div><div class="progress"><span style="width:${answered(g)/a.questionsPerGroup*100}%;background:${g.color}"></span></div></div>`).join("")}
    </div>
    <div class="card"><div class="section-head"><h2>Historial de turnos</h2><span class="tag">${done} registrados</span></div>
      ${done?`<div class="table-wrap"><table class="table"><thead><tr><th>Turno</th><th>Pregunta</th><th></th><th>Responde</th><th>Índice</th><th>Resultado</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty">Todavía no hay turnos registrados.</div>`}
    </div>`;
}
function renderSettings(a){
  document.getElementById("view-settings").innerHTML=`
    <div class="section-head"><div><h2>⚙️ Configuración</h2><p class="muted">La actividad se guarda automáticamente en este navegador.</p></div></div>
    <div class="card">
      <div class="form-grid">
        <div class="field full"><label>Nombre de la actividad</label><input id="cfgName" value="${attr(a.nombre)}"></div>
        <div class="field full"><label>Descripción</label><textarea id="cfgDesc">${escapeHtml(a.descripcion)}</textarea></div>
        <div class="field"><label>Nota inicial</label><input id="cfgInitial" type="number" min="0" step=".1" value="${a.initialScore}"></div>
        <div class="field"><label>Descuento por respuesta incorrecta</label><input id="cfgPenalty" type="number" min="0" step=".1" value="${a.penalty}"></div>
        <div class="field"><label>Preguntas por grupo</label><input id="cfgQuestions" type="number" min="1" step="1" value="${a.questionsPerGroup}"></div>
        <div class="field"><label>Grupos actuales</label><input value="${a.groups.length}" disabled></div>
      </div>
      <div class="modal-actions"><button class="btn btn-primary" onclick="saveSettings()">Guardar configuración</button></div>
    </div>
    <div style="height:18px"></div>
    <div class="card">
      <div class="section-head"><div><h2>💾 Copias y datos</h2><p class="muted">Puedes guardar una copia de la actividad y restaurarla en otro navegador.</p></div></div>
      <div style="display:flex;gap:9px;flex-wrap:wrap"><button class="btn btn-secondary" onclick="exportData()">⬇ Exportar actividad JSON</button><button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">⬆ Importar actividad JSON</button></div>
      <input id="importFile" type="file" accept=".json,application/json" hidden onchange="importData(event)">
    </div>
    <div style="height:18px"></div>
    <div class="card"><h2>🔐 Cómo funciona la aleatoriedad</h2><p class="muted">El sistema genera una agenda aleatoria válida antes de empezar: cada grupo pregunta ${a.questionsPerGroup} veces, responde ${a.questionsPerGroup} veces, nunca se pregunta a sí mismo y cada pregunta se utiliza una sola vez. Además, se evita repetir la misma pareja dirigida mientras sea matemáticamente posible.</p></div>`;
}
function saveSettings(){
  const a=currentActivity();
  const oldQ=a.questionsPerGroup;
  a.nombre=document.getElementById("cfgName").value.trim()||"Actividad sin nombre";
  a.descripcion=document.getElementById("cfgDesc").value.trim();
  a.initialScore=Number(document.getElementById("cfgInitial").value)||5;
  a.penalty=Number(document.getElementById("cfgPenalty").value)||0;
  a.questionsPerGroup=Math.max(1,Number(document.getElementById("cfgQuestions").value)||5);
  if(oldQ!==a.questionsPerGroup){
    a.groups.forEach(g=>{
      g.preguntas=Array.from({length:a.questionsPerGroup},(_,i)=>g.preguntas[i]||"");
      g.respuestas=Array.from({length:a.questionsPerGroup},(_,i)=>g.respuestas?.[i]||null);
    });
    resetGame(a);
  }else saveApp();
  renderAll();showToast("Configuración guardada.");
}
function openGroupModal(id){
  const a=currentActivity(), g=id?groupById(a,id):null;
  openModal(`<div class="modal-title"><div><h2>${g?"Editar grupo":"Nuevo grupo"}</h2><p class="muted">Configura nombre, color e integrantes.</p></div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-grid" style="margin-top:18px">
      <div class="field"><label>Nombre</label><input id="mGroupName" value="${attr(g?.nombre||"Grupo "+(a.groups.length+1))}"></div>
      <div class="field"><label>Color</label><input id="mGroupColor" type="color" value="${g?.color||"#4f46e5"}"></div>
      <div class="field full"><label>Integrantes (uno por línea)</label><textarea id="mMembers">${escapeHtml((g?.integrantes||[]).join("\\n"))}</textarea></div>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveGroup(${id||"null"})">Guardar grupo</button></div>`);
}
function saveGroup(id){
  const a=currentActivity(),name=document.getElementById("mGroupName").value.trim(),color=document.getElementById("mGroupColor").value;
  const members=document.getElementById("mMembers").value.split("\n").map(x=>x.trim()).filter(Boolean);
  if(!name){showToast("Escribe un nombre.");return}
  if(id===null){a.groups.push({id:Date.now(),nombre:name,color,integrantes:members,preguntas:Array.from({length:a.questionsPerGroup},()=>""),respuestas:Array.from({length:a.questionsPerGroup},()=>null)});}
  else{const g=groupById(a,id);g.nombre=name;g.color=color;g.integrantes=members;}
  resetGame(a);closeModal();renderAll();showToast("Grupo guardado.");
}
function openQuestionsModal(id){
  const a=currentActivity(),g=groupById(a,id);
  openModal(`<div class="modal-title"><div><h2>Preguntas — ${escapeHtml(g.nombre)}</h2><p class="muted">Cada pregunta se usará exactamente una vez durante la ronda.</p></div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="question-editor" style="margin-top:18px">${g.preguntas.map((q,i)=>`<div><label>Pregunta ${i+1}</label><textarea id="q_${i}" placeholder="Escribe la pregunta...">${escapeHtml(q)}</textarea></div>`).join("")}</div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveQuestions(${id})">Guardar preguntas</button></div>`);
}
function saveQuestions(id){
  const a=currentActivity(),g=groupById(a,id);
  g.preguntas=g.preguntas.map((_,i)=>document.getElementById("q_"+i).value.trim());
  g.respuestas=Array.from({length:a.questionsPerGroup},()=>null);
  resetGame(a);closeModal();renderAll();showToast("Preguntas guardadas.");
}
function openResultModal(index){
  const a=currentActivity(),h=a.game.history[index];
  openModal(`<div class="modal-title"><div><h2>Corregir resultado</h2><p class="muted">Turno ${index+1}: ${escapeHtml(groupName(a,h.askerId))} → ${escapeHtml(groupName(a,h.receiverId))}, pregunta ${h.questionIndex+1}.</p></div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="card" style="margin-top:16px;background:#fafbfe;box-shadow:none"><b>Pregunta:</b><p style="margin:8px 0 0">${escapeHtml(groupById(a,h.receiverId).preguntas[h.questionIndex])}</p></div>
    <div class="modal-actions"><button class="btn ${h.status==="correct"?"btn-success":"btn-secondary"}" onclick="correctHistory(${index},'correct')">✓ Correcta</button><button class="btn ${h.status==="incorrect"?"btn-danger":"btn-secondary"}" onclick="correctHistory(${index},'incorrect')">✕ Incorrecta</button></div>`);
}
function correctHistory(index,status){
  const a=currentActivity(),h=a.game.history[index],g=groupById(a,h.receiverId);
  g.respuestas[h.questionIndex]=status;h.status=status;h.correctedAt=new Date().toISOString();
  saveApp();closeModal();renderAll();showToast("Resultado actualizado.");
}
function undoLastTurn(){
  const a=currentActivity(),h=a.game.history.pop();if(!h)return;
  const g=groupById(a,h.receiverId);g.respuestas[h.questionIndex]=null;
  a.game.currentTurn=Math.max(0,a.game.currentTurn-1);a.game.completed=false;
  saveApp();renderAll();showToast("Último turno deshecho. Puedes volver a girar.");
}
function openNewActivityModal(){
  openModal(`<div class="modal-title"><div><h2>Nueva actividad</h2><p class="muted">Crea una actividad independiente.</p></div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="form-grid" style="margin-top:18px">
      <div class="field full"><label>Nombre</label><input id="newName" value="Nueva Defensa de Nota"></div>
      <div class="field full"><label>Descripción</label><textarea id="newDesc">Actividad de preguntas cruzadas.</textarea></div>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="createActivity()">Crear</button></div>`);
}
function createActivity(){
  const a=normalizeActivity({id:uid("act"),nombre:document.getElementById("newName").value.trim()||"Nueva actividad",descripcion:document.getElementById("newDesc").value.trim(),initialScore:5,penalty:.5,questionsPerGroup:5,groups:[]});
  app.activities.push(a);app.activeActivityId=a.id;saveApp();closeModal();renderAll();goView("groups");showToast("Nueva actividad creada.");
}
function exportData(){
  const a=clone(currentActivity());
  const blob=new Blob([JSON.stringify(a,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=(a.nombre||"actividad").replace(/[^a-z0-9áéíóúñü_-]+/gi,"_")+".json";link.click();URL.revokeObjectURL(url);
}
function importData(event){
  const file=event.target.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const a=normalizeActivity(JSON.parse(reader.result));a.id=uid("act");
      app.activities.push(a);app.activeActivityId=a.id;saveApp();renderAll();goView("groups");showToast("Actividad importada.");
    }catch(e){showToast("El archivo JSON no es válido.");}
  };
  reader.readAsText(file);
}
function openModal(html){document.getElementById("modalCard").innerHTML=html;document.getElementById("modal").classList.remove("hidden")}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function goView(view){activeView=view;renderAll()}
function showToast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove("show"),2600)}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function attr(s){return escapeHtml(s).replace(/"/g,"&quot;")}

document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>goView(b.dataset.view)));
document.getElementById("btnResetGame").addEventListener("click",()=>{
  if(confirm("¿Reiniciar toda la ronda? Se borrarán los resultados, pero se conservarán grupos y preguntas.")) resetGame(currentActivity());
});
document.getElementById("btnNewActivity").addEventListener("click",openNewActivityModal);
document.querySelector(".modal-backdrop").addEventListener("click",closeModal);

renderAll();
