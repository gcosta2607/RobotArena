// Physical key codes are shared by solo and multiplayer, independent of text input.
(function(root){
 const defaults={up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],dash:['ShiftLeft','Space']};
 let bindings=JSON.parse(JSON.stringify(defaults));
 const allowed=code=>/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Space|Numpad[0-9]|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter)|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|CapsLock)$/.test(code||'');
 function validate(value){const used=new Set();return value&&Object.keys(defaults).every(action=>Array.isArray(value[action])&&value[action].length===2&&value[action].some(Boolean)&&value[action].every(code=>{if(code===null)return true;if(!allowed(code)||used.has(code))return false;used.add(code);return true;}));}
 try{const value=JSON.parse(localStorage.getItem('robot-arena-bindings')||'null');if(validate(value))bindings=value;}catch{}
 const has=(held,code)=>code&&(held instanceof Set?held.has(code):!!held[code]);
 function persist(){try{localStorage.setItem('robot-arena-bindings',JSON.stringify(bindings));}catch{}}
 function matches(action,event){return bindings[action]?.includes(event.code);}
 function movementKey(event){return ['up','down','left','right'].some(action=>matches(action,event))?event.code:undefined;}
 function vector(held){const active=action=>bindings[action].some(code=>has(held,code));return {x:Number(active('right'))-Number(active('left')),y:Number(active('down'))-Number(active('up'))};}
 function assign(action,slot,code){if(!Object.hasOwn(defaults,action)||![0,1].includes(slot)||code!==null&&!allowed(code))return 'Tecla não disponível.';
  if(code&&Object.entries(bindings).some(([other,keys])=>keys.some((key,index)=>key===code&&(other!==action||index!==slot))))return 'Essa tecla já está em uso.';
  if(code===null&&!bindings[action][1-slot])return 'Mantenha pelo menos uma tecla por ação.';
  bindings[action][slot]=code;persist();return null;
 }
 function label(code){if(!code)return '—';if(/^Key/.test(code))return code.slice(3);if(/^Digit/.test(code))return code.slice(5);return {ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'Shift L',ShiftRight:'Shift R',Space:'Espaço',Backquote:'`',Minus:'−',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'}[code]||code.replace('Numpad','Num ');}
 const api={defaults,get bindings(){return bindings;},matches,movementKey,vector,assign,label,allowed,reset(){bindings=JSON.parse(JSON.stringify(defaults));persist();}};
 if(typeof module!=='undefined')module.exports=api;else root.ControlBindings=api;
})(globalThis);
