(function(root){
  'use strict';
  const F=root.Fitness,C=root.ActivityCatalog;
  const profile=code=>C?.entries[String(code).padStart(5,'0')]||null;
  const nearest=(x,pairs)=>pairs.reduce((best,p)=>Math.abs(x-p[0])<Math.abs(x-best[0])?p:best)[1];
  const SPORTS={badminton:['羽毛球（休闲）','15030'],basketball:['篮球（非比赛）','15050'],basketballGame:['篮球比赛','15040'],soccer:['足球（休闲）','15610'],soccerGame:['足球比赛','15605'],pingpong:['乒乓球','15660'],tennis:['网球双打','15680']};
  const REFERENCES={'02048':'椭圆机（中等）','02101':'拉伸（轻度）','02056':'自重训练（一般）'};
  function pick(r){
    const speed=r.speed,mph=speed/1.609344,vigorous=r.energyEffort==='vigorous';
    if(r.type==='跑步')return speed>=4&&speed<=19?profile(nearest(mph,[[3.15,12026],[4.1,12028],[4.55,12029],[5.1,12030],[5.65,12045],[6.15,12050],[6.7,12060],[7,12070],[7.5,12080],[8,12090],[8.6,12100],[9,12110],[10,12120],[11,12130]])):null;
    if(r.type==='散步'||r.type==='爬坡'&&r.slope===0)return speed>0&&speed<=9?profile(mph<2?17151:mph<2.5?17152:mph<2.8?17170:mph<3.5?17190:mph<4?17200:mph<4.5?17220:17230):null;
    if(r.type==='骑行')return speed>0&&speed<=65?profile(mph<10?'01010':mph<12?'01020':mph<14?'01030':mph<16?'01040':mph<20?'01050':'01060'):null;
    if(r.type==='爬坡'){
      if(r.slope<=0||r.slope>40||speed<=0||speed>8)return null;
      if(r.slope>=30&&mph<1.2)return profile(17038);
      if(r.slope>=30&&mph<1.8)return profile(17039);
      if(r.slope>20)return profile(17040);
      if(r.slope>=5&&speed<4)return profile(17032);
      return profile(r.slope<=5?17034:r.slope<=10?17035:17036);
    }
    if(r.type==='游泳')return profile(r.stroke==='自由泳'?(vigorous?18230:18240):r.stroke==='蛙泳'?(vigorous?18260:18265):r.stroke==='仰泳'?(vigorous?18250:18255):r.stroke==='蝶泳'?18270:18310);
    if(r.type==='登山')return profile(vigorous?17080:17082);
    if(r.type==='爬楼')return profile(17131);
    if(r.type==='跳绳'){const cadence=r.count/r.minutes;return cadence>0&&cadence<=160?profile(cadence<100?15552:cadence<120?15551:15550):null;}
    if(r.type==='健身操')return profile(vigorous?'02006':'02005');
    if(r.type==='划船')return r.rowingMode?profile(r.rowingMode==='water'?18070:vigorous?'02070':'02071'):null;
    if(r.type==='球类运动')return SPORTS[r.sport]?profile(SPORTS[r.sport][1]):null;
    return REFERENCES[r.energyReference]?profile(r.energyReference):null;
  }
  function calculate(entry,weight,minutes,profileId){
    if(!entry||!Number.isFinite(weight)||weight<20||weight>400||!Number.isFinite(minutes)||minutes<.1||minutes>1440)return null;
    const factor=3.5*weight/200*minutes;
    return{version:1,method:'MET-2024',code:entry.code,label:entry.label,met:entry.met,weight,minutes,profileId:profileId||null,netKcal:Math.round((entry.met-1)*factor*10)/10,grossKcal:Math.round(entry.met*factor*10)/10};
  }
  function estimate(db,r,date=r.date){const p=F.profileAt(db,date);return p&&p.age>=19&&p.age<=59?calculate(pick(r),p.weight,r.minutes,p.id):null;}
  function strength(db,date,minutes,effort='moderate'){const p=F.profileAt(db,date);return p&&p.age>=19&&p.age<=59?calculate(profile(effort==='vigorous'?'02050':'02054'),p.weight,minutes,p.id):null;}
  const record=(db,r)=>r.energy||estimate(db,r,r.date);
  function day(db,date){
    let active=0,gross=0,estimated=0,missing=0;
    for(const r of db.cardio.filter(r=>r.date===date)){const e=record(db,r);if(e){active+=e.netKcal;gross+=e.grossKcal;estimated++;}else missing++;}
    const sessionIds=new Set(db.strength.filter(r=>r.date===date).map(r=>r.sessionId||r.id));
    for(const id of sessionIds){const s=(db.sessions||[]).find(s=>s.id===id&&s.date===date),e=s?.energy||(s?.minutes?strength(db,date,s.minutes,s.effort):null);if(e){active+=e.netKcal;gross+=e.grossKcal;estimated++;}else missing++;}
    return{active:Math.round(active*10)/10,gross:Math.round(gross*10)/10,estimated,missing};
  }
  function reason(db,date){const p=F.profileAt(db,date);return !p?'需先补充该日或之前的身体资料。':p.age<19||p.age>59?'当前成人 MET 模型适用 19–59 岁，暂不估算该年龄。':'缺少时长、具体项目，或运动条件超出当前参照范围。';}
  root.ExerciseEnergy={pick,estimate,strength,calculate,record,day,reason,profile,SPORTS,REFERENCES,documentation:'https://pacompendium.com/adult-compendium/'};
})(globalThis);
