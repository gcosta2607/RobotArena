// All timing uses active survival seconds, independent of score multipliers.
const CombatBalance = (() => {
  const modes={
    easy:{label:'FÁCIL',arrivals:[2,25,55],ramp:100,speed:[180,220],delay:[3.0,2.35],cap:8,warning:.6,burstAt:30,homingAt:Infinity,burst:.15,homing:0,homingGap:8},
    normal:{label:'NORMAL',arrivals:[1.5,10,25,45],ramp:80,speed:[210,260],delay:[2.6,1.8],cap:12,warning:.45,burstAt:15,homingAt:40,burst:.25,homing:.10,homingGap:8},
    hard:{label:'DIFÍCIL',arrivals:[1,5,12,22,35,50],ramp:65,speed:[235,290],delay:[2.2,1.4],cap:16,warning:.35,burstAt:0,homingAt:20,burst:.35,homing:.15,homingGap:5}
  };
  function at(mode,seconds){
    const c=modes[mode]||modes.normal,t=Math.max(0,Math.min(1,seconds/c.ramp));
    return {...c,bots:c.arrivals.filter(time=>seconds>=time).length,spawn:1,
      shotSpeed:c.speed[0]+(c.speed[1]-c.speed[0])*t,
      fireDelay:c.delay[0]+(c.delay[1]-c.delay[0])*t};
  }
  function pick(c,seconds,homingAllowed,random=Math.random()){
    const h=seconds>=c.homingAt&&homingAllowed?c.homing:0;
    if(random<h)return 'homing';
    if(random<h+(seconds>=c.burstAt?c.burst:0))return 'burst';
    return 'common';
  }
  // Bias expiration toward the middle of the actual flight path, across arena sizes.
  function shotLife(x,y,angle,speed,width,height,random=Math.random){
    if(random()>=.7)return 5;
    const dx=Math.cos(angle),dy=Math.sin(angle);
    let enter=0,exit=Infinity;
    for(const [origin,direction,low,high] of [[x,dx,width*.24,width*.76],[y,dy,110+(height-155)*.24,110+(height-155)*.76]]){
      if(Math.abs(direction)<1e-8){if(origin<low||origin>high)return 5;continue;}
      const a=(low-origin)/direction,b=(high-origin)/direction;
      enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    }
    if(exit<=enter||exit<=0)return 5;
    return Math.max(.35,(enter+(exit-enter)*(.2+random()*.6))/speed);
  }
  return {modes,at,pick,shotLife};
})();
