import {test,expect} from '@playwright/test';
const modal=page=>page.locator('#modal');
const data=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('dailyfitness.v2')));
async function enter(page){await page.goto('/');await page.getByRole('button',{name:'稍后填写，先体验界面'}).click();}
async function openCardio(page,type){await page.locator('.quick-add').getByRole('button',{name:'运动',exact:true}).click();await modal(page).getByRole('button',{name:'有氧运动',exact:true}).click();await modal(page).locator('[name=type]').selectOption(type);}
async function openMeal(page){await page.getByRole('button',{name:'添加饮食',exact:true}).click();await modal(page).locator('.food-estimator>summary').click();}
async function food(page,id,grams){const names={168878:'米饭',173424:'水煮蛋',171477:'鸡胸肉'};await modal(page).locator('#food-query').fill(names[id]);await modal(page).locator(`[data-food-id="${id}"]`).click();await modal(page).locator('#food-grams').fill(String(grams));await modal(page).getByRole('button',{name:'加入本餐',exact:true}).click();}
test('food names, gram scaling, multi-food meal, source metadata and database kcal survive reload/edit',async({page})=>{
  await enter(page);await openMeal(page);await food(page,168878,200);await food(page,173424,50);
  await expect(modal(page).locator('#meal-kcal')).toHaveText('337.5');await expect(modal(page).locator('[name=protein]')).toHaveValue('11.68');
  await expect(modal(page).locator('#meal-foods')).toContainText('FDC 168878');await modal(page).getByRole('button',{name:'保存饮食',exact:true}).click();
  expect((await data(page)).meals[0].foods.length).toBe(2);await expect(page.locator('.nutrition-total .big-value')).toContainText('337.5');await expect(page.locator('.record-row').filter({hasText:'早饭'})).toContainText('337.5');
  await page.reload();await page.locator('.record-row').filter({hasText:'早饭'}).click();await expect(modal(page).locator('#meal-foods')).toContainText('200 g');await expect(modal(page).locator('#meal-kcal')).toHaveText('337.5');
  await page.locator('#modal').screenshot({path:'artifacts/nutrition-meal-0.2.png'});
});
test('food estimates do not overwrite existing manual macros and manual edits change energy basis',async({page})=>{
  await enter(page);await openMeal(page);for(const [k,v] of Object.entries({protein:'30',carbs:'60',fat:'10'}))await modal(page).locator(`[name=${k}]`).fill(v);
  await food(page,168878,200);await expect(modal(page).locator('[name=protein]')).toHaveValue('30');await expect(modal(page).locator('#meal-kcal')).toHaveText('450');
  await modal(page).getByRole('button',{name:'用食物合计填写'}).click();await expect(modal(page).locator('#meal-kcal')).toHaveText('260');
  await modal(page).locator('[name=protein]').fill('30');await expect(modal(page).locator('#meal-energy-method')).toContainText('手动');
  await modal(page).getByRole('button',{name:'保存饮食',exact:true}).click();expect((await data(page)).meals[0].energyMethod).toBe('manual');
});
test('unknown food and invalid portions show recoverable messages, then food can be removed',async({page})=>{
  await enter(page);await openMeal(page);await modal(page).locator('#food-query').fill('不存在的私房菜123');await expect(modal(page).locator('#food-results-status')).toContainText('没有匹配项');
  await modal(page).locator('#food-query').fill('米饭');await modal(page).locator('[data-food-id="168878"]').click();await modal(page).locator('#food-grams').fill('0');await modal(page).getByRole('button',{name:'加入本餐',exact:true}).click();await expect(modal(page).locator('#food-error')).toContainText('重量');
  await modal(page).locator('#food-grams').fill('100');await modal(page).getByRole('button',{name:'加入本餐',exact:true}).click();await modal(page).getByRole('button',{name:/移除米饭/}).click();await expect(modal(page).locator('[name=protein]')).toHaveValue('');
});
test('incline saves from time + speed + grade without distance; reverse calculation works in meters',async({page})=>{
  await enter(page);await openCardio(page,'爬坡');await modal(page).locator('[name=minutes]').fill('30');await modal(page).locator('[name=speed]').fill('5');await modal(page).locator('[name=slope]').fill('10');await expect(modal(page).locator('[name=distance]')).toHaveValue('2.5');
  await modal(page).getByRole('button',{name:'保存运动',exact:true}).click();expect((await data(page)).cardio[0].distance).toBe(2.5);
  await openCardio(page,'爬坡');await modal(page).locator('[name=distanceUnit]').selectOption('m');await modal(page).locator('[name=minutes]').fill('30');await modal(page).locator('[name=distance]').fill('2500');await modal(page).locator('[name=slope]').fill('10');await expect(modal(page).locator('[name=speed]')).toHaveValue('5.00');
  await modal(page).getByRole('button',{name:'保存运动',exact:true}).click();expect((await data(page)).cardio[1].speed).toBe(5);expect((await data(page)).cardio[1].distanceUnit).toBe('m');
});
test('pace units convert and persist without changing distance',async({page})=>{
  await enter(page);await openCardio(page,'跑步');await modal(page).locator('[name=minutes]').fill('30');await modal(page).locator('[name=speedUnit]').selectOption('h/km');await modal(page).locator('[name=speed]').fill('0.1');await expect(modal(page).locator('[name=distance]')).toHaveValue('5');
  await modal(page).locator('[name=speedUnit]').selectOption('min/km');await expect(modal(page).locator('[name=speed]')).toHaveValue('6');
  await modal(page).locator('[name=distanceUnit]').selectOption('m');await expect(modal(page).locator('[name=distance]')).toHaveValue('5000');
  await modal(page).getByRole('button',{name:'保存运动',exact:true}).click();const r=(await data(page)).cardio[0];expect(r.speed).toBe(10);expect(r.distance).toBe(5);expect(r.speedUnit).toBe('min/km');
});
test('all pool lengths and strokes use single-length counts, preserve metadata in editor',async({page})=>{
  await enter(page);const pools=[50,25,100,75],strokes=['自由泳','蛙泳','蝶泳','仰泳'];
  for(let i=0;i<pools.length;i++){await openCardio(page,'游泳');await modal(page).locator('[name=poolLength]').selectOption(String(pools[i]));await modal(page).locator('[name=stroke]').selectOption(strokes[i]);await modal(page).locator('[name=minutes]').fill('20');await modal(page).locator('[name=laps]').fill('8');await expect(modal(page).locator('[name=distance]')).toHaveValue(String(pools[i]*8));await modal(page).getByRole('button',{name:'保存运动',exact:true}).click();const r=(await data(page)).cardio[i];expect(r.distance).toBe(pools[i]*8/1000);expect(r.stroke).toBe(strokes[i]);expect(r.laps).toBe(8);}
  await page.locator('.record-row').filter({hasText:'游泳'}).last().click();await expect(modal(page).locator('[name=poolLength]')).toHaveValue('75');await expect(modal(page).locator('[name=laps]')).toHaveValue('8');
  await modal(page).screenshot({path:'artifacts/swimming-0.2.png'});
});
test('cardio field labels align across both columns at phone width and never overflow',async({page})=>{
  await enter(page);await page.setViewportSize({width:360,height:800});await openCardio(page,'骑行');
  for(const type of ['骑行','爬坡','登山','游泳']){
    await modal(page).locator('[name=type]').selectOption(type);const labels=modal(page).locator('#cardio-fields .metric-label');const a=await labels.nth(0).boundingBox(),b=await labels.nth(1).boundingBox();expect(Math.abs(a.y-b.y)).toBeLessThan(1);
    expect(await modal(page).evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  }
  await modal(page).locator('[name=type]').selectOption('爬坡');await modal(page).screenshot({path:'artifacts/cardio-alignment-0.2.png'});
});
