(function(root){
 const modes=['easy','normal','hard'];
 function init(save){
  const old=save.bestByMode||{};
  save.bestByMode=Object.fromEntries(modes.map(mode=>[mode,Number.isFinite(old[mode])&&old[mode]>=0?Math.floor(old[mode]):0]));
  return save.bestByMode;
 }
 function get(save,mode){return init(save)[mode]||0;}
 function record(save,mode,points){
  if(!modes.includes(mode)||!Number.isFinite(points)||points<0)return;
  init(save);save.bestByMode[mode]=Math.max(save.bestByMode[mode],Math.floor(points));
 }
 const api={init,get,record};if(typeof module!=='undefined')module.exports=api;else root.ModeRecords=api;
})(globalThis);
