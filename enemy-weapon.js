// Shared weapon pose keeps the grip, flash and projectile origin aligned.
const EnemyWeapon=(()=>{
  const art=new Image();art.src='assets/nugget-launcher.png';
  function pose(b){
    const angle=b.aim??0,recoil=(b.recoil||0)*4;
    const bob=Math.sin(b.phase*1.8)*2.5;
    return {angle,bob,x:b.x-Math.cos(angle)*recoil,y:b.y+10+bob-Math.sin(angle)*recoil};
  }
  function muzzle(b){const p=pose(b);return {x:p.x+Math.cos(p.angle)*40,y:p.y+Math.sin(p.angle)*40,angle:p.angle};}
  function step(b,dt,player){
    b.recoil=(b.recoil||0)*Math.exp(-16*dt);
    b.flash=Math.max(0,(b.flash||0)-dt);
    const target=b.lockAim??Math.atan2(player.y-b.y-10-Math.sin(b.phase*1.8)*2.5,player.x-b.x);
    if(b.aim===undefined)b.aim=target;
    const delta=Math.atan2(Math.sin(target-b.aim),Math.cos(target-b.aim));
    b.aim+=delta*(1-Math.exp(-14*dt));
  }
  function fire(b){b.recoil=1;b.flash=.1;}
  function draw(ctx,b){
    const p=pose(b),flip=Math.cos(p.angle)<0?-1:1;
    const point=(x,y)=>({x:p.x+Math.cos(p.angle)*x-Math.sin(p.angle)*y*flip,y:p.y+Math.sin(p.angle)*x+Math.cos(p.angle)*y*flip});
    const grips=[point(1,8),point(23,6)];
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    // Compact armored links and wrist joints make both hands visibly grip the launcher.
    const joint=(x,y,r)=>{
      ctx.fillStyle='#182635';ctx.strokeStyle='#738797';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#c49750';ctx.beginPath();ctx.arc(x,y,r*.35,0,Math.PI*2);ctx.fill();
    };
    const armor=(a,z,width)=>{
      const angle=Math.atan2(z.y-a.y,z.x-a.x),length=Math.hypot(z.x-a.x,z.y-a.y);
      ctx.save();ctx.translate(a.x,a.y);ctx.rotate(angle);
      ctx.fillStyle='#354b60';ctx.strokeStyle='#142131';ctx.lineWidth=1.7;
      ctx.beginPath();ctx.moveTo(0,-width*.38);ctx.lineTo(length*.65,-width*.5);
      ctx.lineTo(length,width*-.24);ctx.lineTo(length,width*.24);
      ctx.lineTo(length*.65,width*.5);ctx.lineTo(0,width*.38);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#8fa8b7';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2,-width*.22);ctx.lineTo(length*.65,-width*.3);ctx.stroke();
      ctx.strokeStyle='#bc9559';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(length*.68,-width*.25);ctx.lineTo(length*.68,width*.25);ctx.stroke();
      ctx.restore();
    };
    grips.forEach((g,i)=>{
      const shoulder={x:p.x+(i?17:-17),y:p.y-8};
      const elbow={x:shoulder.x*.45+g.x*.55,y:Math.max(shoulder.y+9,g.y+4)};
      armor(shoulder,elbow,8);joint(shoulder.x,shoulder.y,4.3);
      armor(elbow,g,7);joint(elbow.x,elbow.y,3.3);
    });
    ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.scale(1,flip);
    if(art.complete&&art.naturalWidth){ctx.drawImage(art,-12,-11,54,27);}
    else{ctx.fillStyle='#b98332';ctx.fillRect(-10,-6,48,13);ctx.fillStyle='#243344';ctx.fillRect(30,-7,10,15);}
    for(const [x,y] of [[1,8],[23,6]]){
      ctx.fillStyle='#445d70';ctx.strokeStyle='#182635';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect(x-4,y-3,8,7,2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#9aafb9';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x-2,y-1);ctx.lineTo(x+2,y-1);ctx.moveTo(x-1,y+1);ctx.lineTo(x+2,y+1);ctx.stroke();
    }
    // A small chamber light telegraphs readiness without obscuring the nugget.
    if(!b.entering&&b.attack){ctx.fillStyle='#fff0a6';ctx.globalAlpha=.45+.35*Math.sin(b.phase*40);ctx.fillRect(12,-3,5,3);ctx.globalAlpha=1;}
    if(b.flash>0){
      ctx.globalCompositeOperation='screen';ctx.globalAlpha=b.flash/.1;
      ctx.fillStyle='#ffd176';ctx.beginPath();ctx.moveTo(39,-4);ctx.lineTo(49,-7);ctx.lineTo(47,-2);ctx.lineTo(58,0);ctx.lineTo(47,3);ctx.lineTo(49,7);ctx.lineTo(39,4);ctx.closePath();ctx.fill();
      ctx.fillStyle='#fff6d5';ctx.fillRect(39,-2,9,4);
    }
    ctx.restore();
  }
  return {pose,muzzle,step,fire,draw};
})();
