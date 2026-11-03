(function (root) {
  'use strict';
  const VERSION = 2;
  const MUSCLES = ['胸', '肩', '背', '腿', '臂', '腹'];
  const CARDIO = ['跑步', '游泳', '骑行', '登山', '散步', '爬坡', '健身操', '爬楼', '跳绳', '划船', '球类运动'];
  const EQUIPMENT = ['自重', '哑铃', '杠铃', '杠铃片', '壶铃'];
  const MEALS = ['早饭', '中饭', '下午茶', '晚饭', '夜宵', '练后餐'];
  const STROKES = ['自由泳','蛙泳','蝶泳','仰泳'];
  const POOLS = [50,25,100,75];
  const DISTANCE_UNITS = ['km','m'], SPEED_UNITS = ['km/h','min/km','h/km'];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  function localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function shiftDay(date, delta) { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + delta); return localDate(d); }
  const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00')) && localDate(new Date(s + 'T12:00:00')) === s;
  const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const text = (s, max = 80) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  const validId = s => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(s);
  function blank() { return {version: VERSION, profiles: [], cardio: [], strength: [], sessions: [], meals: [], sleep: [], customFoods: [], customCardio: [], exercises: [], plans: [], draft: null}; }
  const calories = (p, c, f) => Math.round((p * 4 + c * 4 + f * 9) * 10) / 10;
  function distanceToKm(value,unit='km') { if(!DISTANCE_UNITS.includes(unit))throw Error('距离单位不正确。');return value===null?null:value/(unit==='m'?1000:1); }
  function distanceFromKm(value,unit='km') { if(!DISTANCE_UNITS.includes(unit))throw Error('距离单位不正确。');return value===null?null:value*(unit==='m'?1000:1); }
  function speedToKmh(value,unit='km/h') { if(!SPEED_UNITS.includes(unit))throw Error('速度单位不正确。');if(value===null)return null;if(!Number.isFinite(value)||value<=0)throw Error('速度或配速须大于 0。');return unit==='min/km'?60/value:unit==='h/km'?1/value:value; }
  function speedFromKmh(value,unit='km/h') { if(value===null)return null;return unit==='min/km'?60/value:unit==='h/km'?1/value:value; }
  function resolveCardioMetrics(minutes,distance,speed) {
    if(!finite(minutes,.1,1440))throw Error('运动时间须在 0.1–1440 分钟之间。');
    if(distance!==null&&(!Number.isFinite(distance)||distance<=0))throw Error('距离须大于 0，也可以留空由速度计算。');
    if(speed!==null&&(!Number.isFinite(speed)||speed<=0))throw Error('速度须大于 0，也可以留空由距离计算。');
    if(distance===null&&speed===null)throw Error('填写距离或速度中的任意一项，另一项会按总时间自动计算。');
    if(distance===null)distance=speed*minutes/60;
    if(speed===null)speed=distance/minutes*60;
    return{distance,speed};
  }
  function foodTotals(items) {
    const total={protein:0,carbs:0,fat:0,kcal:0};
    for(const item of items)for(const k of Object.keys(total))total[k]+=item.per100[k]*item.grams/100;
    for(const k of Object.keys(total))total[k]=Math.round(total[k]*(k==='kcal'?10:100))/(k==='kcal'?10:100);
    return total;
  }
  const mealCalories = meal => meal.energyMethod==='food-database'&&meal.foods?.length?foodTotals(meal.foods).kcal:calories(meal.protein,meal.carbs,meal.fat);
  function validatePrivateFood(food) {
    if(!food||!validId(food.id)||!food.id.startsWith('private-')||!text(food.name)||!text(food.updatedAt)||!validDate(food.updatedAt.slice(0,10))||!Number.isFinite(Date.parse(food.updatedAt))||!Array.isArray(food.ingredients)||food.ingredients.length<1||food.ingredients.length>100||food.ingredients.some(s=>!text(s,200))||!text(food.cookingMethod,500))throw Error('请填写食物名称、食材清单（含调料与食用油）和烹饪方式。');
    if(!finite(food.basisGrams,.1,5000)||['protein','carbs','fat'].some(k=>!finite(food[k],0,5000)))throw Error('成品重量须为 0.1–5000 g，三大营养素须填写非负克数，未摄入请填 0。');
    if(food.protein+food.carbs+food.fat>food.basisGrams+.000001)throw Error('三大营养素总克数不能超过对应的成品重量。');
  }
  function privateFoodPer100(food) {
    validatePrivateFood(food);
    const ratio=100/food.basisGrams,protein=food.protein*ratio,carbs=food.carbs*ratio,fat=food.fat*ratio;
    // Round after portion scaling so small nutrient amounts in large recipes are retained.
    return {protein,carbs,fat,kcal:protein*4+carbs*4+fat*9};
  }
  function privateFoodSnapshot(food,grams) {
    const snapshot={foodId:food.id,name:food.name,description:food.name,source:'private',release:food.updatedAt.slice(0,10),grams,per100:privateFoodPer100(food),recipe:JSON.parse(JSON.stringify(food))};
    validateFood(snapshot);
    return snapshot;
  }
  function validateFood(item) {
    if(item?.source==='private'){
      const expected=privateFoodPer100(item.recipe);
      if(item.foodId!==item.recipe.id||item.name!==item.recipe.name||item.description!==item.name||item.release!==item.recipe.updatedAt.slice(0,10)||!finite(item.grams,.1,5000)||!item.per100||Object.keys(expected).some(k=>!Number.isFinite(item.per100[k])||Math.abs(item.per100[k]-expected[k])>.000001))throw Error('私人食物的重量或营养快照不正确。');
      return;
    }
    if(!item||!(item.source==='tfda'?validId(item.sourceId)&&item.foodId==='tfda-'+item.sourceId:Number.isInteger(item.fdcId)&&finite(item.fdcId,1,100000000))||!text(item.name,500)||!text(item.description,2000)||!['foundation','sr-legacy','tfda'].includes(item.source)||typeof item.release!=='string'||!/^\d{4}-\d{2}(-\d{2})?$/.test(item.release)||!finite(item.grams,.1,5000)||!item.per100||['protein','carbs','fat'].some(k=>!finite(item.per100[k],0,100))||!finite(item.per100.kcal,0,1000)) throw Error('食物来源、重量或每 100 g 营养值不正确。');
  }
  function metabolism(p) {
    if (!p || p.age < 18) return null;
    const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
    const low = base + (p.sex === 'male' ? 5 : -161), high = base + (p.sex === 'female' ? -161 : 5);
    return {low: Math.round(low * .9), high: Math.round(high * 1.1)};
  }
  function sleepHours(start, end) {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (!Number.isFinite(ms) || ms <= 0 || ms > 24 * 3600000) throw Error('起床时间须晚于入睡时间，且间隔不超过 24 小时。');
    return ms / 3600000;
  }
  const profileAt = (db, date) => db.profiles.filter(p => p.date <= date).sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt)).at(-1) || null;
  function summary(db, date) {
    const cardio = db.cardio.filter(r => r.date === date), strength = db.strength.filter(r => r.date === date), meals = db.meals.filter(r => r.date === date), sleep = db.sleep.find(r => r.date === date);
    return {cardio, strength, meals, sleep, minutes: cardio.reduce((n, r) => n + r.minutes, 0), sets: strength.reduce((n, r) => n + r.sets.length, 0), kcal: meals.reduce((n, r) => n + mealCalories(r), 0), protein: meals.reduce((n,r) => n+r.protein,0), carbs: meals.reduce((n,r) => n+r.carbs,0), fat: meals.reduce((n,r) => n+r.fat,0), volume: strength.reduce((n,r) => n+r.sets.reduce((v,s) => v+totalWeight(r,s)*s.reps,0),0)};
  }
  const totalWeight = (r, s) => s.weight + (r.equipment === '杠铃' ? r.barWeight : 0);
  function groupedSets(r) {
    const groups = new Map();
    for (const s of r.sets) { const k = `${s.weight}|${s.reps}`; const g = groups.get(k) || {weight: totalWeight(r,s), reps:s.reps,count:0}; g.count++; groups.set(k,g); }
    return [...groups.values()];
  }
  function lastWeight(db, name, equipment, date = localDate()) {
    const r = db.strength.filter(r => r.name === name && r.equipment === equipment && r.sets.length && r.date <= date).sort((a,b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt)).at(-1);
    return r ? {weight:r.sets.at(-1).weight,barWeight:r.barWeight} : {weight:0,barWeight:20};
  }
  function mealName(db, date, type) {
    if (type !== '练后餐') return type;
    const chinese = ['', '', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    const used = db.meals.filter(r=>r.date===date&&r.type===type).map(r=>{const suffix=r.name.slice(3);return suffix===''?1:(chinese.indexOf(suffix)>1?chinese.indexOf(suffix):Number(suffix)||1);});
    const i = Math.max(0,...used)+1;
    return '练后餐'+(i===1?'':(chinese[i]||i));
  }
  function validateProfile(p) {
    if (!validDate(p.date) || !validId(p.id) || !text(p.updatedAt) || !finite(p.height, 80, 250) || !finite(p.weight, 20, 400) || !Number.isInteger(p.age) || !finite(p.age, 10, 120) || !['male','female','unspecified'].includes(p.sex)) throw Error('请填写有效的身高、体重、年龄与性别。');
    for (const [key,min,max] of [['waist',20,250],['arm',10,100],['bodyFat',1,75]]) if(p[key] !== null && !finite(p[key],min,max)) throw Error('请检查腰围、臂围或体脂数值。');
  }
  function validateEnergy(e){
    if(!e||e.version!==1||e.method!=='MET-2024'||!/^\d{5}$/.test(e.code)||!text(e.label,100)||!finite(e.met,1,30)||!finite(e.weight,20,400)||!finite(e.minutes,.1,1440)||!finite(e.netKcal,0,300000)||!finite(e.grossKcal,0,300000)||Math.abs(e.grossKcal-e.met*3.5*e.weight/200*e.minutes)>.11||Math.abs(e.netKcal-(e.met-1)*3.5*e.weight/200*e.minutes)>.11)throw Error('运动消耗估算格式或计算值不正确。');
  }
  function validateRecord(kind, r, allowEmpty = false) {
    if(!r || !validId(r.id) || !validDate(r.date) || !text(r.updatedAt)) throw Error('记录日期或编号不正确。');
    if(kind==='cardio') {
      if(r.energy!==undefined&&r.energy!==null){validateEnergy(r.energy);if(Math.abs(r.energy.minutes-r.minutes)>.001)throw Error('运动消耗时长与记录不一致。');}
      if(!text(r.type) || !finite(r.minutes,.1,1440)) throw Error('运动时间须在 0.1–1440 分钟之间。');
      for(const [k,max] of [['distance',2000],['speed',500],['slope',100],['height',20000],['floors',10000],['steps',1000],['count',1000000]]) if(r[k]!==null && !finite(r[k],0,max)) throw Error('运动数值超出有效范围。');
      if(['跑步','游泳','骑行','散步','爬坡','划船'].includes(r.type) && (!finite(r.distance,.001,2000)||!finite(r.speed,.001,500))) throw Error('请填写有效的距离和速度。');
      for(const [type,keys] of [['爬坡',['slope']],['登山',['height']],['爬楼',['floors','steps']],['跳绳',['count']]]) if(r.type===type && keys.some(k=>!finite(r[k],k==='slope'?0:1, k==='count'?1000000:k==='height'?20000:10000))) throw Error('请补全该运动的专项数据。');
      for(const k of ['floors','steps','count']) if(r[k]!==null && !Number.isInteger(r[k])) throw Error('层数、台阶数和跳绳个数须为整数。');
      if(r.distanceUnit!==undefined&&!DISTANCE_UNITS.includes(r.distanceUnit))throw Error('距离单位不正确。');
      if(r.speedUnit!==undefined&&!SPEED_UNITS.includes(r.speedUnit))throw Error('速度单位不正确。');
      if(r.type==='游泳'){
        if(r.stroke!==undefined&&!STROKES.includes(r.stroke))throw Error('请选择有效泳姿。');
        if(r.poolLength!==undefined&&r.poolLength!==null){
          if(!POOLS.includes(r.poolLength)||!Number.isInteger(r.laps)||!finite(r.laps,1,10000)||!STROKES.includes(r.stroke)||Math.abs(r.distance-r.poolLength*r.laps/1000)>.000001)throw Error('请检查泳池长度、泳姿与单程趟数。');
        }else if(r.laps!==undefined&&r.laps!==null)throw Error('泳池计趟记录需要泳池长度。');
      }
      if(r.energyEffort!==undefined&&!['moderate','vigorous'].includes(r.energyEffort))throw Error('运动强度选项不正确。');
    } else if(kind==='strength') {
      if(!text(r.name)||!EQUIPMENT.includes(r.equipment)||!finite(r.barWeight,0,100)||!Array.isArray(r.muscles)||r.muscles.length!==1||r.muscles.some(m=>!MUSCLES.includes(m))||!['split','big3'].includes(r.mode)||!Array.isArray(r.sets)||r.sets.length>1000||(!allowEmpty&&!r.sets.length)||![3,4,5,6].includes(r.split)||(r.note!==undefined&&(typeof r.note!=='string'||r.note.length>1000))) throw Error('力量训练记录不完整。');
      for(const s of r.sets) if(!s || !finite(s.weight,0,1000)||!Number.isInteger(s.reps)||!finite(s.reps,1,1000)||(s.warmup!==undefined&&typeof s.warmup!=='boolean')) throw Error('重量须为 0–1000 kg，次数须为 1–1000 的整数。');
    } else if(kind==='meals') {
      if(r.foods!==undefined&&(!Array.isArray(r.foods)||r.foods.length>100)) throw Error('一餐最多保存 100 项食物。');
      if(r.foods)r.foods.forEach(validateFood);
      if(r.energyMethod!==undefined&&!['manual','food-database'].includes(r.energyMethod)) throw Error('饮食热量计算方式不正确。');
      if(r.energyMethod==='food-database'){
        if(!r.foods?.length)throw Error('请先选择食物并填写食用重量。');
        const total=foodTotals(r.foods);
        if(['protein','carbs','fat'].some(k=>Math.abs(total[k]-r[k])>.011))throw Error('营养素已修改，请使用手动计算或重新应用食物合计。');
      }
      if(!MEALS.includes(r.type)||!text(r.name)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)||['protein','carbs','fat'].some(k=>!finite(r[k],0,2000))||(r.protein+r.carbs+r.fat<=0&&r.energyMethod!=='food-database')) throw Error('请填写有效时间，营养素须为 0–2000 g；手动录入时至少一项大于 0。');
    } else if(kind==='sleep') {
      if(typeof r.awakening!=='boolean'||typeof r.start!=='string'||typeof r.end!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.start)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.end)||r.end.slice(0,10)!==r.date) throw Error('睡眠应归到起床当天。');
      sleepHours(r.start,r.end);
    }
  }
  function validateBackup(raw) {
    if(typeof raw==='string'&&raw.length>4000000) throw Error('备份超过 4 MB，请缩小文件后重试。');
    const db = typeof raw==='string'?JSON.parse(raw):raw;
    if(!db||db.version!==VERSION) throw Error('不支持的备份版本。');
    if(db.customFoods===undefined)db.customFoods=[];
    if(!Array.isArray(db.customFoods)||db.customFoods.length>1000)throw Error('私人食物库格式不正确，最多保存 1000 项。');
    db.customFoods.forEach(validatePrivateFood);
    if(new Set(db.customFoods.map(f=>f.id)).size!==db.customFoods.length)throw Error('私人食物编号重复。');
    if(db.sessions===undefined)db.sessions=[];
    if(!Array.isArray(db.sessions)||db.sessions.length>50000)throw Error('力量训练场次格式不正确。');
    for(const s of db.sessions){
      if(!s||!validId(s.id)||!validDate(s.date)||(s.minutes!==null&&!finite(s.minutes,.1,1440))||!['moderate','vigorous'].includes(s.effort))throw Error('力量训练场次格式不正确。');
      if(s.energy!==null&&s.energy!==undefined){validateEnergy(s.energy);if(s.minutes===null||Math.abs(s.minutes-s.energy.minutes)>.001)throw Error('力量训练消耗时长不一致。');}
    }
    if(new Set(db.sessions.map(s=>s.id)).size!==db.sessions.length)throw Error('力量训练场次编号重复。');
    for(const key of ['profiles','cardio','strength','meals','sleep','customCardio','exercises','plans']) if(!Array.isArray(db[key])||db[key].length>50000) throw Error('备份格式不正确或记录过多。');
    db.profiles.forEach(validateProfile);
    for(const key of ['cardio','strength','meals','sleep']) db[key].forEach(r=>validateRecord(key,r));
    for(const key of ['customCardio','exercises']) if(db[key].some(s=>!text(s))) throw Error('自定义名称不正确。');
    const ids=[...db.profiles,...db.cardio,...db.strength,...db.meals,...db.sleep].map(r=>r.id);
    if(new Set(ids).size!==ids.length||new Set(db.sleep.map(r=>r.date)).size!==db.sleep.length) throw Error('备份中存在重复记录。');
    for(const p of db.plans) if(!validId(p.id)||!text(p.name)||!Array.isArray(p.days)||![3,4,5,6].includes(p.days.length)||p.days.some(m=>!MUSCLES.includes(m))||new Set(p.days).size!==p.days.length||!Number.isInteger(p.cursor)||p.cursor<0||p.cursor>=p.days.length) throw Error('训练计划格式不正确。');
    if(db.draft!==null) {
      const d=db.draft;
      if(!validId(d.id)||!validDate(d.date)||!MUSCLES.includes(d.muscle)||!['split','big3'].includes(d.mode)||![3,4,5,6].includes(d.split)||!Array.isArray(d.finished)||d.finished.length>1000) throw Error('进行中训练格式不正确。');
      d.finished.forEach(r=>validateRecord('strength',r));
      if(d.active!==null) validateRecord('strength',d.active,true);
      if(d.finished.some(r=>r.date!==d.date)||(d.active&&d.active.date!==d.date)) throw Error('训练日期不一致。');
    }
    const planIds=db.plans.map(p=>p.id); if(new Set(planIds).size!==planIds.length) throw Error('计划编号重复。');
    return db;
  }
  root.Fitness = {VERSION,MUSCLES,CARDIO,EQUIPMENT,MEALS,STROKES,POOLS,DISTANCE_UNITS,SPEED_UNITS,uid,localDate,shiftDay,validDate,blank,calories,distanceToKm,distanceFromKm,speedToKmh,speedFromKmh,resolveCardioMetrics,foodTotals,mealCalories,validateFood,validatePrivateFood,privateFoodPer100,privateFoodSnapshot,metabolism,sleepHours,profileAt,summary,totalWeight,groupedSets,lastWeight,mealName,validateProfile,validateEnergy,validateRecord,validateBackup};
})(globalThis);
