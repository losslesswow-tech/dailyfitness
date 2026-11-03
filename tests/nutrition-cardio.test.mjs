import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../web/core.js';
import '../web/data/foods.js';
import '../web/food.js';
const F=Fitness,N=FoodNutrition;
const meal=foods=>({id:'food-meal',date:'2026-11-03',updatedAt:'2026-11-03T12:00:00Z',time:'12:00',type:'中饭',name:'中饭',...F.foodTotals(foods),foods,energyMethod:'food-database'});
test('official catalogs expose only complete macro profiles and traceable releases',()=>{
  assert.equal(FoodCatalog.foods.length,10316);assert.equal(N.tfdaCount,2159);assert.equal(N.aliasCount,2235);
  assert.deepEqual(FoodCatalog.sources.map(s=>[s.inputRecords,s.acceptedRecords]),[[424,364],[7793,7793],[2213,2159]]);
  for(const f of FoodCatalog.foods){assert.ok(f.source==='tfda'?['修正熱量','熱量'].includes(f.energyNutrientId):[1008,2047,2048].includes(f.energyNutrientId));assert.ok(['protein','carbs','fat','kcal'].every(k=>Number.isFinite(f[k])&&f[k]>=0));}
});
test('Chinese names match curated variants, English supports full database and unknown dishes do not guess',()=>{
  assert.ok(N.search('米饭').foods.some(f=>f.id===168878));assert.ok(N.search('鸡胸肉').foods.some(f=>f.id===171077));
  assert.ok(N.search('chicken breast raw').total>0);assert.equal(N.search('不存在的私房菜123').total,0);assert.equal(N.search('').total,0);
  assert.notEqual(N.get(171077).description,N.get(171477).description);
});
test('200 g cooked rice uses published per-100g values; multiple foods sum correctly',()=>{
  const rice=N.estimate(168878,200),egg=N.estimate(173424,50);
  assert.deepEqual(F.foodTotals([rice]),{protein:5.38,carbs:56.4,fat:.56,kcal:260});
  assert.deepEqual(F.foodTotals([rice,egg]),{protein:11.68,carbs:56.96,fat:5.86,kcal:337.5});
  assert.equal(rice.fdcId,168878);assert.equal(rice.release,'2018-04');
});
test('food quantities reject missing, zero, negative, nonfinite and excessive values',()=>{
  for(const g of [0,-1,5001,NaN,Infinity])assert.throws(()=>N.estimate(168878,g));assert.throws(()=>N.estimate(0,100));
  assert.doesNotThrow(()=>N.estimate(168878,.1));
});
test('database energy differs from generic macro energy; manual edits are explicit and backups keep provenance',()=>{
  const r=meal([N.estimate(168878,200)]),db=F.blank();assert.equal(F.mealCalories(r),260);assert.notEqual(F.mealCalories(r),F.calories(r.protein,r.carbs,r.fat));
  db.meals.push(r);assert.equal(F.summary(db,r.date).kcal,260);assert.deepEqual(F.validateBackup(JSON.stringify(db)).meals[0].foods,r.foods);
  assert.throws(()=>F.validateRecord('meals',{...r,protein:30}),/已修改/);
  assert.doesNotThrow(()=>F.validateRecord('meals',{...r,protein:30,energyMethod:'manual'}));
  assert.equal(F.mealCalories({...r,protein:30,energyMethod:'manual'}),F.calories(30,r.carbs,r.fat));
  assert.throws(()=>F.validateRecord('meals',{...r,foods:[{...r.foods[0],source:'unknown-site'}]}),/来源/);
});
test('old manual meals remain valid and official zero-energy foods are not missing nutrients',()=>{
  const r=meal([N.estimate(173647,250)]);assert.equal(F.mealCalories(r),0);assert.doesNotThrow(()=>F.validateRecord('meals',r));
  const old={id:'old',date:'2026-11-03',updatedAt:'now',time:'12:00',type:'中饭',name:'中饭',protein:30,carbs:60,fat:10};
  assert.doesNotThrow(()=>F.validateRecord('meals',old));assert.equal(F.mealCalories(old),450);
});
test('time and either distance or speed resolve incline metrics without requiring both inputs',()=>{
  assert.deepEqual(F.resolveCardioMetrics(30,null,5),{distance:2.5,speed:5});assert.deepEqual(F.resolveCardioMetrics(30,2.5,null),{distance:2.5,speed:5});
  assert.throws(()=>F.resolveCardioMetrics(30,null,null),/任意一项/);assert.throws(()=>F.resolveCardioMetrics(0,2.5,null));
});
test('meters, kilometers, minutes/km and hours/km preserve the same physical quantity',()=>{
  assert.equal(F.distanceToKm(2500,'m'),2.5);assert.equal(F.distanceFromKm(2.5,'m'),2500);
  assert.equal(F.speedToKmh(6,'min/km'),10);assert.equal(F.speedToKmh(.1,'h/km'),10);assert.equal(F.speedFromKmh(10,'min/km'),6);assert.equal(F.speedFromKmh(10,'h/km'),.1);
});
test('pool distances count single lengths, validate strokes, and retain old swim records',()=>{
  const r={id:'swim',date:'2026-11-03',updatedAt:'now',type:'游泳',minutes:10,distance:.5,speed:3,slope:null,height:null,floors:null,steps:null,count:null,stroke:'蛙泳',poolLength:25,laps:20};
  assert.doesNotThrow(()=>F.validateRecord('cardio',r));assert.throws(()=>F.validateRecord('cardio',{...r,distance:1}),/单程/);
  const {stroke,poolLength,laps,...legacy}=r;assert.doesNotThrow(()=>F.validateRecord('cardio',legacy));
});
