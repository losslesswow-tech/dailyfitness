(function(root){
  'use strict';
  const catalog=root.FoodCatalog;
  const foods=catalog?.foods||[];
  const byId=new Map(foods.map(f=>[String(f.id),f]));
  const sources=new Map((catalog?.sources||[]).map(s=>[s.key,s]));
  const normalize=s=>String(s).normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
  const index=foods.map(f=>({food:f,name:normalize(f.name||''),aliases:(f.aliases||[]).map(normalize),english:normalize(f.description)}));
  function search(query,limit=20,sourceFilter='all'){
    const q=normalize(query).slice(0,100);
    if(!q)return{total:0,foods:[]};
    const words=q.split(' '),matches=[];
    for(const item of index){
      if(sourceFilter==='tfda'&&item.food.source!=='tfda'||sourceFilter==='usda'&&item.food.source==='tfda')continue;
      let score=item.name===q||item.aliases.includes(q)?100:item.name.includes(q)?85:item.aliases.some(a=>a.includes(q))?75:item.english.includes(q)?50:words.length>1&&words.every(w=>(item.name+' '+item.aliases.join(' ')+' '+item.english).includes(w))?35:0;
      if(score){if(item.food.source==='foundation')score+=3;if(item.food.name)score+=2;matches.push({food:item.food,score});}
    }
    matches.sort((a,b)=>b.score-a.score||String(a.food.id).localeCompare(String(b.food.id)));
    return{total:matches.length,foods:matches.slice(0,limit).map(m=>m.food)};
  }
  function estimate(id,grams){
    const food=byId.get(String(id));
    if(!food)throw Error('请先选择食物数据库中的具体项目。');
    const source=sources.get(food.source);
    const snapshot={...(food.source==='tfda'?{foodId:food.id,sourceId:food.sourceId}:{fdcId:food.id}),name:food.name||food.description,description:food.description,source:food.source,release:source.release,grams:Number(grams),per100:{protein:food.protein,carbs:food.carbs,fat:food.fat,kcal:food.kcal}};
    root.Fitness.validateFood(snapshot);
    return snapshot;
  }
  const reference=food=>food.source==='tfda'?'TFDA · 样品 '+(food.sourceId||String(food.id||food.foodId).replace(/^tfda-/,'')):'USDA · FDC '+(food.fdcId||food.id);
  root.FoodNutrition={available:foods.length>0,count:foods.length,aliasCount:foods.filter(f=>f.name).length,tfdaCount:foods.filter(f=>f.source==='tfda').length,search,estimate,reference,get:id=>byId.get(String(id)),source:key=>sources.get(key),documentation:catalog?.documentation||'https://fdc.nal.usda.gov/download-datasets/'};
})(globalThis);
