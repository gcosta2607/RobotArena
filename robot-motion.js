// Shared movement with atlas poses and articulated illustrated skins.
const RobotMotion = (() => {
  const TAU = Math.PI * 2;
  const poseCanvas=document.createElement('canvas');
  poseCanvas.width=300;poseCanvas.height=330;
  const poseCtx=poseCanvas.getContext('2d');
  const damp = (value, target, rate, dt) => target + (value - target) * Math.exp(-rate * dt);
  function create() {
    return {time:0, phase:0, travel:0, bank:0, bankV:0, lift:0, boost:0,
      dashPose:0, dashFrame:0, dashAngle:0, selectionPulse:0, recoil:0, wasDashing:false, ghosts:[], sparks:[], rings:[], emit:0};
  }
  function ignite(m, x, y, angle) {
    m.rings.push({x,y,angle,age:0});
    m.dashAngle=angle;
    m.boost=1;
    m.dashPose=1;
    m.dashFrame=0;
  }
  function step(m, dt, x, y, vx, vy, dashProgress) {
    m.time+=dt;
    m.selectionPulse=Math.max(0,m.selectionPulse-dt*3);
    const speed=Math.hypot(vx,vy), dashing=dashProgress>=0;
    m.travel=damp(m.travel,Math.min(1,speed/250),14,dt);
    m.phase+=dt*(3.5+m.travel*8);
    // A damped spring gives turns a small, controlled follow-through.
    const target=Math.max(-.25,Math.min(.25,vx/250*.15));
    m.bankV+=((target-m.bank)*160-m.bankV*22)*dt;
    m.bank+=m.bankV*dt;
    m.lift=damp(m.lift,m.travel*3+(dashing?3:0),12,dt);
    if(m.wasDashing&&!dashing)m.recoil=1;
    m.wasDashing=dashing;
    m.recoil=damp(m.recoil,0,14,dt);
    m.boost=damp(m.boost,dashing?1:0,16,dt);
    m.dashPose=damp(m.dashPose,dashing?1:0,22,dt);
    if(dashing)m.dashFrame=Math.min(15,dashProgress*16);
    m.ghosts.forEach(g=>g.age+=dt);
    m.ghosts=m.ghosts.filter(g=>g.age<.2);
    m.rings.forEach(r=>r.age+=dt);
    m.rings=m.rings.filter(r=>r.age<.36);
    m.sparks.forEach(p=>{p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;});
    m.sparks=m.sparks.filter(p=>p.age<p.life);
    m.emit+=dt;
    if(m.emit>=1/60&&!window.I18n?.reducedMotion){
      m.emit%=1/60;
      if(dashing)m.ghosts.push({x,y,age:0,pose:pose(m)});
      if(speed>25){
        const a=Math.atan2(vy,vx), spread=Math.sin(m.time*87)*9;
        m.sparks.push({x:x-Math.cos(a)*15+Math.sin(a)*spread,
          y:y+15-Math.sin(a)*15-Math.cos(a)*spread,
          vx:-vx*.12,vy:24-vy*.12,age:0,life:dashing?.28:.18,boost:dashing});
      }
    }
    m.sparks=m.sparks.slice(-40);
  }
  function pose(m) {
    const quiet=window.I18n?.reducedMotion;
    const pulse=Math.sin(m.phase), thrust=m.boost;
    return {idle:quiet?0:(m.time*8)%16, walk:quiet?0:(m.phase/TAU*16)%16,
      time:m.time,travel:m.travel*.85,dash:m.dashPose,dashFrame:m.dashFrame,
      y:quiet?0:-m.lift+Math.sin(m.time*2.1)*2.4,
      bank:quiet?0:m.bank+Math.sin(m.time*2.1)*.012,
      sx:1+Math.cos(m.dashAngle*2)*(thrust*.025-m.recoil*.015),
      sy:1-Math.cos(m.dashAngle*2)*(thrust*.025-m.recoil*.015),
      thrust,phase:m.phase};
  }
  function frame(c, sample, row, index, alpha, filter) {
    if(alpha<.002)return;
    const i=Math.floor(index)%16, next=(i+1)%16, mix=index-Math.floor(index);
    // Two adjacent original poses soften the atlas's 16-frame cadence.
    c.globalAlpha=alpha*(1-mix);
    c.drawImage(sample(row,i,filter),-37,-40.51,74,81.02);
    if(mix>.002){c.globalAlpha=alpha*mix;c.drawImage(sample(row,next,filter),-37,-40.51,74,81.02);}
  }
  function body(c,sample,p,filter,alpha=1) {
    // Keep the full source detail in enlarged previews without enlarging gameplay buffers.
    const transform=c.getTransform?.();
    const density=transform?Math.max(3,Math.min(12,Math.ceil(Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d))))):3;
    if(poseCanvas.width!==100*density){poseCanvas.width=100*density;poseCanvas.height=110*density;}
    poseCtx.imageSmoothingEnabled=true;poseCtx.imageSmoothingQuality='high';
    if(filter.startsWith('skin:')||filter.startsWith('preview:')){
      poseCtx.clearRect(0,0,poseCanvas.width,poseCanvas.height);poseCtx.save();poseCtx.scale(density,density);poseCtx.translate(50,55);
      poseCtx.globalCompositeOperation='lighter';
      if(filter.startsWith('preview:'))SkinArt.drawBody(poseCtx,'default',p,SkinArt.defaultSample(filter.slice(8)));
      else SkinArt.drawBody(poseCtx,filter.slice(5),p);
      poseCtx.restore();
      c.save();c.translate(0,p.y);c.rotate(p.bank);c.scale(p.sx,p.sy);c.globalAlpha=alpha;
      c.drawImage(poseCanvas,-50,-55,100,110);c.restore();return;
    }
    // Blend on a transparent surface so the arena never changes the robot's colors.
    poseCtx.clearRect(0,0,poseCanvas.width,poseCanvas.height);poseCtx.save();poseCtx.scale(density,density);poseCtx.translate(50,55);
    poseCtx.globalCompositeOperation='lighter';
    frame(poseCtx,sample,0,p.idle,(1-p.travel)*(1-p.dash),filter);
    frame(poseCtx,sample,462,p.walk,p.travel*(1-p.dash),filter);
    frame(poseCtx,sample,924,Math.min(15,p.dashFrame),p.dash,filter);
    poseCtx.restore();
    c.save();c.translate(0,p.y);c.rotate(p.bank);c.scale(p.sx,p.sy);
    c.globalAlpha=alpha;c.drawImage(poseCanvas,-50,-55,100,110);
    c.restore();
  }
  function jet(c,x,y,length,color,time) {
    c.save();c.translate(x,y);
    const gradient=c.createLinearGradient(0,0,0,length);
    gradient.addColorStop(0,'#e8ffff');gradient.addColorStop(.2,color);gradient.addColorStop(1,'transparent');
    c.fillStyle=gradient;c.globalCompositeOperation='screen';
    c.beginPath();c.moveTo(-2.4,0);c.quadraticCurveTo(-4,length*.35,Math.sin(time*71)*1.2,length);
    c.quadraticCurveTo(4,length*.35,2.4,0);c.fill();c.restore();
  }
  function render(c,sample,m,x,y,color,filter,ready=true,preview=false) {
    if(preview&&!filter.startsWith('skin:')&&SkinArt.defaultSample(filter))filter='preview:'+filter;
    const p=pose(m);
    c.save();
    for(const r of (window.I18n?.reducedMotion?[]:m.rings)){
      const t=r.age/.36;c.save();c.translate(r.x,r.y);c.rotate(r.angle);
      c.strokeStyle=color;c.globalAlpha=(1-t)*.55;c.lineWidth=2*(1-t)+.5;
      c.beginPath();c.ellipse(0,0,7+t*22,17+t*24,0,0,TAU);c.stroke();c.restore();
    }
    for(const g of (window.I18n?.reducedMotion?[]:m.ghosts)){
      c.save();c.translate(g.x,g.y);body(c,sample,g.pose,filter,.22*(1-g.age/.2));c.restore();
    }
    c.strokeStyle=color;c.lineCap='round';
    for(const s of (window.I18n?.reducedMotion?[]:m.sparks)){
      c.globalAlpha=(1-s.age/s.life)*(s.boost?.65:.32);c.lineWidth=s.boost?2:1.2;
      c.beginPath();c.moveTo(s.x,s.y);c.lineTo(s.x+s.vx*.035,s.y+s.vy*.035+2);c.stroke();
    }
    c.globalAlpha=1;c.translate(x,y);
    c.save();c.translate(0,p.y);c.rotate(p.bank);
    // The original dash frames already contain exhaust; these are the gentle hover jets.
    const illustrated=filter.startsWith('skin:');c.globalAlpha=(illustrated?1:1-p.dash)*(.35+m.travel*.55);
    const length=9+m.travel*14+(illustrated?m.boost*28:0)+Math.sin(m.time*49)*1.3;
    jet(c,-11,28,length,color,m.time);jet(c,10,33,length*.9,color,m.time+.04);
    c.restore();
    if(ready)body(c,sample,p,filter);
    if(m.selectionPulse>0){
      c.globalAlpha=m.selectionPulse*.6;c.strokeStyle=color;c.lineWidth=1.3;
      c.beginPath();c.arc(0,p.y+6,6+(1-m.selectionPulse)*12,0,TAU);c.stroke();
    }
    c.restore();
  }
  return {create,ignite,step,render};
})();
