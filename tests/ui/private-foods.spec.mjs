import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

const m=page=>page.locator('#modal');
const db=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('dailyfitness.v2')));
const enter=async page=>{await page.goto('/');await page.getByRole('button',{name:'稍后填写，先体验界面'}).click();};
const library=async page=>{await page.locator('.bottom-nav').getByRole('button',{name:'我的',exact:true}).click();await page.locator('[data-act=private-foods]').click();};
const fillRecipe=async page=>{
  for(const [name,value]of Object.entries({privateName:'酱油煎鸡胸',privateIngredients:'鸡胸肉 200 g\n酱油 10 g\n食用油 5 g\n盐 1 g',privateCooking:'少油煎熟后加酱油翻炒',privateBasisGrams:'250',privateProtein:'50',privateCarbs:'10',privateFat:'10'}))await m(page).locator(`[name=${name}]`).fill(value);
};
const create=async page=>{await library(page);await m(page).getByRole('button',{name:'添加私人食物',exact:true}).click();await fillRecipe(page);await m(page).getByRole('button',{name:'保存到私人食物库'}).click();};
const openMeal=async page=>{await page.locator('.bottom-nav').getByRole('button',{name:'日历',exact:true}).click();await page.getByRole('button',{name:'添加饮食',exact:true}).click();await m(page).locator('.food-estimator>summary').click();};
const close=async page=>m(page).getByRole('button',{name:'关闭',exact:true}).click();

test('private recipe creation, unit preview, search by seasoning and reload',async({page})=>{
  await enter(page);await library(page);await expect(m(page)).toContainText('还没有私人食物');
  await m(page).getByRole('button',{name:'添加私人食物',exact:true}).click();await fillRecipe(page);
  await expect(m(page).locator('#private-food-preview')).toHaveText('这份 250 g 共 330 kcal；单位热量 132 kcal / 100 g。');
  await m(page).getByRole('button',{name:'保存到私人食物库'}).click();
  await expect(m(page).locator('.private-food-card')).toContainText('食用油 5 g');expect((await db(page)).customFoods[0].protein).toBe(50);
  await m(page).locator('#private-query').fill('酱油');await expect(m(page).locator('.private-food-card')).toHaveCount(1);
  await m(page).locator('#private-query').fill('不存在');await expect(m(page)).toContainText('没有匹配的私人食物');
  await page.reload();await library(page);await expect(m(page).locator('.private-food-card')).toContainText('132 kcal / 100 g');
});

test('private foods scale into meals alongside official foods and preserve recipe after edit/delete',async({page})=>{
  await enter(page);await create(page);await close(page);await openMeal(page);
  await m(page).locator('#food-source-filter').selectOption('private');await m(page).locator('[data-food-id]').click();
  await expect(m(page).locator('#food-choice')).toContainText('酱油 10 g');await m(page).locator('#food-grams').fill('150');
  await m(page).getByRole('button',{name:'加入本餐',exact:true}).click();await expect(m(page).locator('#meal-kcal')).toHaveText('198');
  await m(page).locator('#food-source-filter').selectOption('usda');await m(page).locator('#food-query').fill('米饭');await m(page).locator('[data-food-id="168878"]').click();
  await m(page).getByRole('button',{name:'加入本餐',exact:true}).click();await expect(m(page).locator('#meal-kcal')).toHaveText('328');
  await m(page).getByRole('button',{name:'保存饮食',exact:true}).click();
  const original=(await db(page)).meals[0];expect(original.foods).toHaveLength(2);
  await library(page);await m(page).getByRole('button',{name:'编辑',exact:true}).click();await m(page).locator('[name=privateFat]').fill('20');
  await m(page).getByRole('button',{name:'保存到私人食物库'}).click();await expect(m(page)).toContainText('168 kcal / 100 g');
  expect((await db(page)).meals[0]).toEqual(original);
  await m(page).getByRole('button',{name:'删除',exact:true}).click();await expect(m(page)).toContainText('已保存餐次');
  await m(page).getByRole('button',{name:'删除',exact:true}).click();expect((await db(page)).customFoods).toEqual([]);
  await close(page);await page.locator('.bottom-nav').getByRole('button',{name:'日历',exact:true}).click();await page.locator('[data-edit=meals]').click();
  await expect(m(page).locator('#meal-kcal')).toHaveText('328');await expect(m(page).locator('#meal-foods')).toContainText('食用油 5 g');
  await m(page).getByRole('button',{name:'保存饮食',exact:true}).click();await page.reload();expect((await db(page)).meals[0].foods).toEqual(original.foods);
});

