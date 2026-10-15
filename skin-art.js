// Illustrated skins use continuous body deformation and themed cosmetic effects.
window.SkinArt=(()=>{
  const images=new Map(),tiles=new Map();
  const defaultPreview=new Image(),defaultTiles=new Map();
  defaultPreview.src='assets/default-preview-hd.png';
  defaultPreview.onload=()=>{defaultTiles.clear();dispatchEvent(new Event('skin-art-ready'));};
  function defaultSample(filter='none'){
    if(!defaultPreview.naturalWidth)return null;
    if(defaultTiles.has(filter))return defaultTiles.get(filter);
    const tile=document.createElement('canvas');tile.width=844;tile.height=924;
    const c=tile.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.filter=filter;
    const scale=Math.min(tile.width/defaultPreview.naturalWidth,tile.height/(defaultPreview.naturalHeight||924));
    const w=defaultPreview.naturalWidth*scale,h=(defaultPreview.naturalHeight||924)*scale;
    c.drawImage(defaultPreview,(tile.width-w)/2,(tile.height-h)/2,w,h);
    defaultTiles.set(filter,tile);return tile;
  }
  for(const skin of SkinCatalog.items.filter(s=>s.asset)){
    const img=new Image();img.src=skin.asset;images.set(skin.id,img);
    img.onload=()=>{tiles.delete(skin.id);dispatchEvent(new Event('skin-art-ready'));};
  }
  function ready(index){const s=SkinCatalog.items[index];return !s?.asset||!!images.get(s.id)?.naturalWidth;}
  function sample(id){
    if(tiles.has(id))return tiles.get(id);
    const tile=document.createElement('canvas');tile.width=422;tile.height=462;
    const c=tile.getContext('2d'),img=images.get(id);
    if(!img?.naturalWidth)return tile;
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    // Keep the source proportions when fitting the illustrated skin to the atlas tile.
    const scale=Math.min(422/img.naturalWidth,462/(img.naturalHeight||462));
    const width=img.naturalWidth*scale,height=(img.naturalHeight||462)*scale;
    c.drawImage(img,(422-width)/2,(462-height)/2,width,height);tiles.set(id,tile);return tile;
  }
  const reduced={get matches(){return window.I18n?I18n.reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches;}};
  const profiles={scrapper:[2.8,1.1],polar:[1.5,.65],worker:[2.4,.75],astronaut:[1.25,1.1],samurai:[1.7,.55],abyssal:[1.4,.85],emerald:[1.8,.85],phantom:[2.1,1.15],nugget:[2.6,.8],gold:[1.6,.8]};
  // A continuous mesh moves the illustrated limbs without cutting them away
  // from the torso. Neighbouring triangles share the same animated vertices.
  function drawBody(c,id,p,source=null){
    const img=source||sample(id);if(!source&&!images.get(id)?.naturalWidth)return;
    if(reduced.matches){c.drawImage(img,-37,-40.51,74,81.02);return;}
    const [rate,amount]=profiles[id]||[2,1],t=p.time*rate;
    const sway=Math.sin(t),stride=Math.sin(p.phase),moving=p.travel;
    const nx=6,ny=10,vertices=[];
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const x=-37+i*74/nx,y=-40.51+j*81.02/ny;
      const head=Math.max(0,Math.min(1,(-y-1)/18));
      const arm=Math.max(0,Math.min(1,(Math.abs(x)-12)/14))*Math.exp(-(((y-6)/20)**2));
      const leg=Math.max(0,Math.min(1,(y-17)/18));
      const side=x<0?-1:1;
      const nod=Math.sin(t*.8+.8)*amount;
      // Rigid armor: keep themed motion, with only a quarter of the local bending.
      vertices.push({x:x+.25*(sway*head*1.3*amount+side*arm*Math.sin(t+side*.6)*(1+moving)*amount+leg*stride*moving*.8),
        y:y+.25*(nod*head*.75+arm*Math.sin(t+side)*amount*1.6+leg*side*(Math.sin(t)*.8+stride*moving*2.1)*amount-(1-head)*Math.sin(t*1.3)*.35)});
    }
    function triangle(a,b,d,sa,sb,sd){
      c.save();c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineTo(d.x,d.y);c.closePath();c.clip();
      const det=(sb.x-sa.x)*(sd.y-sa.y)-(sd.x-sa.x)*(sb.y-sa.y);
      const A=((b.x-a.x)*(sd.y-sa.y)-(d.x-a.x)*(sb.y-sa.y))/det;
      const B=((b.y-a.y)*(sd.y-sa.y)-(d.y-a.y)*(sb.y-sa.y))/det;
      const C=((d.x-a.x)*(sb.x-sa.x)-(b.x-a.x)*(sd.x-sa.x))/det;
      const D=((d.y-a.y)*(sb.x-sa.x)-(b.y-a.y)*(sd.x-sa.x))/det;
      c.transform(A,B,C,D,a.x-A*sa.x-C*sa.y,a.y-B*sa.x-D*sa.y);c.drawImage(img,0,0);c.restore();
    }
    c.imageSmoothingEnabled=true;
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const k=j*(nx+1)+i,a=vertices[k],b=vertices[k+1],d=vertices[k+nx+1],e=vertices[k+nx+2];
      const sa={x:i*img.width/nx,y:j*img.height/ny},sb={x:(i+1)*img.width/nx,y:sa.y},sd={x:sa.x,y:(j+1)*img.height/ny},se={x:sb.x,y:sd.y};
      triangle(a,b,d,sa,sb,sd);triangle(b,e,d,sb,se,sd);
    }
  }
  function accents(ctx,index,m,x,y){
    const skin=SkinCatalog.items[index];if(!skin)return;
    const t=reduced.matches?0:m.time,boost=m.boost||0,id=skin.id;
    ctx.save();ctx.translate(x,y-m.lift+Math.sin(t*2.1)*2.4);ctx.rotate(m.bank||0);
    ctx.strokeStyle=skin.color;ctx.fillStyle=skin.color;ctx.lineWidth=.7;
    const dot=(x,y,r,a=.6)=>{ctx.globalAlpha=a;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
    const star=(x,y,r,a=.65)=>{ctx.globalAlpha=a;ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.stroke();};
    const cycle=(speed,i)=>(t*speed+i*.31)%1;
    ctx.shadowColor=skin.color;ctx.shadowBlur=3+boost*4;
    if(id==='polar'||id==='lime'||id==='abyssal'||id==='nugget'||id==='scrapper')for(let i=0;i<5;i++){
      const q=cycle(id==='nugget'?.65:.3,i),px=Math.sin(i*8.2+t*.6)*(25+q*7),py=24-q*64;
      if(id==='abyssal'){ctx.globalAlpha=Math.sin(q*Math.PI)*.45;ctx.beginPath();ctx.arc(px,py,1+q*2,0,Math.PI*2);ctx.stroke();}
      else if(id==='polar')star(px,py,1.5,Math.sin(q*Math.PI)*.65);
      else if(id==='scrapper'){if(q<.28){ctx.globalAlpha=(1-q/.28)*.65;ctx.fillRect(-24-q*13,4+q*28,1.1,2.2);}}
      else if(id==='nugget'){ctx.globalAlpha=Math.sin(q*Math.PI)*.65;ctx.save();ctx.translate(px,py);ctx.rotate(t+i);ctx.fillRect(-.7,-.7,1.4,1.4);ctx.restore();}
      else dot(px,py,1,Math.sin(q*Math.PI)*.55);
    }
    if(id==='worker'){
      const flash=reduced.matches?.35:Math.pow(Math.max(0,Math.sin(t*3)),6);
      dot(0,-29,2.2,.25+flash*.65);ctx.globalAlpha=flash*.35;ctx.beginPath();ctx.ellipse(0,-29,9,2,0,0,Math.PI*2);ctx.stroke();
    }
    if(id==='astronaut'||id==='cyan'||id==='pink'||id==='amber'){
      ctx.globalAlpha=.2+boost*.2;
      for(let i=0;i<2;i++){const a=t*(id==='pink'?-1:1)+i*Math.PI;dot(Math.cos(a)*29,Math.sin(a)*10+7,1.2,.55);}
      if(id==='amber')for(let i=0;i<3;i++){const q=cycle(.6,i);dot(Math.sin(i*4)*15,30+q*12,1.3*(1-q),.5*(1-q));}
    }
    if(id==='samurai'){
      const q=cycle(.45,0);ctx.globalAlpha=Math.sin(q*Math.PI)*(.25+boost*.4);
      ctx.beginPath();ctx.moveTo(-29+q*9,17-q*33);ctx.quadraticCurveTo(-36,0,-27,-20-q*6);ctx.stroke();
      ctx.beginPath();ctx.moveTo(27,7);ctx.quadraticCurveTo(32,16,25+Math.sin(t*2)*3,24);ctx.stroke();
    }
    if(id==='emerald')for(let i=0;i<3;i++){
      const a=t*.7+i*Math.PI*2/3,px=Math.cos(a)*32,py=Math.sin(a)*12+8;
      ctx.globalAlpha=.5+Math.sin(t*3+i)**2*.25;ctx.beginPath();ctx.moveTo(px,py-3);ctx.lineTo(px+2,py);ctx.lineTo(px,py+3);ctx.lineTo(px-2,py);ctx.closePath();ctx.fill();
    }
    if(id==='gold')for(let i=0;i<5;i++){
      const a=t*.45+i*2.1;star(Math.cos(a)*29,Math.sin(a)*31,1.5+Math.sin(t*2+i)**2,.25+.5*Math.sin(t*3+i)**2);
    }
    if(id==='phantom')for(let i=0;i<4;i++){
      const q=cycle(.7,i);ctx.globalAlpha=(.15+boost*.3)*Math.sin(q*Math.PI);ctx.fillRect((i%2?1:-1)*(24+Math.sin(t*8+i)*3),-25+q*53,4+(i%2)*3,.8);
    }
    ctx.restore();
  }
  return {sample,defaultSample,ready,drawBody,accents};
})();
