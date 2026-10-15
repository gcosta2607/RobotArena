(function(root){
  const gem=typeof Image!=='undefined'?new Image():null;
  if(gem)gem.src='assets/energy-gem.png';
  const rewards={easy:{drop:.06,time:1},normal:{drop:.12,time:2},hard:{drop:.18,time:3}};
  const CrystalSystem={
    dashBoostDuration:1.5,
    create(mode='normal'){return {mode:Object.hasOwn(rewards,mode)?mode:'normal',items:[],earned:0,collected:0,survival:0,time:0,nextId:0,dashBoostRemaining:0};},
    drop(state,x,y,width,height,random=Math.random,type='common',enemyCount=1){
      // Compensate for additional shooters so their combined drops stay controlled.
      const population=Number.isFinite(enemyCount)?Math.max(1,enemyCount):1;
      const chance=rewards[state.mode].drop/population/(type==='burst'?3:1);
      if(x<40||x>width-40||y<110||y>height-45||random()>=chance)return;
      state.items.push({id:++state.nextId,x,y,life:6,age:0});
    },
    step(state,dt,player,collect=()=>{}){
      state.time+=dt;
      state.dashBoostRemaining=Math.max(0,(state.dashBoostRemaining||0)-dt);
      const reward=Math.floor((state.time+1e-8)/30)*rewards[state.mode].time;
      state.earned+=reward-state.survival;state.survival=reward;
      for(const c of state.items){
        c.life-=dt;c.age+=dt;
        const d=Math.hypot(player.x-c.x,player.y-c.y);
        if(d<80){const move=Math.min(d, (100+(80-d)*9)*dt);if(d){c.x+=(player.x-c.x)/d*move;c.y+=(player.y-c.y)/d*move;}}
        if(c.life>0&&Math.hypot(player.x-c.x,player.y-c.y)<23){c.life=0;state.collected+=1;state.earned+=1;state.dashBoostRemaining=CrystalSystem.dashBoostDuration;collect(c);}
      }
      state.items=state.items.filter(c=>c.life>0);
    },
    draw(ctx,items,time,reduced=false){
      const outer=[[0,-19],[14,-10],[14,10],[0,19],[-14,10],[-14,-10]];
      
      const polygon=points=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();};
      for(const c of items){
        ctx.save();ctx.translate(c.x,c.y);
        ctx.globalAlpha=c.life<1.5?(Math.sin(time*.018)>0?1:.4):1;
        const pulse=reduced?1:1+Math.sin(time*.003+c.id)*.12;
        ctx.fillStyle='#43ff7a30';ctx.beginPath();ctx.ellipse(0,13,19*pulse,5,0,0,Math.PI*2);ctx.fill();
        ctx.translate(0,-9+(reduced?0:Math.sin(time*.0025+c.id)*3));
        const halo=ctx.createRadialGradient(0,0,5,0,0,36*pulse);halo.addColorStop(0,'#6bff9860');halo.addColorStop(1,'#20ff6400');ctx.fillStyle=halo;ctx.fillRect(-42,-42,84,84);
        if(gem?.complete&&gem.naturalWidth){ctx.shadowColor='#46e786';ctx.shadowBlur=7*pulse;ctx.drawImage(gem,-26,-26,52,52);ctx.shadowBlur=0;}
        // A narrow reflection sweeps across the polished center face.
        ctx.save();polygon(outer);ctx.clip();const sweep=reduced?-5:((time*.025+c.id*17)%85)-42;ctx.translate(sweep,0);ctx.rotate(.35);const shine=ctx.createLinearGradient(-5,0,5,0);shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,'#efffff40');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.fillRect(-5,-30,10,60);ctx.restore();
        const sparkle=reduced?.75:.45+.55*Math.pow(Math.max(0,Math.sin(time*.004+c.id)),4);ctx.globalAlpha*=sparkle;ctx.translate(-10,-12);ctx.fillStyle='#f0fff3';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(1.6,-1.6);ctx.lineTo(6,0);ctx.lineTo(1.6,1.6);ctx.lineTo(0,7);ctx.lineTo(-1.6,1.6);ctx.lineTo(-6,0);ctx.lineTo(-1.6,-1.6);ctx.closePath();ctx.fill();ctx.restore();
      }
    },
    feedback(ctx,effects,dt){for(let i=effects.length-1;i>=0;i--){const f=effects[i];f.age+=dt;ctx.save();ctx.globalAlpha=Math.max(0,1-f.age/.8);ctx.fillStyle='#a2ffba';ctx.font='bold 19px Oxanium';ctx.textAlign='center';ctx.fillText('+1',f.x,f.y-25-f.age*35);for(let j=0;j<7;j++){const a=j*Math.PI*2/7,r=8+f.age*45;ctx.fillRect(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,3,3);}ctx.restore();if(f.age>=.8)effects.splice(i,1);}}
  };if(typeof module!=='undefined')module.exports=CrystalSystem;else root.CrystalSystem=CrystalSystem;
})(typeof globalThis!=='undefined'?globalThis:this);
