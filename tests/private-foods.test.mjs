import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../web/core.js';
import '../web/food.js';

const F=Fitness,N=FoodNutrition;
const recipe=()=>({id:'private-chicken',name:'酱油煎鸡胸',ingredients:['鸡胸肉 200 g','酱油 10 g','食用油 5 g','盐 1 g'],cookingMethod:'少油煎熟后加酱油翻炒',basisGrams:250,protein:50,carbs:10,fat:10,updatedAt:'2026-11-03T04:00:00.000Z'});
const meal=food=>({id:'meal',date:'2026-11-03',updatedAt:'2026-11-03T04:00:00Z',type:'中饭',name:'中饭',time:'12:00',foods:[food],energyMethod:'food-database',...F.foodTotals([food])});

test('manual recipe macros scale from finished portion to per 100 g and edible portion',()=>{
  const food=recipe();
  assert.deepEqual(F.privateFoodPer100(food),{protein:20,carbs:4,fat:4,kcal:132});
  const snapshot=F.privateFoodSnapshot(food,150);
  assert.deepEqual(F.foodTotals([snapshot]),{protein:30,carbs:6,fat:6,kcal:198});
  assert.equal(F.mealCalories(meal(snapshot)),198);
  assert.deepEqual(snapshot.recipe.ingredients,food.ingredients);
  assert.equal(snapshot.source,'private');assert.match(N.reference(snapshot),/手动录入/);
  const diluted={...food,basisGrams:5000,protein:0,carbs:0,fat:1};
  assert.equal(F.foodTotals([F.privateFoodSnapshot(diluted,5000)]).kcal,9);
});

test('missing recipe fields, invalid nutrients, impossible mass and invalid portions are rejected',()=>{
  for(const change of [{name:''},{ingredients:[]},{ingredients:[' ']},{ingredients:['a'.repeat(201)]},{ingredients:Array(101).fill('salt')},{cookingMethod:''},{basisGrams:0},{basisGrams:Infinity},{basisGrams:5001},{protein:NaN},{carbs:-1},{fat:'1'},{protein:251},{updatedAt:'invalid'},{id:'168878'}]){
    assert.throws(()=>F.validatePrivateFood({...recipe(),...change}),JSON.stringify(change));
  }
  for(const grams of [0,-1,NaN,Infinity,5001,'100'])assert.throws(()=>F.privateFoodSnapshot(recipe(),grams));
  assert.doesNotThrow(()=>F.privateFoodPer100({...recipe(),protein:0,carbs:0,fat:0}));
  assert.equal(F.privateFoodPer100({...recipe(),basisGrams:100,protein:0,carbs:0,fat:100}).kcal,900);
});

test('private foods can be searched by name, seasoning and cooking method without an official catalog',()=>{
  const foods=[recipe()];
  for(const query of ['酱油煎鸡胸','食用油','翻炒',''])assert.equal(N.searchPrivate(foods,query).total,1);
  assert.equal(N.searchPrivate(foods,'不存在').total,0);
  assert.equal(N.searchPrivate(Array(30).fill(recipe()),'').foods.length,20);
});

test('editing or removing a library item leaves historical meal snapshots independent',()=>{
  const food=recipe(),snapshot=F.privateFoodSnapshot(food,150),db=F.blank();
  db.customFoods=[food];db.meals=[meal(snapshot)];
  food.fat=30;food.ingredients[2]='食用油 25 g';
  assert.equal(snapshot.recipe.fat,10);assert.equal(F.summary(db,'2026-11-03').kcal,198);
  db.customFoods=[];
  const restored=F.validateBackup(JSON.stringify(db));
  assert.equal(restored.meals[0].foods[0].recipe.ingredients[2],'食用油 5 g');
  assert.equal(F.mealCalories(restored.meals[0]),198);
});

test('backups round-trip private recipes and snapshots while migrating older v2 backups',()=>{
  const db=F.blank();db.customFoods=[recipe()];db.meals=[meal(F.privateFoodSnapshot(recipe(),150))];
  assert.deepEqual(F.validateBackup(JSON.stringify(db)),db);
  const legacy=F.blank();delete legacy.customFoods;delete legacy.sessions;
  const restored=F.validateBackup(JSON.stringify(legacy));assert.deepEqual(restored.customFoods,[]);assert.deepEqual(restored.sessions,[]);
  assert.throws(()=>F.validateBackup({...db,customFoods:[recipe(),recipe()]}),/重复/);
  assert.throws(()=>F.validateBackup({...db,customFoods:Array(1001).fill(recipe())}),/1000/);
  assert.throws(()=>F.validateBackup({...db,customFoods:{}}),/格式/);
});

test('tampered nutrient snapshots cannot bypass private recipe or meal total validation',()=>{
  const snapshot=F.privateFoodSnapshot(recipe(),150);
  for(const changed of [{per100:{...snapshot.per100,kcal:999}},{per100:{...snapshot.per100,protein:NaN}},{foodId:'private-other'},{name:'other'},{release:'1999-01-01'},{recipe:null}])assert.throws(()=>F.validateFood({...snapshot,...changed}));
  assert.throws(()=>F.validateRecord('meals',{...meal(snapshot),protein:99}),/已修改/);
});
