// Space layers react to the pilot while collision coordinates remain stable.
const SpaceScene=(()=>{
  const background=new Image(),comet=new Image();
  background.src='assets/nugget-space.png';comet.src='assets/nugget-comet.png';
  const reduced={get matches(){return I18n.reducedMotion;}};
  const stars=Array.from({length:110},(_,i)=>({x:((i*719+131)%1400)/1400,y:((i*293+47)%787)/787,depth:1+i%3,phase:i*2.4}));
  let time=0,previous=0,nextComet=7,active=null,cameraX=0,cameraY=0,orbitX=0,orbitY=0;
  const wrap=(v,max)=>((v%max)+max)%max;
  function draw(ctx,w,h,now,pilot={x:w/2,y:h/2},playing=false){
    const dt=previous?Math.min(.05,Math.max(0,(now-previous)/1000)):0;previous=now;
    const moving=!document.hidden&&!reduced.matches;
    if(moving)time+=dt;
    // Integrate travel into a bounded viewing angle; stopping preserves the view.
    const vx=playing&&moving?(pilot.vx||0):0,vy=playing&&moving?(pilot.vy||0):0;
    const clamp=v=>Math.max(-1,Math.min(1,v));
    if(moving){
      orbitX=clamp(orbitX+vx*dt/w*.85);
      orbitY=clamp(orbitY+vy*dt/h*.65);
    }
    const ease=1-Math.exp(-2.4*dt);
    const targetX=moving?clamp(orbitX*.65+(pilot.x/w-.5)*.8+vx/250*.1):0;
    const targetY=moving?clamp(orbitY*.65+(pilot.y/h-.5)*.8+vy/250*.08):0;
    cameraX+=(targetX-cameraX)*ease;
    cameraY+=(targetY-cameraY)*ease;
    ctx.save();ctx.fillStyle='#030913';ctx.fillRect(0,0,w,h);
    if(background.complete&&background.naturalWidth){
      const scale=Math.max(w/background.naturalWidth,h/background.naturalHeight)*1.28;
      const bw=background.naturalWidth*scale,bh=background.naturalHeight*scale;
      const offsetX=(bw-w)*(.53+cameraX*.43);
      const offsetY=(bh-h)*(.24+cameraY*.22);
      ctx.drawImage(background,-offsetX,-offsetY,bw,bh);
    }
    const shade=ctx.createRadialGradient(w*.5,h*.55,h*.12,w*.5,h*.55,Math.max(w,h)*.72);
    shade.addColorStop(0,'rgba(2,8,18,.08)');shade.addColorStop(1,'rgba(2,8,18,.38)');
    ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    for(const star of stars){
      const d=star.depth;
      ctx.globalAlpha=.1+d*.045+Math.sin(time*.4+star.phase)*.035;
      ctx.fillStyle='#bad7df';ctx.beginPath();
      ctx.arc(wrap(star.x*w+time*d*1.3-cameraX*w*.085*d,w),wrap(star.y*h+time*d*.4-cameraY*h*.075*d,h),.35+d*.27,0,Math.PI*2);ctx.fill();
    }
    if(!reduced.matches){
      if(!active&&time>=nextComet)active={start:time,duration:15+Math.random()*4,top:Math.random()>.5};
      if(active){
        const p=(time-active.start)/active.duration;
        if(p>=1){active=null;nextComet=time+22+Math.random()*18;}
        else if(comet.complete&&comet.naturalWidth){
          const width=240,height=width*comet.naturalHeight/comet.naturalWidth;
          ctx.globalAlpha=.48*Math.min(1,p*7,(1-p)*7);
          ctx.drawImage(comet,-width+p*(w+width*2)-cameraX*w*.12,active.top?80-cameraY*h*.08:h-height-8-cameraY*h*.08,width,height);
        }
      }
    }
    ctx.restore();
  }
  function foreground(ctx,w,h){
    ctx.save();ctx.fillStyle='#96bcc9';
    for(let i=0;i<14;i++){
      const x=wrap(i*173.7+time*5-cameraX*w*.4,w),y=wrap(i*311.3+time*1.5-cameraY*h*.35,h);
      ctx.globalAlpha=.055;ctx.beginPath();ctx.arc(x,y,1.6+i%3*.5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function reset(){orbitX=orbitY=cameraX=cameraY=0;previous=0;}
  return {draw,foreground,reset};
})();
