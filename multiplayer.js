// The server owns movement, hazards, eliminations and points. This client sends controls only.
window.Multiplayer=(()=>{
  // The school-fair version runs standalone, including on GitHub Pages.
  if(document.querySelector('.multiplayer-panel')?.hidden)return {active:false,joining:false};
  const el=id=>document.getElementById(id);
  let session=null,room=null,stream=null,connected=false,joining=false,inputBusy=false;
  let seq=Date.now(),lastInputSend=0,dashPending=false,lastRoomUi='',lastBoard='',lastPhase='',lastRound=0;
  let receivedAt=0,previousRoom=null;
  const held=new Set(),poses=new Map(),noticedShots=new Set(),fx=[];
  const skinNames=SkinCatalog.items.map(s=>s.name);
  const text=(id,value)=>{el(id).textContent=value;};
  const show=(id,value)=>el(id).classList.toggle('hidden',!value);
  function message(value){text(session?'mp-room-message':'mp-menu-error',value);text('mp-result-message',value);}
  function remember(){try{if(session)sessionStorage.setItem('robot-arena-room',JSON.stringify(session));else sessionStorage.removeItem('robot-arena-room');}catch{}}
  async function request(path,body,token=session?.token){
    const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(6000)});
    const content=response.headers.get('content-type')||'';
    if(!content.includes('application/json'))throw new Error('O multiplayer precisa do servidor do jogo. Abra o endereço fornecido ao iniciar o servidor.');
    const data=await response.json();
    if(!response.ok)throw new Error(data.message||data.error||'Não foi possível completar a ação.');
    return data;
  }
  async function action(body){
    try{await request('/api/action',body);message('');return true;}catch(error){message(error.name==='TimeoutError'?'O servidor demorou para responder. Tente novamente.':error.message);return false;}
  }
  function clearInput(){held.clear();dashPending=false;GameAudio.hush();if(session&&connected)sendInput(true);}
  function returnMenu(notice=''){
    stream?.close();stream=null;session=null;room=null;connected=false;remember();
    held.clear();dashPending=false;poses.clear();fx.length=0;lastRoomUi='';lastBoard='';lastPhase='';lastRound=0;
    running=false;deathAge=-1;shots=[];bots=[];particles=[];feedback=[];keys={};GameAudio.hush();
    document.body.classList.remove('in-multiplayer','mp-playing');document.body.classList.add('in-menu');
    ['mp-room','mp-hud','mp-results'].forEach(id=>show(id,false));ui.over.classList.add('hidden');ui.start.classList.remove('hidden');
    resizeArena();startPreview();text('mp-menu-error',notice);
  }
  async function leave(){
    const token=session?.token;clearInput();returnMenu();
    if(token){try{await request('/api/action',{type:'leave'},token);}catch{}}
  }
  function connect(){
    ['mp-start','mp-ready','mp-mode','mp-rounds'].forEach(id=>el(id).disabled=true);
    stream?.close();stream=new EventSource('/api/events?token='+encodeURIComponent(session.token));
    stream.onopen=()=>{connected=true;message('');};
    stream.onmessage=event=>{
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='error'||data.type==='closed'){returnMenu(data.message||'A sala foi encerrada.');return;}
      if(data.type!=='state'||!data.room)return;
      connected=true;previousRoom=room;room=data.room;receivedAt=performance.now();
      if(!room.players.some(p=>p.id===session.id)){returnMenu('Você saiu da sala.');return;}
      const me=room.players.find(p=>p.id===session.id);
      const ledger=save.crystalLedger||(save.crystalLedger={});
      const paid=ledger[session.id]||0,total=me.crystalTotal||0;
      if(total>paid){ledger[session.id]=total;bankCrystals(total-paid);}
      snapshotEffects();renderUi();
    };
    stream.onerror=()=>{
      connected=false;held.clear();dashPending=false;GameAudio.hush();message('Reconectando à sala…');text('mp-status','CONEXÃO INTERROMPIDA — RECONECTANDO');
      // EventSource retries transport failures; verify expired rooms without retrying forever.
      const token=session?.token;
      if(token)request('/api/action',{type:'input',x:0,y:0,dash:false,seq:++seq},token).catch(error=>{
        if(session?.token===token&&/sessão|session|token|sala.*(existe|encontrad|encerrad)/i.test(error.message))returnMenu('A conexão com a sala expirou. Entre novamente com o código.');
      });
    };
  }
  async function enter(create){
    if(joining||session||document.body.classList.contains('is-loading'))return;
    const name=el('name').value.trim()||'Piloto-01',code=el('mp-code').value.trim().toUpperCase();
    if(!create&&!/^[A-Z0-9]{6}$/.test(code)){text('mp-menu-error','Digite o código de 6 caracteres da sala.');return;}
    joining=true;el('mp-create').disabled=true;el('mp-join-form').querySelector('button').disabled=true;text('mp-menu-error','Conectando…');
    GameAudio.unlock();
    try{
      session=await request(create?'/api/create':'/api/join',{name,skin:avatar,code,mode:selectedMode,ownedSkins:save.ownedSkins||[]});remember();
      running=false;deathAge=-1;cancelAnimationFrame(previewRaf);GameAudio.hush();
      ui.start.classList.add('hidden');ui.over.classList.add('hidden');document.body.classList.add('in-multiplayer','in-menu');
      show('mp-room',true);text('mp-room-code',session.code);text('mp-room-message','Conectando à sala…');
      connect();
    }catch(error){returnMenu(error.name==='TypeError'?'Não foi possível conectar ao servidor do jogo.':error.message);}
    finally{joining=false;el('mp-create').disabled=false;el('mp-join-form').querySelector('button').disabled=false;}
  }
  function append(parent,tag,className,value){const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;parent.append(node);return node;}
  function renderRoster(){
    const signature=JSON.stringify([room.hostId,room.phase,room.players.map(p=>[p.id,p.name,p.skin,p.ready,p.connected])]);
    if(signature===lastRoomUi)return;lastRoomUi=signature;
    const list=el('mp-players');list.replaceChildren();
    for(const p of room.players){
      const row=append(list,'div','mp-player-row');row.style.setProperty('--skin',skins[p.skin][3]);row.classList.toggle('is-ready',p.ready);row.classList.toggle('is-offline',!p.connected);
      const info=append(row,'div','mp-player-info');append(info,'span','mp-player-name',p.name+(p.id===session.id?' · '+I18n.t('você'):''));
      if(p.id===session.id){
        const select=append(row,'select','mp-skin-select');select.setAttribute('aria-label','Sua unidade');
        skinNames.forEach((name,index)=>{const option=append(select,'option','',name);option.value=index;const occupied=room.players.some(other=>other.id!==p.id&&other.skin===index),locked=!(p.ownedSkins||[0,1,2,3]).includes(index);option.disabled=occupied||locked;if(occupied)option.textContent+=' · ocupada';else if(locked)option.textContent+=' · bloqueada';});
        select.value=p.skin;select.disabled=room.phase!=='lobby';select.onchange=()=>{const skin=Number(select.value);select.value=p.skin;action({type:'skin',skin});};
      }else append(row,'span','mp-unit-name',skinNames[p.skin]);
      append(row,'span','mp-player-state',!p.connected?'Reconectando…':p.id===room.hostId?'Anfitrião':p.ready?'Pronto':'Preparando');
    }
  }
  function renderResults(){
    const final=room.phase==='finished',winners=final?(room.winnerIds||[]):room.roundWinnerId?[room.roundWinnerId]:[];
    const names=winners.map(id=>room.players.find(p=>p.id===id)?.name).filter(Boolean);
    text('mp-result-title',names.length?(names.join(I18n.t(' e '))+(final?(names.length>1?' venceram a partida':' venceu a partida'):' venceu a rodada')):final?'Partida encerrada':'Rodada empatada');
    const ranking=[...room.players].sort((a,b)=>final?(b.points-a.points||b.wins-a.wins):(a.place??99)-(b.place??99));
    const list=el('mp-result-list');list.replaceChildren();
    for(const [index,p] of ranking.entries()){const row=append(list,'div','mp-result-row');append(row,'span','mp-place',final?String(1+ranking.filter(other=>other.points>p.points||(other.points===p.points&&other.wins>p.wins)).length):p.place?p.place+'º':'—');append(row,'strong','',p.name);const points=append(row,'div','');append(points,'b','',final?p.points+' pts':'+'+(p.roundPoints||0));append(points,'small','',final?p.wins+' vitória'+(p.wins===1?'':'s'):'total '+p.points);}
    const reward=room.players.find(p=>p.id===session.id)?.crystalState?.earned||0;append(list,'p','mp-crystal-reward','Cristais nesta rodada: +'+reward);
    const host=room.hostId===session.id;
    show('mp-next',host&&!final);el('mp-next').disabled=room.players.filter(p=>p.connected).length<2;
    show('mp-lobby',host);text('mp-result-message',host?'':final?'Aguardando o anfitrião voltar à sala.':'Aguardando o anfitrião iniciar a próxima rodada.');
  }
  function renderUi(){
    const lobby=room.phase==='lobby',result=room.phase==='results'||room.phase==='finished',host=room.hostId===session.id,me=room.players.find(p=>p.id===session.id);
    document.body.classList.toggle('in-menu',lobby);document.body.classList.toggle('mp-playing',!lobby);
    show('mp-room',lobby);show('mp-hud',!lobby&&!result);show('mp-results',result);
    text('mp-room-code',room.code);renderRoster();
    el('mp-mode').value=room.mode;el('mp-rounds').value=room.rounds;
    el('mp-mode').disabled=!host||!lobby;el('mp-rounds').disabled=!host||!lobby;
    show('mp-start',host);show('mp-ready',!host);el('mp-ready').disabled=!connected; text('mp-ready',me?.ready?'CANCELAR PRONTO':'ESTOU PRONTO');el('mp-ready').setAttribute('aria-pressed',String(!!me?.ready));
    const others=room.players.filter(p=>p.id!==room.hostId);
    el('mp-start').disabled=room.players.length<2||room.players.some(p=>!p.connected)||!others.every(p=>p.ready);
    text('mp-round-label','RODADA '+room.round+' / '+room.rounds+' · '+CombatBalance.modes[room.mode].label);
    text('mp-status',room.phase==='countdown'?(room.players.some(p=>!p.connected&&p.alive)?'AGUARDANDO RECONEXÃO':'COMEÇA EM '+Math.max(1,Math.ceil(room.countdown))):!me?.alive?'ELIMINADO · ACOMPANHANDO A RODADA':room.players.filter(p=>p.alive).length+' SOBREVIVENTES');
    const signature=JSON.stringify(room.players.map(p=>[p.id,p.name,p.points,p.alive]));
    if(signature!==lastBoard){lastBoard=signature;const board=el('mp-scoreboard');board.replaceChildren();room.players.forEach(p=>{const tag=append(board,'span','mp-score-entry',p.name+' · '+p.points);tag.style.color=p.alive?skins[p.skin][3]:'#68808b';});}
    if(result)renderResults();
    if(room.phase!==lastPhase||room.round!==lastRound){clearInput();if(room.phase==='countdown'){poses.clear();noticedShots.clear();fx.length=0;crystalFx=[];SpaceScene.reset();GameAudio.play('start');}lastPhase=room.phase;lastRound=room.round;}
  }
  function snapshotEffects(){
    if(!previousRoom||room.round!==previousRoom.round||previousRoom.phase!=='playing')return;
    for(const p of room.players){const prev=previousRoom.players.find(x=>x.id===p.id);if(!prev)continue;
      if(prev.alive&&!p.alive){fx.push({x:p.x,y:p.y,age:0,color:skins[p.skin][3]});GameAudio.play('death');}
      if(p.dashRemaining>0&&prev.dashRemaining<=0){const pose=poses.get(p.id);if(pose)RobotMotion.ignite(pose.motion,p.x,p.y,p.a);if(p.id===session.id)GameAudio.play('dash');}
      if(p.id===session.id&&(p.crystalState?.collected||0)>(prev.crystalState?.collected||0)){crystalFx.push({x:p.x,y:p.y,age:0});GameAudio.play('crystal');}
      if(p.id===session.id&&p.alive&&prev.dashCooldown>0&&p.dashCooldown<=0)GameAudio.play('ready');
    }
    const oldShots=new Map(previousRoom.shots.map(s=>[s.id,s]));
    const me=room.players.find(p=>p.id===session.id),prior=previousRoom.players.find(p=>p.id===session.id);
    const aliveShots=new Set(room.shots.map(s=>s.id));for(const id of noticedShots)if(!aliveShots.has(id))noticedShots.delete(id);
    room.shots.forEach(s=>{
      const old=oldShots.get(s.id);if(!old){GameAudio.play('shot-'+s.type,(s.x/1400-.5)*1.4);return;}
      if(old.tracking>0&&s.tracking<=0)GameAudio.play('unlock',(s.x/1400-.5)*1.4);
      if(!me?.alive||!prior?.alive||noticedShots.has(s.id))return;
      const ax=old.x-prior.x,ay=old.y-prior.y,bx=s.x-me.x,by=s.y-me.y,distance=closestPass(ax,ay,bx,by);
      const phase=distance<24&&(me.dashRemaining>0||prior.dashRemaining>0),near=distance<48&&bx*bx+by*by>ax*ax+ay*ay;
      if(phase||near){noticedShots.add(s.id);fx.push({x:s.x,y:s.y,age:0,color:skins[me.skin][3],type:phase?'phase':'near'});GameAudio.play(phase?'phase':'near',bx/70);}
    });
  }
  async function sendInput(force=false){
    if(!session||!connected||inputBusy||(!force&&room?.phase!=='playing'))return;
    inputBusy=true;
    const {x,y}=ControlBindings.vector(held);
    const dash=dashPending;dashPending=false;const token=session.token;
    try{await request('/api/action',{type:'input',x,y,dash,seq:++seq},token);}catch{if(session?.token===token)GameAudio.hush();}finally{inputBusy=false;}
  }
  function frame(dt,now){
    if(!session)return;
    if(now-lastInputSend>=50){lastInputSend=now;sendInput();}
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#02060e';ctx.fillRect(0,0,canvas.width,canvas.height);
    const scale=Math.min(canvas.width/1400,canvas.height/780),ox=(canvas.width-1400*scale)/2,oy=(canvas.height-780*scale)/2;
    ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.beginPath();ctx.rect(0,0,1400,780);ctx.clip();
    const me=room?.players.find(p=>p.id===session.id);SpaceScene.draw(ctx,1400,780,now,me||{x:700,y:390},room?.phase==='playing');
    if(room&&room.phase!=='lobby'){
      room.bots.forEach(drawBot);if(me?.alive)CrystalSystem.draw(ctx,me.crystalState?.items||[],now,reducedMotion.matches);
      const ahead=connected&&room.phase==='playing'?Math.min(.05,(now-receivedAt)/1000):0;
      room.shots.forEach(s=>drawNugget({...s,x:s.x+s.vx*ahead,y:s.y+s.vy*ahead}));
      for(const p of room.players){
        if(!p.alive)continue;
        let pose=poses.get(p.id);if(!pose){pose={x:p.x,y:p.y,motion:RobotMotion.create()};poses.set(p.id,pose);}
        const follow=1-Math.exp(-25*dt);pose.x+=(p.x+p.vx*ahead-pose.x)*follow;pose.y+=(p.y+p.vy*ahead-pose.y)*follow;
        RobotMotion.step(pose.motion,dt,pose.x,pose.y,p.vx,p.vy,p.dashRemaining>0?1-p.dashRemaining/.19:-1);
        RobotMotion.render(ctx,cachedSprite,pose.motion,pose.x,pose.y,skins[p.skin][3],skins[p.skin][4],art.player_robot.complete&&art.player_robot.naturalWidth>0);
        SkinArt.accents(ctx,p.skin,pose.motion,pose.x,pose.y);
        ctx.font='bold 13px Oxanium';ctx.textAlign='center';ctx.fillStyle=skins[p.skin][3];ctx.fillText(p.name+(p.id===session.id?' · '+I18n.t('VOCÊ'):''),pose.x,pose.y-49);
      }
      for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.age+=dt;
        if(f.type){ctx.save();ctx.strokeStyle=f.color;ctx.lineWidth=1.5;ctx.globalAlpha=Math.max(0,1-f.age/.38);ctx.beginPath();ctx.arc(f.x,f.y,7+f.age*(f.type==='phase'?84:48),0,Math.PI*2);ctx.stroke();ctx.restore();}
        else blend(art['explosion-2'],f.x,f.y,90+f.age*80,90+f.age*80,0,Math.max(0,1-f.age/.6));
        if(f.age>.6)fx.splice(i,1);
      }
      if(room.phase==='playing'&&me?.alive){
        const boosted=me.crystalState?.dashBoostRemaining>0,ready=boosted?me.crystalState.dashBoostRemaining/CrystalSystem.dashBoostDuration:Math.max(0,Math.min(1,1-me.dashCooldown/1.25));ctx.fillStyle='#071b28dd';ctx.fillRect(610,748,180,23);ctx.fillStyle=boosted?'#62f299':skins[me.skin][3];ctx.fillRect(613,751,174*ready,3);
        ctx.font='11px Oxanium';ctx.textAlign='center';ctx.fillText(I18n.t(boosted?'DASH LIVRE':ready>=1?'DASH PRONTO':'RECARREGANDO'),700,766);GameAudio.movement(Math.hypot(me.vx,me.vy),me.dashRemaining>0);
      }else GameAudio.hush();
      CrystalSystem.feedback(ctx,crystalFx,dt);
      ctx.font='bold 15px Oxanium';ctx.textAlign='right';ctx.fillStyle='#a2ffba';ctx.fillText(I18n.t('CRISTAIS')+' +'+(me?.crystalState?.earned||0),1360,110);
      SpaceScene.foreground(ctx,1400,780);
    }
    ctx.restore();
  }
  el('mp-create').onclick=()=>enter(true);
  el('mp-join-form').onsubmit=e=>{e.preventDefault();enter(false);};
  el('mp-code').oninput=()=>{el('mp-code').value=el('mp-code').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);};
  ['mp-leave','mp-exit','mp-result-leave'].forEach(id=>el(id).onclick=leave);
  el('mp-ready').onclick=()=>{if(room)action({type:'ready',ready:!room.players.find(p=>p.id===session.id)?.ready});};
  el('mp-start').onclick=()=>action({type:'start'});el('mp-next').onclick=()=>action({type:'next'});el('mp-lobby').onclick=()=>action({type:'lobby'});
  ['mp-mode','mp-rounds'].forEach(id=>el(id).onchange=()=>action({type:'settings',mode:el('mp-mode').value,rounds:Number(el('mp-rounds').value)}));
  el('mp-copy').onclick=async()=>{const code=room?.code||session?.code;if(!code)return;try{await navigator.clipboard.writeText(code);message('Código copiado.');}catch{message('Código da sala: '+code);}};
  addEventListener('keydown',e=>{
    if(!session||room?.phase!=='playing'||document.hidden||document.body.classList.contains('pause-menu-open')||document.querySelector('#settings-dialog').open||document.querySelector('#bindings-dialog').open||!connected||!room.players.find(p=>p.id===session.id)?.alive)return;
    if(e.metaKey||e.ctrlKey||e.altKey){clearInput();return;}
    if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    const key=movementKey(e);if(key||ControlBindings.matches('dash',e))e.preventDefault();if(e.repeat)return;
    if(key)held.add(key);if(ControlBindings.matches('dash',e))dashPending=true;
    GameAudio.unlock();sendInput();
  },true);
  addEventListener('keyup',e=>{const key=movementKey(e);if(key){held.delete(key);if(session)sendInput();}},true);
  addEventListener('game-settings-open',clearInput);
  addEventListener('blur',clearInput);addEventListener('pagehide',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
  try{const saved=JSON.parse(sessionStorage.getItem('robot-arena-room')||'null');if(saved?.token&&saved?.id){session=saved;ui.start.classList.add('hidden');document.body.classList.add('in-multiplayer');show('mp-room',true);connect();}}catch{}
  return {get active(){return !!session;},get joining(){return joining;},frame,leave};
})();
