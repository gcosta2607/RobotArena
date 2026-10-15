const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
let W=canvas.width,H=canvas.height;
const ui={start:document.querySelector('#start'),over:document.querySelector('#gameover'),score:document.querySelector('#score'),time:document.querySelector('#time'),mult:document.querySelector('#mult'),best:document.querySelector('#best'),xp:document.querySelector('#xp'),coins:document.querySelector('#coins'),dash:document.querySelector('#dash'),signal:document.querySelector('#signal')};
const save=JSON.parse(localStorage.getItem('robot-arena-save')||'{"best":0,"xp":0,"coins":0}');
const nuggetSprites=['nugget-projectile','nugget-round','nugget-bell','nugget-rectangle'];
const art={};[...nuggetSprites,'player_robot','laser','impact','movement-particles','danger-ring','explosion-1','explosion-2','explosion-3','explosion-area','missile','damage-particles','dash-trail'].forEach(name=>{const image=new Image();image.src=`assets/${name}.${name==='arena'||name==='player_robot'?'webp':'png'}`;art[name]=image});
const spriteCache=new Map();
const DASH_DURATION=190;
const MAX_ENEMY_SHOTS=16;
let dashQueuedUntil=0,readyNotified=true,deathAge=-1,feedback=[],corePulse=0;
let lastInput={x:0,y:0},lastDash=false;
const reducedMotion={get matches(){return I18n.reducedMotion;}};
function cue(x,y,kind){feedback.push({x,y,kind,age:0});feedback=feedback.slice(-24);corePulse=1;}
function updateEffects(dt){
  feedback.forEach(f=>f.age+=dt);feedback=feedback.filter(f=>f.age<.38);
  corePulse=Math.max(0,corePulse-dt*4);
  particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt});
  particles=particles.filter(p=>p.life>0).slice(-90);
}
// Relative swept distance catches a projectile crossing the robot between frames.
function closestPass(ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(ax+dx*t,ay+dy*t);
}
function drawFeedback(){
  ctx.save();ctx.lineWidth=1.5;
  for(const f of feedback){
    const t=f.age/.38;ctx.globalAlpha=(1-t)*.8;ctx.strokeStyle=f.kind==='phase'?'#e1fdff':skins[avatar][3];
    ctx.beginPath();ctx.arc(f.x,f.y,7+t*(f.kind==='phase'?32:18),0,Math.PI*2);ctx.stroke();
    if(f.kind==='near'){ctx.beginPath();ctx.moveTo(f.x-5-t*9,f.y+4);ctx.lineTo(f.x+5+t*9,f.y-4);ctx.stroke();}
  }
  if(corePulse>0&&deathAge<0){ctx.globalAlpha=corePulse*.65;ctx.strokeStyle=skins[avatar][3];ctx.beginPath();ctx.arc(player.x,player.y+6,7+(1-corePulse)*9,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
let selectedMode='normal',activeMode='normal',nextHomingAt=0;
try{const savedMode=localStorage.getItem('robot-arena-mode');if(CombatBalance.modes[savedMode])selectedMode=savedMode;}catch{}
function combatDifficulty(seconds){return CombatBalance.at(activeMode,seconds);}
function reservedShots(){return bots.reduce((n,b)=>n+(b.attack?.remaining||0),0);}
function prepareAttack(b,c){
  const seconds=score/10;
  const homingAllowed=seconds>=nextHomingAt&&!shots.some(s=>s.type==='homing')&&!bots.some(other=>other.attack?.type==='homing');
  let type=CombatBalance.pick(c,seconds,homingAllowed),count=type==='burst'?3:1;
  const free=c.cap-shots.length-reservedShots();
  if(free<count){if(free<1)return;type='common';count=1;}
  b.lockAim=b.aim;b.attack={type,remaining:count,warningDuration:c.warning,speed:c.shotSpeed*(type==='homing'?.78:type==='burst'?.92:1)};
  b.cool=c.warning;
}
let motion=RobotMotion.create(),previewMotion=RobotMotion.create(),previewLast=0,dashDirection={x:0,y:-1};
function cachedSprite(row,frame,filter){if(filter.startsWith('skin:'))return SkinArt.sample(filter.slice(5));const key=`${row}:${frame}:${filter}`;if(spriteCache.has(key))return spriteCache.get(key);const tile=document.createElement('canvas');tile.width=422;tile.height=462;const tileCtx=tile.getContext('2d');tileCtx.imageSmoothingEnabled=false;tileCtx.filter=filter;tileCtx.drawImage(art.player_robot,frame*422,row,422,462,0,0,422,462);spriteCache.set(key,tile);return tile}
let avatar=0,running=false,last=0,started=0,score=0,shots=[],bots=[],particles=[],keys={},player={x:W/2,y:H/2,a:-Math.PI/2,name:"Piloto-01",moving:false},spawnClock=0,dashUntil=0,dashReady=0;
const skins=SkinCatalog.items.map(s=>[s.id,s.name.toUpperCase(),s.description,s.color,s.filter]);
avatar=SkinCatalog.items.findIndex(s=>s.id===save.equippedSkin);if(!SkinCatalog.owned(save).includes(avatar))avatar=0;
let crystalState=CrystalSystem.create(),crystalFx=[];
function bankCrystals(amount){if(amount<=0)return;save.coins+=amount;localStorage.setItem('robot-arena-save',JSON.stringify(save));sync();}
function sync(){
 ['xp','coins'].forEach(k=>{document.querySelectorAll('#'+k+',#menu-'+k+',#shop-'+k).forEach(e=>e.textContent=save[k])});
 const hudMode=document.body.classList.contains('in-menu')?selectedMode:activeMode;
 ui.best.textContent=ModeRecords.get(save,hudMode);
 document.querySelector('#menu-best').textContent=ModeRecords.get(save,selectedMode);
 document.querySelector('#record-label').textContent='RECORDE · '+CombatBalance.modes[hudMode].label;
 document.querySelector('#menu-record-label').textContent='RECORDE · '+CombatBalance.modes[selectedMode].label;
}sync();
const preview=document.querySelector('#preview'),previewCtx=preview.getContext('2d');
// Render the same artwork at double density, then downsample for a crisp menu preview.
preview.width=1120;preview.height=1160;previewCtx.setTransform(2,0,0,2,0,0);
previewCtx.imageSmoothingEnabled=true;previewCtx.imageSmoothingQuality='high';let previewRaf=0;
function previewLoop(now=performance.now()){
  const dt=Math.min(.033,(now-(previewLast||now))/1000);previewLast=now;
  previewCtx.clearRect(0,0,preview.width,preview.height);
  RobotMotion.step(previewMotion,dt,0,0,0,0,-1);
  previewCtx.save();previewCtx.translate(280,270);previewCtx.scale(5.5,5.5);
  RobotMotion.render(previewCtx,cachedSprite,previewMotion,0,0,skins[avatar][3],skins[avatar][4],art.player_robot.complete&&art.player_robot.naturalWidth>0,true);
  SkinArt.accents(previewCtx,avatar,previewMotion,0,0);previewCtx.restore();
  if(!ui.start.classList.contains('hidden'))previewRaf=requestAnimationFrame(previewLoop);
}
function startPreview(){document.querySelector('#start').style.setProperty('--unit-accent',skins[avatar][3]);cancelAnimationFrame(previewRaf);previewLoop()}
function choose(n){const owned=SkinCatalog.owned(save);const direction=n<avatar?-1:1;let pick=(n+skins.length)%skins.length;while(!owned.includes(pick))pick=(pick+direction+skins.length)%skins.length;n=pick;GameAudio.unlock();GameAudio.play('select');previewMotion.recoil=1;previewMotion.selectionPulse=1;avatar=(n+skins.length)%skins.length;save.equippedSkin=skins[avatar][0];localStorage.setItem('robot-arena-save',JSON.stringify(save));let [,nm,core]=skins[avatar];document.querySelector('#unit').textContent=nm;document.querySelector('#core').textContent=core;startPreview()}art.player_robot.addEventListener('load',startPreview);
function blend(image,x,y,w,h,rotation=0,alpha=1){if(!image.complete)return;ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore()}
// Atlas poses are front-facing: never rotate the body with the movement angle.
function robot(x,y,r,color,label,enemy=false,anim='idle',filter='none',bob=0){
  ctx.save();
  ctx.translate(x,y+bob);
  if(enemy){
    // Keep head, torso and boots; replace the dangling atlas arms with a grip.
    ctx.beginPath();ctx.moveTo(-40,-45);ctx.lineTo(40,-45);ctx.lineTo(40,1);
    ctx.lineTo(18,1);ctx.lineTo(18,24);ctx.lineTo(40,24);ctx.lineTo(40,45);
    ctx.lineTo(-40,45);ctx.lineTo(-40,24);ctx.lineTo(-18,24);ctx.lineTo(-18,1);ctx.lineTo(-40,1);ctx.closePath();ctx.clip();
  }
  if(art.player_robot.complete && art.player_robot.naturalWidth){
    const row=anim==='dash'?924:anim==='walk'?462:0;
    const frame=anim==='dash'
      ? Math.min(15,Math.max(0,Math.floor((performance.now()-(dashUntil-170))/170*16)))
      : Math.floor(performance.now()/(anim==='walk'?75:110))%16;
    const height=74*462/422;
    ctx.drawImage(cachedSprite(row,frame,filter),-37,-height/2,74,height);
  }
  ctx.restore();
  ctx.font='bold 13px Oxanium';
  ctx.textAlign='center';
  ctx.fillStyle=enemy?'#ffb0a0':color;
  if(!enemy)ctx.fillText(label,x,y-42);
}
function arena(){SpaceScene.draw(ctx,W,H,performance.now(),player,running)}
function shoot(bot){
  const attack=bot.attack;
  EnemyWeapon.fire(bot);
  const muzzle=EnemyWeapon.muzzle(bot),a=bot.lockAim,speed=attack.speed;
  const sprite={common:'nugget-round',burst:'nugget-rectangle',homing:'nugget-bell'}[attack.type];
  shots.push({x:muzzle.x,y:muzzle.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,speed,life:CombatBalance.shotLife(muzzle.x,muzzle.y,a,speed,W,H),tracking:attack.type==='homing'?1.2:0,type:attack.type,sprite,angle:a,spin:attack.type==='homing'?0:1.6});
  GameAudio.play('shot-'+attack.type,(muzzle.x/W-.5)*1.4);
  if(attack.type==='homing')nextHomingAt=score/10+combatDifficulty(score/10).homingGap;
  attack.remaining--;
  if(attack.remaining>0)bot.cool=.18;
  else{bot.attack=null;bot.lockAim=undefined;bot.cool=combatDifficulty(score/10).fireDelay+Math.random()*.35;}
}
function steerNugget(s,dt){
  if(s.type!=='homing'||s.tracking<=0)return;
  const step=Math.min(dt,s.tracking),angle=Math.atan2(s.vy,s.vx),target=Math.atan2(player.y-s.y,player.x-s.x);
  const delta=Math.atan2(Math.sin(target-angle),Math.cos(target-angle));
  const next=angle+Math.max(-1.5*step,Math.min(1.5*step,delta));
  s.vx=Math.cos(next)*s.speed;s.vy=Math.sin(next)*s.speed;s.angle=next;s.tracking=Math.max(0,s.tracking-dt);
  if(!s.tracking){cue(s.x,s.y,'near');GameAudio.play('unlock',(s.x/W-.5)*1.4);}
}
// Entry paths are anchored to the viewport, including after a resize.
function botRoute(edge,slot){
  const inset=48,top=Math.max(110,80*H/innerHeight+48);
  const x=inset+70+slot*(W-inset*2-140);
  const y=top+35+slot*(H-top-inset-70);
  if(edge===0)return {fromX:-180,fromY:y,toX:inset,toY:y};
  if(edge===1)return {fromX:W+180,fromY:y,toX:W-inset,toY:y};
  if(edge===2)return {fromX:x,fromY:-180,toX:x,toY:top};
  return {fromX:x,fromY:H+180,toX:x,toY:H-inset};
}
function placeBot(b){
  const route=botRoute(b.edge,b.slot);
  const t=Math.min(1,b.entry/b.entryDuration),ease=1-Math.pow(1-t,3);
  b.x=route.fromX+(route.toX-route.fromX)*ease;
  b.y=route.fromY+(route.toY-route.fromY)*ease;
  b.flightAngle=Math.atan2(route.toY-route.fromY,route.toX-route.fromX);
}
function newBot(){
  let edge=0,slot=0,best=-1;
  // Favor open border positions so arriving units do not pile up.
  for(let i=0;i<12;i++){
    const e=Math.floor(Math.random()*4),s=Math.random(),r=botRoute(e,s);
    const separation=bots.reduce((distance,b)=>{
      const other=botRoute(b.edge,b.slot);
      return Math.min(distance,Math.hypot(r.toX-other.toX,r.toY-other.toY));
    },Infinity);
    if(separation>best){edge=e;slot=s;best=separation;}
  }
  const names=['Mika','Kora','Byte','Nex','Echo','Vex'];
  const b={edge,slot,anchorSlot:slot,glideSpeed:0,entry:0,entryDuration:1.5+Math.random()*.35,entering:true,
    color:'#ff5f5f',filter:'hue-rotate(180deg) saturate(1.65)',
    name:names[Math.floor(Math.random()*names.length)],cool:.85+Math.random()*.35,phase:Math.random()*6};
  placeBot(b);EnemyWeapon.step(b,0,player);bots.push(b);
}
function updateBot(b,dt){
  b.phase+=dt;
  if(b.entering){
    b.entry=Math.min(b.entryDuration,b.entry+dt);placeBot(b);EnemyWeapon.step(b,dt,player);
    if(b.entry>=b.entryDuration)b.entering=false;
    return; // The first-shot countdown starts only after arrival.
  }
  // Follow tangentially along the same edge; never drift into the arena.
  const from=botRoute(b.edge,0),to=botRoute(b.edge,1),vertical=b.edge<2;
  const span=vertical?to.toY-from.toY:to.toX-from.toX;
  const coordinate=vertical?player.y:player.x,velocity=vertical?player.vy:player.vx;
  const start=vertical?from.toY:from.toX;
  const pilotSlot=Math.max(0,Math.min(1,(coordinate+(velocity||0)*.3-start)/span));
  let target=(b.anchorSlot??b.slot)*.6+pilotSlot*.4;
  for(const other of bots){
    if(other===b||other.edge!==b.edge)continue;
    const gap=b.slot-other.slot,minGap=90/span;
    if(Math.abs(gap)<minGap){
      const sign=gap===0?((b.anchorSlot??0)>=(other.anchorSlot??0)?1:-1):Math.sign(gap);
      target+=sign*(minGap-Math.abs(gap))*.45;
    }
  }
  target=Math.max(0,Math.min(1,target));
  const change=Math.max(-42*dt/span,Math.min(42*dt/span,(target-b.slot)*(1-Math.exp(-1.8*dt))));
  b.slot=Math.max(0,Math.min(1,b.slot+change));placeBot(b);
  b.glideSpeed=dt>0?Math.abs(change)*span/dt:0;
  if(b.glideSpeed>1)b.flightAngle=vertical?(change>0?Math.PI/2:-Math.PI/2):(change>0?0:Math.PI);
  EnemyWeapon.step(b,dt,player);
  b.cool-=dt;
  const c=combatDifficulty(score/10);
  if(!b.attack&&b.cool<=c.warning)prepareAttack(b,c);
  if(b.attack&&b.cool<=0)shoot(b);
}
function drawAttackWarning(b){
  const duration=b.attack.warningDuration||.45;
  const age=Math.max(0,duration-b.cool);
  const intro=Math.min(1,age/.16);
  const pulse=reducedMotion.matches?0:Math.sin(age*22);
  const pop=reducedMotion.matches?1:1-Math.pow(1-intro,3)+Math.sin(intro*Math.PI)*.25;
  const scale=pop*(1+pulse*.07);
  // Keep the alert upright and inside the arena, regardless of the bot's aim.
  const x=Math.max(18,Math.min(W-18,b.x));
  const y=Math.max(29,b.y-61)-(reducedMotion.matches?0:Math.sin(intro*Math.PI)*7);
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  ctx.shadowColor='#ff263f';ctx.shadowBlur=16+pulse*4;
  ctx.fillStyle='#ff344d';ctx.strokeStyle='#590b20';ctx.lineWidth=2.5;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(-6,-15);ctx.lineTo(6,-15);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.closePath();ctx.stroke();ctx.fill();
  ctx.beginPath();ctx.roundRect(-4,10,8,8,2);ctx.stroke();ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle='#ffb0b8';ctx.fillRect(-3,-12,2,11);
  ctx.restore();
}
function drawBot(b){
  if(b.entering||b.glideSpeed>3){
    const thrust=b.entering?1-b.entry/b.entryDuration:Math.min(.3,b.glideSpeed/140);
    ctx.save();ctx.translate(b.x,b.y+12);ctx.rotate(b.flightAngle);
    ctx.globalCompositeOperation='screen';
    const length=18+thrust*65;
    const jet=ctx.createLinearGradient(-length,0,-12,0);
    jet.addColorStop(0,'#63dfff00');jet.addColorStop(.65,'#63dfff80');jet.addColorStop(1,'#deffff');
    ctx.fillStyle=jet;ctx.beginPath();ctx.moveTo(-12,-5);
    ctx.quadraticCurveTo(-length*.65,-8,-length,0);
    ctx.quadraticCurveTo(-length*.65,8,-12,5);ctx.fill();ctx.restore();
  }
  if(!b.entering&&b.attack){
    const color={common:'#ffd176',burst:'#ff9672',homing:'#cf9fff'}[b.attack.type];
    ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=.5;ctx.lineWidth=1.5;
    const muzzle=EnemyWeapon.muzzle(b);ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(muzzle.x,muzzle.y);ctx.lineTo(muzzle.x+Math.cos(b.lockAim)*85,muzzle.y+Math.sin(b.lockAim)*85);ctx.stroke();ctx.restore();
  }
  const pose=EnemyWeapon.pose(b);
  robot(pose.x,pose.y-10,b.flightAngle,b.color,b.name,true,'idle',b.filter);
  EnemyWeapon.draw(ctx,b);
  if(!b.entering&&b.attack)drawAttackWarning(b);
}
function burst(x,y,color,n=14,kind='explosion-1'){particles.push({x,y,vx:0,vy:0,life:.55,color,kind,size:110});for(let i=0;i<n;i++){let a=Math.random()*7,v=50+Math.random()*220;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.3+Math.random()*.6,color,kind:'damage-particles',size:28})}}
function update(dt){
  const now=performance.now();
  if(dashQueuedUntil&&now>=dashReady){if(now<=dashQueuedUntil)triggerDash();dashQueuedUntil=0;}
  if(!readyNotified&&now>=dashReady){readyNotified=true;corePulse=1;GameAudio.play('ready');ui.dash.classList.add('ready-pop');}
  const dashing=now<dashUntil,oldX=player.x,oldY=player.y;
  let {x:dx,y:dy}=ControlBindings.vector(keys);
  const length=Math.hypot(dx,dy);if(length){dx/=length;dy/=length;player.a=Math.atan2(dy,dx);}
  const progress=dashing?1-(dashUntil-now)/DASH_DURATION:-1;
  if(dashing){const speed=980-620*progress;player.vx=dashDirection.x*speed;player.vy=dashDirection.y*speed;}
  else{
    const ease=1-Math.exp(-(length?22:18)*dt);
    player.vx+=(dx*250-player.vx)*ease;player.vy+=(dy*250-player.vy)*ease;
    if(!length&&Math.hypot(player.vx,player.vy)<.5)player.vx=player.vy=0;
  }
  player.x+=player.vx*dt;player.y+=player.vy*dt;
  if(player.x<40||player.x>W-40)player.vx=0;
  if(player.y<110||player.y>H-45)player.vy=0;
  player.x=Math.max(40,Math.min(W-40,player.x));player.y=Math.max(110,Math.min(H-45,player.y));
  player.moving=Math.hypot(player.vx,player.vy)>10;
  if(length&&!lastInput.x&&!lastInput.y&&!dashing)GameAudio.play('move',dx*.35);
  if(length&&(lastInput.x||lastInput.y)&&dx*lastInput.x+dy*lastInput.y<.3&&!dashing)GameAudio.play('turn',dx*.35);
  if(!length&&(lastInput.x||lastInput.y)&&!dashing)GameAudio.play('stop');
  if(lastDash&&!dashing)GameAudio.play('settle');
  lastInput={x:dx,y:dy};lastDash=dashing;
  GameAudio.movement(Math.hypot(player.vx,player.vy),dashing);
  RobotMotion.step(motion,dt,player.x,player.y,player.vx,player.vy,progress);
  spawnClock-=dt;
  const difficulty=combatDifficulty(score/10);
  if(spawnClock<=0&&bots.length<difficulty.bots){newBot();spawnClock=difficulty.spawn;}
  bots.forEach(b=>updateBot(b,dt));
  for(const s of shots){
    const ax=s.x-oldX,ay=s.y-oldY;
    steerNugget(s,dt);
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
    const bx=s.x-player.x,by=s.y-player.y,distance=closestPass(ax,ay,bx,by);
    if(distance<24){
      if(!dashing){burst(s.x,s.y,'#ff963f',10,'impact');end();return;}
      if(!s.phased){s.phased=true;s.grazed=true;cue(s.x,s.y,'phase');GameAudio.play('phase',bx/70);}
    }else if(!s.grazed&&!dashing){
      if(distance<48)s.close=true;
      // Celebrate only after the projectile moves away, not as it approaches.
      if(s.close&&bx*bx+by*by>ax*ax+ay*ay){s.grazed=true;cue(s.x,s.y,'near');GameAudio.play('near',bx/60);}
    }
    if(s.life<=0){burst(s.x,s.y,'#ffb63d',4,'impact');CrystalSystem.drop(crystalState,s.x,s.y,W,H,Math.random,s.type,bots.length);}
  }
  shots=shots.filter(s=>s.life>0&&s.x>-50&&s.x<W+50&&s.y>-50&&s.y<H+50);
  const earnedBefore=crystalState.earned;
  CrystalSystem.step(crystalState,dt,player,c=>{dashReady=0;dashQueuedUntil=0;readyNotified=true;crystalFx.push({x:c.x,y:c.y,age:0});GameAudio.play('crystal');});
  bankCrystals(crystalState.earned-earnedBefore);
  score+=dt*10;
  const t=(now-started)/1000,mult=1+Math.floor(t/25)*.1;
  ui.score.textContent=String(Math.floor(score*mult)).padStart(6,'0');
  ui.time.textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  ui.mult.textContent='x'+mult.toFixed(1);
  const boosted=crystalState.dashBoostRemaining>0;
  ui.dash.classList.toggle('gem-boost',boosted);
  const pct=boosted?crystalState.dashBoostRemaining/CrystalSystem.dashBoostDuration:Math.max(0,Math.min(1,1-(dashReady-now)/1250));
  ui.dash.querySelector('em').style.width=(pct*100)+'%';
  ui.dash.querySelector('span').textContent=boosted?'DASH LIVRE':pct>=1?'DASH PRONTO':'RECARREGANDO';
}

function drawNugget(s){
  const heading=Math.atan2(s.vy,s.vx);
  ctx.save();ctx.translate(s.x,s.y);
  // Short directional exhaust keeps the food silhouette unobscured.
  ctx.save();ctx.rotate(heading);
  const trail=ctx.createLinearGradient(-34,0,-9,0);
  const tint=s.type==='homing'?(s.tracking>0?'#cc91ff':'#829aa9'):s.type==='burst'?'#ff916b':'#ffb54b';
  trail.addColorStop(0,tint+'00');trail.addColorStop(1,tint+'a0');
  ctx.fillStyle=trail;ctx.beginPath();ctx.moveTo(-9,-4);
  ctx.quadraticCurveTo(-22,-3,-34,0);ctx.quadraticCurveTo(-22,3,-9,4);ctx.fill();ctx.restore();
  if(s.type==='homing'&&s.tracking>0){ctx.strokeStyle='#d3a6ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,21,-.7,.7);ctx.stroke();ctx.beginPath();ctx.arc(0,0,21,Math.PI-.7,Math.PI+.7);ctx.stroke();}
  ctx.rotate(s.angle+(5-s.life)*s.spin);
  ctx.shadowBlur=9;ctx.shadowColor='#ffab4266';
  const selected=art[s.sprite];
  const sprite=selected&&selected.complete&&selected.naturalWidth?selected:art['nugget-projectile'];
  if(sprite.complete&&sprite.naturalWidth){
    ctx.drawImage(sprite,-17,-17,34,34);
  }else{
    // Readable fallback while the PNG loads.
    ctx.fillStyle='#eaaa42';ctx.strokeStyle='#9e571e';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-9,-11);ctx.quadraticCurveTo(5,-16,8,-6);
    ctx.quadraticCurveTo(5,0,12,3);ctx.quadraticCurveTo(16,13,2,12);
    ctx.quadraticCurveTo(-14,13,-12,0);ctx.closePath();ctx.fill();ctx.stroke();
  }
  ctx.restore();
}
function draw(){
  ctx.save();
  if(deathAge>=0&&deathAge<.2&&!reducedMotion.matches){const amount=3*(1-deathAge/.2);ctx.translate(Math.sin(deathAge*180)*amount,Math.cos(deathAge*140)*amount);}
  arena();bots.forEach(drawBot);if(running||deathAge>=0)CrystalSystem.draw(ctx,crystalState.items,performance.now(),reducedMotion.matches);shots.forEach(drawNugget);
  particles.forEach(p=>blend(art[p.kind],p.x,p.y,p.size,p.size,0,Math.max(0,p.life*2)));
  if(deathAge<0&&ui.start.classList.contains('hidden')){
    RobotMotion.render(ctx,cachedSprite,motion,player.x,player.y,skins[avatar][3],skins[avatar][4],art.player_robot.complete&&art.player_robot.naturalWidth>0);
    ctx.font='bold 13px Oxanium';ctx.textAlign='center';ctx.fillStyle=skins[avatar][3];ctx.fillText(player.name,player.x,player.y-47-motion.lift);
  }
  if(deathAge<0&&ui.start.classList.contains('hidden'))SkinArt.accents(ctx,avatar,motion,player.x,player.y);drawFeedback();SpaceScene.foreground(ctx,W,H);ctx.restore();
}
let paused=false,pausedAt=0;
function setPaused(value){
  if(value===paused||(!running&&value)||window.Multiplayer?.active)return false;
  const now=performance.now();
  if(value){pausedAt=now;keys={};dashQueuedUntil=0;GameAudio.hush();}
  else{const elapsed=now-pausedAt;started+=elapsed;if(dashReady)dashReady+=elapsed;if(dashUntil)dashUntil+=elapsed;last=now;}
  paused=value;document.body.classList.toggle('is-paused',paused);document.body.classList.toggle('pause-menu-open',paused);
  return true;
}
function frame(now){
  const dt=Math.max(0,Math.min(.033,(now-last)/1000));last=now;
  if(!document.hidden){
    window.MenuUI?.refreshGameTools();
    if(window.Multiplayer?.active){window.Multiplayer.frame(dt,now);requestAnimationFrame(frame);return;}
    if(paused){requestAnimationFrame(frame);return;}
    if(running)update(dt);
    if(deathAge>=0){deathAge+=dt;if(deathAge>=.55)ui.over.classList.remove('hidden');}
    updateEffects(deathAge>=0&&deathAge<.065?0:dt);
    draw();CrystalSystem.feedback(ctx,crystalFx,dt);
  }
  requestAnimationFrame(frame);
}

function start(){if(document.body.classList.contains('at-home')||document.querySelector('#settings-dialog')?.open||document.querySelector('#skin-shop')?.open)return;if(window.Multiplayer?.active||window.Multiplayer?.joining||document.body.classList.contains('is-loading'))return;document.body.classList.remove('in-menu');activeMode=selectedMode;sync();nextHomingAt=0;document.querySelector('#active-mode').textContent=CombatBalance.modes[activeMode].label;GameAudio.unlock();GameAudio.play('start');deathAge=-1;feedback=[];corePulse=1;dashQueuedUntil=0;readyNotified=true;lastInput={x:0,y:0};lastDash=false;ui.dash.classList.remove('ready-pop','gem-boost');SpaceScene.reset();player={x:W/2,y:H/2,a:-Math.PI/2,vx:0,vy:0,name:document.querySelector('#name').value.trim()||'Piloto-01'};crystalState=CrystalSystem.create(activeMode);crystalFx=[];score=0;shots=[];bots=[];particles=[];spawnClock=0;started=performance.now();dashReady=0;dashUntil=0;motion=RobotMotion.create();keys={};cancelAnimationFrame(previewRaf);running=true;ui.start.classList.add('hidden');ui.over.classList.add('hidden');ui.signal.style.opacity=1;setTimeout(()=>ui.signal.style.opacity=0,1800);last=started;}
function end(){if(!running)return;running=false;deathAge=0;dashQueuedUntil=0;keys={};GameAudio.hush();GameAudio.play('death');burst(player.x,player.y,skins[avatar][3],40,'explosion-2');draw();let points=Math.floor(score*(1+Math.floor((performance.now()-started)/25000)*.1));ModeRecords.record(save,activeMode,points);save.xp+=Math.floor(points/12);localStorage.setItem('robot-arena-save',JSON.stringify(save));sync();document.querySelector('#final-score').textContent=points;document.querySelector('#final-time').textContent=ui.time.textContent;document.querySelector('#final-xp').textContent='+'+Math.floor(points/12);document.querySelector('#final-crystals').textContent='+'+crystalState.earned;}
document.querySelector('#start-form').addEventListener('submit',e=>{e.preventDefault();start()});document.querySelector('#retry').onclick=()=>start();function triggerDash(){
  const now=performance.now();if(!running||paused)return;
  if(crystalState.dashBoostRemaining<=0&&now<dashReady){if(dashReady-now<=100)dashQueuedUntil=dashReady+100;else GameAudio.play('blocked');return;}
  dashQueuedUntil=0;readyNotified=false;ui.dash.classList.remove('ready-pop');
  let {x:dx,y:dy}=ControlBindings.vector(keys);
  const length=Math.hypot(dx,dy);
  dashDirection=length?{x:dx/length,y:dy/length}:{x:Math.cos(player.a),y:Math.sin(player.a)};
  player.a=Math.atan2(dashDirection.y,dashDirection.x);
  dashUntil=now+DASH_DURATION;dashReady=crystalState.dashBoostRemaining>0?0:now+1250;
  GameAudio.play('dash',dashDirection.x*.3);
  RobotMotion.ignite(motion,player.x,player.y,player.a);
}
// Track physical keys so modifiers/layout changes cannot strand a direction.
function movementKey(e){return ControlBindings.movementKey(e);}
function resetControls(){
  keys={};dashQueuedUntil=0;lastInput={x:0,y:0};lastDash=false;GameAudio.hush();
  player.vx=player.vy=0;player.moving=false;
  if(!paused)dashUntil=0;
}
addEventListener('keydown',e=>{
  if(document.body.classList.contains('at-home')||document.querySelector('#settings-dialog')?.open||window.Multiplayer?.active||document.querySelector('#skin-shop')?.open)return;
  if(e.target.closest?.('#mp-join-form')||e.target.closest?.('.multiplayer-panel'))return;
  // System shortcuts may consume keyup; do not retain movement through them.
  if(e.metaKey||e.ctrlKey||e.altKey){resetControls();return;}
  if(document.body.classList.contains('pause-menu-open')&&e.key!=='Escape')return;
  if(e.key==='Enter'&&!running&&!ui.start.classList.contains('hidden')){
    e.preventDefault();start();return;
  }
  if(e.key==='Enter'&&!running&&!ui.over.classList.contains('hidden')){e.preventDefault();start();return;}
  if(e.key==='Escape'&&running&&!e.repeat){e.preventDefault();setPaused(!paused);return;}
  if(!running||paused||document.hidden)return;
  GameAudio.unlock();
  const key=movementKey(e);
  if(key||ControlBindings.matches('dash',e))e.preventDefault();
  // Repeats never resurrect a key cleared on loss of focus.
  if(e.repeat)return;
  if(key)keys[key]=true;
  if(ControlBindings.matches('dash',e))triggerDash();
},true);
addEventListener('keyup',e=>{
  const key=movementKey(e);
  if(key)delete keys[key];
},true);
addEventListener('blur',resetControls);
addEventListener('focus',resetControls);
addEventListener('pagehide',resetControls);
addEventListener('contextmenu',resetControls);
document.addEventListener('visibilitychange',()=>{resetControls();last=performance.now();});
function resizeArena(){
  const oldW=W,oldH=H;
  const scale=Math.min(innerWidth/700,innerHeight/780);
  W=innerWidth/scale;H=innerHeight/scale;
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  const remap=p=>{p.x=p.x/oldW*W;p.y=p.y/oldH*H;};
  [player,...shots,...crystalState.items,...particles].forEach(remap);
  bots.forEach(placeBot);
  player.x=Math.max(40,Math.min(W-40,player.x));player.y=Math.max(110,Math.min(H-45,player.y));
  motion.ghosts=[];motion.sparks=[];motion.rings=[];
}
addEventListener('resize',resizeArena);
resizeArena();
draw();
requestAnimationFrame(frame);

const soundButton=document.querySelector('#sound-toggle');
function syncSound(){soundButton.title=GameAudio.muted?'Ativar som':'Desativar som';soundButton.setAttribute('aria-pressed',String(!GameAudio.muted));}
soundButton.addEventListener('click',()=>{GameAudio.toggle();syncSound();GameAudio.play('select');});
syncSound();

document.querySelector('#back-menu').onclick=()=>{
  document.body.classList.add('in-menu');
  deathAge=-1;particles=[];feedback=[];shots=[];bots=[];corePulse=0;
  motion=RobotMotion.create();ui.start.classList.remove('hidden');ui.over.classList.add('hidden');
  GameAudio.unlock();GameAudio.play('select');draw();startPreview();
};

// Show the logo while essential artwork and fonts load, with a bounded fallback.
(async function bootMenu(){
  const artwork=Object.values(art).map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});}));
  await Promise.all([
    new Promise(resolve=>setTimeout(resolve,1100)),
    Promise.race([Promise.all([...artwork,document.fonts.ready]),new Promise(resolve=>setTimeout(resolve,6000))])
  ]);
  document.body.classList.remove('is-loading');
  ui.start.inert=document.body.classList.contains('at-home');
  const splash=document.querySelector('#loading-screen');splash.classList.add('leaving');
  setTimeout(()=>splash.remove(),450);
  if(!document.body.classList.contains('at-home'))startPreview();
})();

function selectMode(mode){
  selectedMode=mode;sync();
  document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
  try{localStorage.setItem('robot-arena-mode',mode);}catch{}
}
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{selectMode(button.dataset.mode);GameAudio.unlock();GameAudio.play('select');}));
selectMode(selectedMode);
