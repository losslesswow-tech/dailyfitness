// Download inputs only from the URLs recorded below, then run from the project root.
// Full USDA archives stay in .local; the app receives only complete macro profiles.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import OpenCC from 'opencc-js';

const definitions = [
  {key:'foundation',type:'Foundation',release:'2026-10-29',file:'foundation/FoodData_Central_foundation_food_json_2026-10-29.json',url:'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-10-29.zip'},
  {key:'sr-legacy',type:'SR Legacy',release:'2018-04',file:'sr-legacy/FoodData_Central_sr_legacy_food_json_2018-04.json',url:'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip'}
];
const aliasFile='data/food-aliases.json';
const aliases=fs.existsSync(aliasFile)?JSON.parse(fs.readFileSync(aliasFile,'utf8')):{};
const foods=[],sources=[];
for(const def of definitions){
  const raw=fs.readFileSync(path.join('.local/food-source',def.file));
  const parsed=JSON.parse(raw.toString('utf8'));
  const entries=Object.values(parsed).find(Array.isArray);
  let accepted=0;
  for(const food of entries){
    const get=(id,unit)=>food.foodNutrients.find(n=>n.nutrient?.id===id&&n.nutrient?.unitName?.toLowerCase()===unit&&typeof n.amount==='number'&&Number.isFinite(n.amount));
    const protein=get(1003,'g'),carbs=get(1005,'g'),fat=get(1004,'g');
    const energy=get(2048,'kcal')||get(1008,'kcal')||get(2047,'kcal');
    if(!protein||!carbs||!fat||!energy||[protein,carbs,fat].some(n=>n.amount<0||n.amount>100)||energy.amount<0||energy.amount>1000) continue;
    const alias=aliases[food.fdcId];
    foods.push({id:food.fdcId,description:food.description,source:def.key,protein:protein.amount,carbs:carbs.amount,fat:fat.amount,kcal:energy.amount,energyNutrientId:energy.nutrient.id,...(alias?{name:alias.name,aliases:alias.aliases}: {})});
    accepted++;
  }
  sources.push({key:def.key,title:'USDA FoodData Central — '+def.type,release:def.release,url:def.url,documentation:'https://fdc.nal.usda.gov/download-datasets/',license:'CC0-1.0',sha256:crypto.createHash('sha256').update(raw).digest('hex'),inputRecords:entries.length,acceptedRecords:accepted});
}
const tfdaRaw=fs.readFileSync('.local/food-source/tfda/20_5.json');
const tfdaRows=JSON.parse(tfdaRaw.toString('utf8').replace(/^\uFEFF/,''));
const toSimplified=OpenCC.Converter({from:'tw',to:'cn'}),groups=new Map();
const tfdaNutrients={'粗蛋白':['protein','g'],'粗脂肪':['fat','g'],'總碳水化合物':['carbs','g'],'修正熱量':['correctedKcal','kcal'],'熱量':['kcal','kcal']};
for(const row of tfdaRows){
  const id=row['整合編號'];if(!/^[A-Z]\d{5,9}$/.test(id))continue;
  if(!groups.has(id))groups.set(id,{row,values:{}});
  const key=tfdaNutrients[row['分析項']];if(!key||row['含量單位']!==key[1])continue;
  const raw=row['每100克含量'];if(raw===null||String(raw).trim()===''||!/^\d+(\.\d+)?$/.test(String(raw).trim()))continue;
  const value=Number(String(raw).trim()),previous=groups.get(id).values[key[0]];
  if(previous!==undefined&&previous!==value)throw Error('Conflicting TFDA nutrient rows: '+id+' '+key[0]);
  groups.get(id).values[key[0]]=value;
}
let tfdaAccepted=0;
for(const [sourceId,{row,values:v}] of groups){
  const kcal=v.correctedKcal??v.kcal;
  if(['protein','carbs','fat'].some(k=>!Number.isFinite(v[k])||v[k]<0||v[k]>100)||!Number.isFinite(kcal)||kcal<0||kcal>1000)continue;
  const originalName=row['樣品名稱'],name=toSimplified(originalName),description=row['內容物描述']||originalName;
  const aliases=[originalName,toSimplified(row['俗名']||''),row['俗名']||''];
  if(/白飯|白米飯/.test(originalName))aliases.push('米饭','白米饭');
  if(/高麗菜/.test(originalName))aliases.push(name.replace(/高丽菜/g,'卷心菜'),name.replace(/高丽菜/g,'包菜'));
  if(/水餃/.test(originalName))aliases.push(name.replace(/水饺/g,'饺子'));
  foods.push({id:'tfda-'+sourceId,sourceId,source:'tfda',name,description:originalName+'；'+description,aliases:aliases.filter(Boolean),category:toSimplified(row['食品分類']||''),protein:v.protein,carbs:v.carbs,fat:v.fat,kcal,energyNutrientId:v.correctedKcal!==undefined?'修正熱量':'熱量'});
  tfdaAccepted++;
}
sources.push({key:'tfda',title:'卫福部食品药物管理署 · 食品营养成分资料集',release:'2026-10-05',url:'https://data.fda.gov.tw/data/opendata/export/20/json',documentation:'https://data.gov.tw/dataset/8543',license:'Open Government Data License, version 1.0',licenseUrl:'https://data.gov.tw/license',sha256:crypto.createHash('sha256').update(tfdaRaw).digest('hex'),inputRecords:groups.size,acceptedRecords:tfdaAccepted});
const ids=new Set(foods.map(f=>f.id));
if(ids.size!==foods.length)throw Error('Duplicate FDC IDs');
for(const id of Object.keys(aliases))if(!ids.has(Number(id)))throw Error('Alias points to missing / incomplete record: '+id);
const catalog={version:2,retrieved:'2026-11-03',basis:'100 g edible portion',license:'See individual sources',provider:'USDA FoodData Central / TFDA',documentation:'https://fdc.nal.usda.gov/download-datasets/',sources,foods};
fs.mkdirSync('web/data',{recursive:true});
fs.writeFileSync('web/data/foods.js','// USDA CC0 and TFDA Open Government Data License v1.0; attribution in catalog.sources and docs/食物数据说明.md.\n// Generated by scripts/build-food-catalog.mjs.\nglobalThis.FoodCatalog='+JSON.stringify(catalog)+';\n');
console.log(JSON.stringify({foods:foods.length,chineseAliases:Object.keys(aliases).length,sources:sources.map(s=>({type:s.key,input:s.inputRecords,accepted:s.acceptedRecords})),bytes:fs.statSync('web/data/foods.js').size}));
