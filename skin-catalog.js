(function(root){
  const items=[
    {id:'cyan',name:'Unidade Ciano',price:0,color:'#31e7f7',filter:'none',description:'Núcleo vetorial · padrão'},
    {id:'pink',name:'Unidade Magenta',price:0,color:'#ff83c9',filter:'hue-rotate(110deg) saturate(1.35)',description:'Núcleo quântico'},
    {id:'lime',name:'Unidade Lima',price:0,color:'#8cec5b',filter:'hue-rotate(-105deg) saturate(1.45)',description:'Núcleo biônico'},
    {id:'amber',name:'Unidade Âmbar',price:0,color:'#ffc15a',filter:'hue-rotate(-135deg) saturate(1.55)',description:'Núcleo solar'},
    {id:'scrapper',name:'Sucateiro',price:150,color:'#eeb175',description:'Peças usadas. Uma nova história.'},
    {id:'polar',name:'Polar',price:150,color:'#a4eaff',description:'Preparado para o frio do espaço.'},
    {id:'worker',name:'Operário',price:150,color:'#ffd25c',description:'Construído para aguentar o serviço.'},
    {id:'astronaut',name:'Astronauta',price:450,color:'#c8edff',description:'Um pequeno passo para a arena.'},
    {id:'samurai',name:'Samurai',price:450,color:'#ff7178',description:'Precisão sob a armadura.'},
    {id:'abyssal',name:'Abissal',price:450,color:'#76e0ba',description:'Das profundezas para as estrelas.'},
    {id:'emerald',name:'Núcleo Esmeralda',price:1000,color:'#61ff9a',description:'Energia viva entre as placas.',effect:'emerald'},
    {id:'phantom',name:'Protótipo Fantasma',price:1000,color:'#bc91ff',description:'Um vulto violeta na arena.',effect:'phantom'},
    {id:'nugget',name:'Nugget Infiltrado',price:1000,color:'#ffb659',description:'Ninguém suspeita de nada.',effect:'nugget'},
    {id:'gold',name:'Dourada',price:1000,color:'#ffe08a',description:'O brilho de uma campeã.',effect:'gold'}
  ].map((s,index)=>({...s,index,filter:s.filter||'skin:'+s.id,asset:s.price?'assets/skin-'+s.id+'-v3.png':null,tier:s.price===1000?'Especial':s.price===450?'Rara':s.price===150?'Clássica':'Original'}));
  function owned(save){const ids=new Set(Array.isArray(save.ownedSkins)?save.ownedSkins:[]);return items.filter(s=>s.price===0||ids.has(s.id)).map(s=>s.index);}
  function purchase(save,id){
    const skin=items.find(s=>s.id===id);if(!skin)throw Error('Unidade inválida.');
    if(owned(save).includes(skin.index))return false;
    if(!Number.isSafeInteger(save.coins)||save.coins<skin.price)throw Error('Cristais insuficientes.');
    save.coins-=skin.price;save.ownedSkins=[...new Set([...(save.ownedSkins||[]),skin.id])];return true;
  }
  const api={items,owned,purchase};if(typeof module!=='undefined')module.exports=api;else root.SkinCatalog=api;
})(globalThis);
