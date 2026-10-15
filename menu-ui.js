window.MenuUI=(()=>{
 const home=document.querySelector('#home'),settings=document.querySelector('#settings-dialog');
 function prepare(){if(document.body.classList.contains('is-loading'))return;document.body.classList.remove('at-home');home.inert=true;ui.start.inert=false;GameAudio.unlock();GameAudio.play('select');startPreview();document.querySelector('#name').focus();}
 function showHome(){if(running||window.Multiplayer?.active)return;document.body.classList.add('at-home','in-menu');home.inert=false;ui.start.inert=true;cancelAnimationFrame(previewRaf);document.querySelector('#home-play').focus();}
 document.querySelector('#home-play').onclick=prepare;
 document.querySelector('#home-back').onclick=showHome;
 let settingsInvoker=null,resumeAfterSettings=false;
 function openSettings(invoker){settingsInvoker=invoker;resumeAfterSettings=running&&!paused&&!window.Multiplayer?.active;if(resumeAfterSettings)setPaused(true);dispatchEvent(new Event('game-settings-open'));document.querySelector('#settings-sound').checked=!GameAudio.muted;document.querySelector('#settings-motion').checked=I18n.reducedMotion;refreshVolume();settings.showModal();}
 document.querySelector('#home-settings').onclick=e=>openSettings(e.currentTarget);
 document.querySelector('#settings-close').onclick=()=>settings.close();
 settings.addEventListener('close',()=>{if(resumeAfterSettings)setPaused(false);resumeAfterSettings=false;settingsInvoker?.focus();refreshGameTools();});
 const pauseButton=document.querySelector('#game-pause');
 function refreshGameTools(){const opened=document.body.classList.contains('pause-menu-open'),pressed=String(opened),label=I18n.t(opened?'CONTINUAR':'PAUSAR');if(pauseButton.getAttribute('aria-pressed')!==pressed)pauseButton.setAttribute('aria-pressed',pressed);if(pauseButton.getAttribute('aria-label')!==label)pauseButton.setAttribute('aria-label',label);const title=I18n.t(paused?'PARTIDA PAUSADA':'MENU');if(document.querySelector('#pause-title').textContent!==title)document.querySelector('#pause-title').textContent=title;}
 function togglePauseMenu(){const opening=!document.body.classList.contains('pause-menu-open');if(running&&!window.Multiplayer?.active)setPaused(opening);document.body.classList.toggle('pause-menu-open',opening);if(opening){dispatchEvent(new Event('game-settings-open'));document.querySelector('#game-resume').focus();}else pauseButton.focus();refreshGameTools();}
 pauseButton.onclick=togglePauseMenu;
 document.querySelector('#game-resume').onclick=togglePauseMenu;
 document.querySelector('#game-settings').onclick=e=>openSettings(e.currentTarget);
 document.querySelector('#game-menu').onclick=()=>{document.body.classList.remove('pause-menu-open');if(window.Multiplayer?.active)window.Multiplayer.leave();if(paused)setPaused(false);running=false;resetControls();document.querySelector('#back-menu').click();showHome();refreshGameTools();};
 document.querySelector('#settings-sound').onchange=e=>{if(e.target.checked===GameAudio.muted)document.querySelector('#sound-toggle').click();};
 document.querySelector('#settings-motion').onchange=e=>{try{localStorage.setItem('robot-arena-reduced-motion',String(e.target.checked));}catch{}document.body.classList.toggle('reduce-motion',e.target.checked);};
 const volumeSlider=document.querySelector('#settings-volume');
 function refreshVolume(){const value=Math.round(GameAudio.volume*100);volumeSlider.value=value;document.querySelector('#settings-volume-value').textContent=value+'%';volumeSlider.style.setProperty('--volume',value+'%');}
 volumeSlider.oninput=()=>{GameAudio.setVolume(Number(volumeSlider.value)/100);refreshVolume();};
 volumeSlider.onchange=()=>GameAudio.play('select');
 const bindingsDialog=document.querySelector('#bindings-dialog'),bindList=document.querySelector('#bindings-list'),bindMessage=document.querySelector('#bindings-message');
 const actionLabels={up:'Andar para frente',down:'Andar para trás',left:'Andar para a esquerda',right:'Andar para a direita',dash:'Dash'};
 let capture=null;
 function renderBindings(){
  bindList.replaceChildren();
  for(const [action,label] of Object.entries(actionLabels)){
   const row=document.createElement('div');row.className='binding-row';const name=document.createElement('span');name.textContent=label;row.append(name);
   ControlBindings.bindings[action].forEach((code,slot)=>{const button=document.createElement('button');button.type='button';button.className='binding-key';button.dataset.action=action;button.dataset.slot=slot;button.textContent=capture?.action===action&&capture.slot===slot?'…':ControlBindings.label(code);button.setAttribute('aria-label',I18n.t(label)+' · '+I18n.t(slot===0?'Primária':'Secundária')+' · '+I18n.t(ControlBindings.label(code)));button.classList.toggle('listening',capture?.action===action&&capture.slot===slot);button.onclick=()=>{capture={action,slot};bindMessage.textContent='Pressione uma tecla…';renderBindings();bindList.querySelector(`[data-action="${action}"][data-slot="${slot}"]`).focus();};row.append(button);});bindList.append(row);
  }
 }
 function stopCapture(message){const focus=capture;capture=null;bindMessage.textContent=message;renderBindings();if(focus)bindList.querySelector(`[data-action="${focus.action}"][data-slot="${focus.slot}"]`)?.focus();}
 document.querySelector('#settings-bindings').onclick=()=>{capture=null;bindMessage.textContent='Clique em uma tecla para mudar.';renderBindings();bindingsDialog.showModal();};
 document.querySelector('#bindings-close').onclick=()=>bindingsDialog.close();
 bindingsDialog.addEventListener('close',()=>{capture=null;document.querySelector('#settings-bindings').focus();});
 document.querySelector('#bindings-reset').onclick=()=>{ControlBindings.reset();capture=null;renderBindings();bindMessage.textContent='Controles restaurados.';};
 addEventListener('keydown',e=>{
  if(!bindingsDialog.open||!capture)return;
  e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
  if(e.key==='Escape'){stopCapture('Alteração cancelada.');return;}
  if(e.metaKey||e.ctrlKey||e.altKey){bindMessage.textContent='Tecla não disponível.';return;}
  const error=ControlBindings.assign(capture.action,capture.slot,['Backspace','Delete'].includes(e.code)?null:e.code);
  if(error){bindMessage.textContent=error;return;}
  stopCapture('Tecla alterada.');
 },true);
 addEventListener('language-change',()=>{if(bindingsDialog.open)renderBindings();});
 document.querySelectorAll('[data-language]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.language===I18n.language));b.onclick=()=>{I18n.set(b.dataset.language);GameAudio.play('select');};});
 document.body.classList.toggle('reduce-motion',I18n.reducedMotion);
 if(window.Multiplayer?.active){document.body.classList.remove('at-home');home.inert=true;}
 addEventListener('keydown',e=>{if(settings.open)return;if(e.key==='Escape'&&document.body.classList.contains('pause-menu-open')&&!running){e.preventDefault();togglePauseMenu();return;}if(document.body.classList.contains('at-home')&&e.key==='Enter'&&e.target===document.body){e.preventDefault();prepare();}if(e.key==='Escape'&&!running&&!Multiplayer.active&&!document.querySelector('#skin-shop').open){e.preventDefault();showHome();}});
 addEventListener('language-change',()=>{sync();});
 return {prepare,showHome,openSettings,refreshGameTools,togglePauseMenu};
})();
