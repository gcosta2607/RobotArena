// Small, layered synth voices: no downloads, and audio starts only after a gesture.
const GameAudio = (() => {
  let context, master, engine, engineGain, noise, muted=false, volume=1;
  const gates=new Map();
  try { muted=localStorage.getItem('robot-arena-muted')==='true';const saved=Number(localStorage.getItem('robot-arena-sfx-volume')??1);if(Number.isFinite(saved))volume=Math.max(0,Math.min(1,saved)); } catch {}
  function unlock() {
    try {
      if(!context){
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)return;
        context=new Audio();master=context.createGain();master.gain.value=muted?0:.55*volume;master.connect(context.destination);
        noise=context.createBuffer(1,context.sampleRate,context.sampleRate);
        const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        engine=context.createOscillator();engine.type='sine';engine.frequency.value=72;
        engineGain=context.createGain();engineGain.gain.value=0;engine.connect(engineGain);engineGain.connect(master);engine.start();
      }
      if(context.state==='suspended')context.resume().catch(()=>{});
    } catch { /* Gameplay remains available without Web Audio. */ }
  }
  function voice(from,to,duration,volume,type='sine',pan=0,delay=0) {
    if(!context||context.state!=='running'||muted)return;
    const t=context.currentTime+delay,g=context.createGain();
    let source,filter;
    if(type==='noise'){
      source=context.createBufferSource();source.buffer=noise;
      filter=context.createBiquadFilter();filter.type='bandpass';filter.Q.value=.7;
      filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(to,t+duration);source.connect(filter);filter.connect(g);
    }else{
      source=context.createOscillator();source.type=type;source.frequency.setValueAtTime(from,t);
      source.frequency.exponentialRampToValueAtTime(to,t+duration);source.connect(g);
    }
    const p=context.createStereoPanner?context.createStereoPanner():context.createGain();
    if(p.pan)p.pan.value=Math.max(-1,Math.min(1,pan));g.connect(p);p.connect(master);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.start(t);source.stop(t+duration+.025);
    source.onended=()=>{source.disconnect();filter?.disconnect();g.disconnect();p.disconnect();};
  }
  function play(name,pan=0) {
    if(!context||muted)return;
    if(context.state==='suspended'){context.resume().then(()=>{if(context.state==='running')play(name,pan);}).catch(()=>{});return;}
    const now=context.currentTime,interval={near:.14,phase:.12,move:.16,turn:.18,blocked:.25}[name]||.04;
    if(now-(gates.get(name)??-10)<interval)return;gates.set(name,now);
    switch(name){
      case 'crystal':{const pitch=1+Math.random()*.12;voice(1100*pitch,1600*pitch,.16,.09,'sine',pan);voice(1900*pitch,2400*pitch,.25,.05,'sine',pan,.045);break;}
      case 'shot-common':voice(300,130,.10,.035,'triangle',pan);break;
      case 'shot-burst':voice(520,210,.065,.035,'triangle',pan);break;
      case 'shot-homing':voice(330,850,.22,.055,'sine',pan);break;
      case 'unlock':voice(750,260,.14,.045,'sine',pan);break;
      case 'dash':voice(230,48,.22,.30,'sine',pan);voice(3200,450,.19,.17,'noise',pan);voice(900,240,.08,.055,'triangle',pan);break;
      case 'settle':voice(135,65,.12,.10,'sine',pan);break;
      case 'move':voice(95,180,.13,.08,'sine',pan);voice(650,1200,.10,.035,'noise',pan);break;
      case 'turn':voice(1500,650,.09,.045,'noise',pan);break;
      case 'stop':voice(160,65,.12,.065,'sine',pan);break;
      case 'near':voice(2600,650,.13,.10,'noise',pan);voice(1200,780,.10,.045,'sine',pan);break;
      case 'phase':voice(420,1600,.16,.10,'triangle',pan);voice(1800,400,.2,.09,'noise',pan);break;
      case 'ready':voice(740,740,.14,.09);voice(1110,1110,.2,.065,'sine',0,.065);break;
      case 'blocked':voice(150,110,.07,.04,'triangle');break;
      case 'select':voice(460,720,.10,.075,'sine');break;
      case 'start':voice(330,660,.19,.10,'triangle');voice(990,990,.23,.07,'sine',0,.09);break;
      case 'death':voice(100,25,.55,.40);voice(2100,90,.55,.25,'noise');voice(480,45,.4,.10,'triangle');break;
    }
  }
  function movement(speed,dashing){
    if(!context||!engineGain)return;
    engineGain.gain.setTargetAtTime(muted?0:Math.min(1,speed/250)*(dashing?.012:.028),context.currentTime,.045);
    engine.frequency.setTargetAtTime(65+Math.min(speed,400)*.19,context.currentTime,.06);
  }
  function hush(){if(engineGain)engineGain.gain.setTargetAtTime(0,context.currentTime,.015);}
  function toggle(){unlock();muted=!muted;if(master)master.gain.setTargetAtTime(muted?0:.55*volume,context.currentTime,.02);try{localStorage.setItem('robot-arena-muted',String(muted));}catch{}return muted;}
  function setVolume(value){if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));unlock();if(master)master.gain.setTargetAtTime(muted?0:.55*volume,context.currentTime,.025);try{localStorage.setItem('robot-arena-sfx-volume',String(volume));}catch{}}
  return {unlock,play,movement,hush,toggle,setVolume,get volume(){return volume;},get muted(){return muted;}};
})();