test('inline creation keeps meal inputs and cancel does not save or block the meal',async({page})=>{
  await enter(page);await openMeal(page);
  for(const [name,value]of Object.entries({protein:'30',carbs:'60',fat:'10'}))await m(page).locator(`[name=${name}]`).fill(value);
  await m(page).locator('#meal-new-private').click();await fillRecipe(page);await m(page).locator('#private-food-cancel').click();expect(await db(page)).toBeNull();
  await m(page).locator('#meal-new-private').click();await fillRecipe(page);await m(page).locator('#private-food-save').click();
  await expect(m(page).locator('[name=protein]')).toHaveValue('30');await expect(m(page).locator('#food-choice')).toContainText('132 kcal');
  await m(page).getByRole('button',{name:'加入本餐',exact:true}).click();await expect(m(page).locator('#meal-kcal')).toHaveText('450');
  await m(page).getByRole('button',{name:'用食物合计填写'}).click();await expect(m(page).locator('#meal-kcal')).toHaveText('132');
  await m(page).getByRole('button',{name:'保存饮食',exact:true}).click();expect((await db(page)).customFoods).toHaveLength(1);
});

test('invalid mass and failed storage retain the recipe for correction and retry',async({page})=>{
  await enter(page);await library(page);await m(page).getByRole('button',{name:'添加私人食物',exact:true}).click();await fillRecipe(page);
  await m(page).locator('[name=privateBasisGrams]').fill('20');await m(page).locator('#private-food-save').click();await expect(m(page).locator('#private-food-error')).toContainText('不能超过');
  await m(page).locator('[name=privateBasisGrams]').fill('250');
  await page.evaluate(()=>{window.AndroidStore={save:()=>false};});await m(page).locator('#private-food-save').click();
  await expect(m(page).locator('#private-food-error')).toContainText('保存失败');await expect(m(page).locator('[name=privateIngredients]')).toHaveValue('鸡胸肉 200 g\n酱油 10 g\n食用油 5 g\n盐 1 g');expect(await db(page)).toBeNull();
  await page.evaluate(()=>{delete window.AndroidStore;});await m(page).locator('#private-food-save').click();expect((await db(page)).customFoods).toHaveLength(1);
});

test('private library exports, restores and is removed by the existing clear-data flow',async({page})=>{
  await enter(page);await create(page);await close(page);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-act=export]').click()]);
  const raw=await fs.readFile(await download.path(),'utf8');expect(JSON.parse(raw).customFoods).toHaveLength(1);
  await page.getByRole('button',{name:'清空全部数据',exact:true}).click();await expect(m(page)).toContainText('私人食物库');
  await m(page).locator('[name=clearConfirmation]').fill('清空');await m(page).getByRole('button',{name:'永久清空数据'}).click();expect((await db(page)).customFoods).toEqual([]);
  await page.evaluate(raw=>window.onNativeImport(raw),raw);await expect(m(page)).toContainText('1 项私人食物');await m(page).getByRole('button',{name:'确认',exact:true}).click();
  await library(page);await expect(m(page).locator('.private-food-card')).toContainText('酱油煎鸡胸');
});

test('private editor fits phone and desktop, preserves custom text in English and supports keyboard save',async({page})=>{
  await enter(page);await page.locator('#language-select').selectOption('en');await page.locator('.bottom-nav').getByRole('button',{name:'Profile',exact:true}).click();await page.locator('[data-act=private-foods]').click();
  await m(page).getByRole('button',{name:'Add private food',exact:true}).click();await fillRecipe(page);
  await m(page).locator('[name=privateCooking]').fill('a'.repeat(150));
  for(const width of [375,1280]){
    await page.setViewportSize({width,height:900});expect(await m(page).evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:375,height:900});await m(page).locator('#private-food-save').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/private-food-editor-en-0.5.png',fullPage:true});
  await m(page).locator('[name=privateFat]').focus();await page.keyboard.press('Enter');await expect(m(page).locator('.private-food-card')).toContainText('酱油煎鸡胸');
  await m(page).getByRole('button',{name:'Close',exact:true}).click();await page.locator('#language-select').selectOption('zh-CN');await page.locator('[data-act=private-foods]').click();
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'artifacts/private-food-library-0.5.png',fullPage:true});
  await expect(m(page)).toContainText('单位热量 132 kcal / 100 g');
});
