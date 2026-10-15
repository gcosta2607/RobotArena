window.SkinShop=(()=>{
  const dialog=document.querySelector('#skin-shop'),grid=document.querySelector('#shop-grid'),preview=document.querySelector('#shop-preview'),pc=preview.getContext('2d');
  let selected=4,filter='all',raf=0,last=0,m=RobotMotion.create();
  // The inventory stretches the 320px logical preview to 380px; keep enough
  // backing pixels for that enlarged view on high-density displays.
  preview.width=960;preview.height=900;
  pc.setTransform(3,0,0,3,0,0);pc.imageSmoothingEnabled=true;pc.imageSmoothingQuality='high';
  const inInventory=()=>dialog.dataset.inventory==='true';
  const owned=()=>SkinCatalog.owned(save);
  function persist(){localStorage.setItem('robot-arena-save',JSON.stringify(save));sync();}
  function reloadWallet(){const latest=JSON.parse(localStorage.getItem('robot-arena-save')||'null');if(latest)Object.assign(save,latest);}
  function detail(){
    document.body.classList.toggle('inventory-open',inInventory());
    const s=SkinCatalog.items[selected],has=owned().includes(selected),button=document.querySelector('#shop-buy');
    dialog.style.setProperty('--skin-accent',s.color);document.querySelector('#shop-name').textContent=s.name;document.querySelector('#shop-description').textContent=s.description;document.querySelector('#shop-tier').textContent=s.tier;
    dialog.classList.toggle('inventory-locked',inInventory()&&!has);
    button.textContent=has?(avatar===selected?'EQUIPADA':'EQUIPAR'):inInventory()?'VER NA LOJA':'COMPRAR · '+s.price.toLocaleString(I18n.language)+' CRISTAIS';
    button.disabled=has?avatar===selected:!inInventory()&&save.coins<s.price;
    document.querySelector('#shop-message').textContent=inInventory()?'':!has&&save.coins<s.price?'Faltam '+(s.price-save.coins).toLocaleString(I18n.language)+' cristais.':'';
    sync();
  }
  function drawThumb(canvas,s){const c=canvas.getContext('2d');c.clearRect(0,0,160,150);if(!s.asset&&!art.player_robot.naturalWidth)return;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(cachedSprite(0,0,s.filter),22,7,116,127);}
  function render(){
    grid.replaceChildren();
    if(inInventory()){detail();return;}
    const unlocked=owned();
    const visible=SkinCatalog.items.filter(s=>filter==='owned'?unlocked.includes(s.index):filter==='all'?s.price>0:s.price===Number(filter));
    for(const s of visible){
      const button=document.createElement('button');button.type='button';button.className='shop-card';button.dataset.skin=s.id;button.setAttribute('aria-pressed',String(s.index===selected));button.style.setProperty('--card-accent',s.color);
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=150;canvas.setAttribute('aria-hidden','true');button.append(canvas);drawThumb(canvas,s);
      const name=document.createElement('b');name.textContent=s.name;button.append(name);
      const status=document.createElement('span');status.textContent=avatar===s.index?'EQUIPADA':unlocked.includes(s.index)?'ADQUIRIDA':s.price.toLocaleString(I18n.language)+' cristais';button.append(status);
      button.onclick=()=>{selected=s.index;m.selectionPulse=1;GameAudio.play('select');render();};grid.append(button);
    }
    detail();
  }
  function frame(now){if(!dialog.open)return;const dt=Math.min(.033,(now-(last||now))/1000);last=now;pc.clearRect(0,0,320,300);RobotMotion.step(m,dt,0,0,0,0,-1);pc.save();pc.translate(160,153);const zoom=inInventory()?3.4:2.75;pc.scale(zoom,zoom);const s=SkinCatalog.items[selected];RobotMotion.render(pc,cachedSprite,m,0,0,s.color,s.filter,SkinArt.ready(selected)&&!!art.player_robot.naturalWidth,true);SkinArt.accents(pc,selected,m,0,0);pc.restore();raf=requestAnimationFrame(frame);}
  let opener=document.querySelector('#open-shop');
  function open(inventory=false){if(running||window.Multiplayer?.active)return;reloadWallet();dialog.dataset.inventory=String(inventory);filter=inventory?'owned':'all';selected=inventory?avatar:(SkinCatalog.items[avatar].price?avatar:4);opener=document.querySelector(inventory?'#open-inventory':'#open-shop');document.querySelector('#shop-title').textContent=inventory?'Seu inventário.':'Sua próxima unidade.';document.querySelectorAll('[data-shop-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shopFilter===filter)));render();last=0;m=RobotMotion.create();dialog.showModal();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);}
  document.querySelector('#open-shop').onclick=()=>open(false);
  document.querySelector('#open-inventory').onclick=()=>open(true);
  function browse(direction){selected=(selected+direction+SkinCatalog.items.length)%SkinCatalog.items.length;m.selectionPulse=1;GameAudio.play('select');render();}
  document.querySelector('#inventory-previous').onclick=()=>browse(-1);
  document.querySelector('#inventory-next').onclick=()=>browse(1);
  dialog.addEventListener('keydown',e=>{if(!inInventory()||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();if(!e.repeat)browse(e.key==='ArrowLeft'?-1:1);});
  document.querySelector('#close-shop').onclick=()=>dialog.close();
  document.querySelector('#inventory-back').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{document.body.classList.remove('inventory-open');cancelAnimationFrame(raf);opener.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  document.querySelectorAll('[data-shop-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.shopFilter;document.querySelectorAll('[data-shop-filter]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));render();});
  document.querySelector('#shop-buy').onclick=()=>{
    reloadWallet();const s=SkinCatalog.items[selected];
    if(inInventory()&&!owned().includes(selected)){dialog.dataset.inventory='false';filter='all';document.querySelector('#shop-title').textContent='Sua próxima unidade.';document.querySelectorAll('[data-shop-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shopFilter==='all')));render();return;}
    try{const bought=SkinCatalog.purchase(save,s.id);save.equippedSkin=s.id;persist();choose(selected);GameAudio.play(bought?'ready':'select');render();if(bought)document.querySelector('#shop-message').textContent='Adquirida e equipada!';}
    catch(error){render();document.querySelector('#shop-message').textContent=error.message;}
  };
  addEventListener('skin-art-ready',()=>{if(dialog.open)render();});
  addEventListener('storage',e=>{if(e.key==='robot-arena-save'){reloadWallet();sync();if(dialog.open)render();}});
  // Restore the saved unit name as well as the illustration, without playing audio.
  document.querySelector('#unit').textContent=skins[avatar][1];document.querySelector('#core').textContent=skins[avatar][2];
  return {open};
})();

