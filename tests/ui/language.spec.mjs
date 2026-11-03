import {test,expect} from '@playwright/test';
test.use({locale:'en-US'});
const modal=page=>page.locator('#modal');
const db=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('dailyfitness.v2')));
const enter=async page=>{await page.goto('/');await page.getByRole('button',{name:'Explore first, fill this in later'}).click();};
const nav=async(page,name)=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
const noOverflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

test('system locale, unsaved welcome inputs, preference persistence and keyboard language selection',async({page})=>{
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.screenshot({path:'artifacts/welcome-en-0.4.png',fullPage:true});
  await page.locator('[name=height]').fill('175');
  await page.locator('#language-select').selectOption('zh-CN');
  await expect(page.locator('[name=height]')).toHaveValue('175');
  await expect(page.getByRole('button',{name:'开启我的健康日历'})).toBeVisible();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
  await page.locator('#language-select').focus();await page.keyboard.press('End');await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
});

test('English meal, cardio and sleep save compatible records; switching preserves exact stored data',async({page})=>{
  await enter(page);await page.getByRole('button',{name:'Add meal',exact:true}).click();
  for(const [name,value]of Object.entries({protein:'30',carbs:'60',fat:'10'}))await modal(page).locator(`[name=${name}]`).fill(value);
  await modal(page).locator('[name=type]').selectOption({label:'Breakfast'});
  await modal(page).getByRole('button',{name:'Save meal',exact:true}).click();
  await expect(page.locator('.record-row').filter({hasText:'Breakfast'})).toContainText('450');
  await page.locator('.quick-add').getByRole('button',{name:'Exercise',exact:true}).click();
  await modal(page).getByRole('button',{name:'Cardio',exact:true}).click();
  await modal(page).locator('[name=minutes]').fill('30');await modal(page).locator('[name=distance]').fill('5');
  await modal(page).getByRole('button',{name:'Save exercise',exact:true}).click();
  await expect(page.locator('.record-row').filter({hasText:'Running'})).toBeVisible();
  await page.getByRole('button',{name:'Record or edit sleep'}).click();
  await modal(page).locator('[name=start]').fill('2026-11-02T23:30');await modal(page).locator('[name=end]').fill('2026-11-03T07:00');
  await modal(page).getByRole('button',{name:'Save sleep',exact:true}).click();
  const before=await db(page);expect(before.cardio[0].type).toBe('跑步');expect(before.meals[0].type).toBe('早饭');
  await page.locator('#language-select').selectOption('zh-CN');await expect(page.locator('.record-row').filter({hasText:'跑步'})).toBeVisible();
  expect(await db(page)).toEqual(before);await page.locator('#language-select').selectOption('en');expect(await db(page)).toEqual(before);
});

test('English built-in exercise search preserves canonical history and unsaved workout input across languages',async({page})=>{
  await enter(page);await nav(page,'Training');await page.locator('[data-act=big3]').click();
  await modal(page).locator('[name=name]').fill('bench');await modal(page).locator('[data-exercise-name="卧推"]').click();
  await expect(modal(page).locator('[name=name]')).toHaveValue('Bench press');
  await modal(page).getByRole('button',{name:'Start this exercise'}).click();
  await page.locator('#set-form [name=weight]').fill('40');await page.locator('#set-form [name=reps]').fill('8');
  await page.locator('#language-select').selectOption('zh-CN');await expect(page.locator('#set-form [name=reps]')).toHaveValue('8');
  await page.locator('#language-select').selectOption('en');await page.getByRole('button',{name:'Record a set',exact:true}).click();
  const stored=await db(page);expect(stored.draft.active.name).toBe('卧推');expect(stored.draft.active.equipment).toBe('杠铃');
  await page.getByRole('button',{name:'Finish workout',exact:true}).click();await modal(page).getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.locator('.record-row').filter({hasText:'Bench press'})).toContainText('60 kg × 8 reps');
});

test('English clear confirmation accepts CLEAR only and retains language; native preference failure is recoverable',async({page})=>{
  await enter(page);await nav(page,'Profile');await page.getByRole('button',{name:'Clear all data',exact:true}).click();
  const input=modal(page).locator('[name=clearConfirmation]'),submit=modal(page).getByRole('button',{name:'Permanently clear data'});
  await input.fill('清空');await expect(submit).toBeDisabled();await input.fill('CLEAR');await expect(submit).toBeEnabled();
  await submit.click();await expect(page.getByRole('button',{name:'Start my fitness calendar'})).toBeVisible();
  await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.evaluate(()=>{window.AndroidStore={setLanguage:()=>false};});
  await page.locator('#language-select').selectOption('zh-CN');await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#toast')).toContainText('Could not save your language preference');
});

test('old backups keep custom Chinese text, plans and nutrition snapshots when restored in English',async({page})=>{
  await enter(page);await page.evaluate(()=>{
    const backup=Fitness.blank();backup.customCardio=['我的椭圆机'];backup.plans=[{id:'old-plan',name:'我的旧计划 <保持原样>',days:['胸','背','腿'],cursor:0}];
    const food=FoodNutrition.estimate(FoodNutrition.search('rice',1).foods[0].id,100),totals=Fitness.foodTotals([food]);
    backup.meals=[{id:'old-meal',date:Fitness.localDate(),updatedAt:new Date().toISOString(),type:'早饭',name:'早饭',time:'08:00',protein:totals.protein,carbs:totals.carbs,fat:totals.fat,foods:[food],energyMethod:'food-database'}];
    window.onNativeImport(JSON.stringify(backup));
  });
  await modal(page).getByRole('button',{name:'Confirm',exact:true}).click();
  await nav(page,'Training');await expect(page.getByText('我的旧计划 <保持原样>',{exact:true})).toBeVisible();
  await expect(page.getByText('Chest training',{exact:true})).toBeVisible();
  const before=await db(page);await page.locator('#language-select').selectOption('zh-CN');await page.reload();await page.locator('#language-select').selectOption('en');expect(await db(page)).toEqual(before);
});

test('English food database uses original USDA names and localized validation',async({page})=>{
  await enter(page);await page.getByRole('button',{name:'Add meal',exact:true}).click();
  await modal(page).locator('details.food-estimator>summary').click();await page.locator('#food-source-filter').selectOption('usda');
  await page.locator('#food-query').fill('rice');await page.locator('.food-result').first().click();
  await page.locator('#food-grams').fill('-1');await page.locator('#add-food').click();
  await expect(page.locator('#food-error')).toContainText('Invalid food');
  await page.locator('#food-grams').fill('200');await page.locator('#add-food').click();
  await modal(page).getByRole('button',{name:'Save meal',exact:true}).click();
  const snapshot=(await db(page)).meals[0].foods[0];expect(snapshot.description).toBeTruthy();expect(snapshot.per100).toHaveProperty('kcal');
  await page.locator('.record-row').filter({hasText:'Breakfast'}).click();await expect(page.locator('#meal-foods strong').first()).toContainText(snapshot.description);
});

test('native language preference persists independently from Android health records',async({page})=>{
  await page.addInitScript(()=>{window.AndroidStore={getLanguage:()=>sessionStorage.getItem('native-language')||'zh-CN',setLanguage:value=>{sessionStorage.setItem('native-language',value);return true;},load:()=>'',save:()=>true};});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
  await page.locator('#language-select').selectOption('en');await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
  expect(await page.evaluate(()=>localStorage.getItem('dailyfitness.v2'))).toBeNull();
  expect(await page.evaluate(()=>localStorage.getItem('dailyfitness.language'))).toBeNull();
});

test('English screens, feedback link, modal keyboard exit and narrow/large-text layouts',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await enter(page);
  for(const width of [360,393,1280]){
    await page.setViewportSize({width,height:900});
    for(const route of ['calendar','train','trends','profile']){
      await page.locator(`[data-nav="${route}"]:visible`).first().click();await noOverflow(page);
      expect(await page.locator('#app').innerText()).not.toMatch(/\p{Script=Han}/u);
    }
  }
  await page.setViewportSize({width:393,height:852});await nav(page,'Profile');
  await expect(page.getByRole('link',{name:'Share an idea on GitHub'})).toHaveAttribute('href','https://github.com/losslesswow-tech/dailyfitness/issues/new/choose');
  await page.screenshot({path:'artifacts/profile-en-0.4.png',fullPage:true});
  await nav(page,'Training');await page.screenshot({path:'artifacts/training-en-0.4.png',fullPage:true});
  await nav(page,'Calendar');await page.screenshot({path:'artifacts/calendar-en-0.4.png',fullPage:true});
  await page.locator('.quick-add').getByRole('button',{name:'Exercise',exact:true}).click();await modal(page).getByRole('button',{name:'Cardio',exact:true}).click();
  await modal(page).locator('[name=type]').selectOption('游泳');
  expect(await modal(page).innerText()).not.toMatch(/\p{Script=Han}/u);await noOverflow(page);
  await page.screenshot({path:'artifacts/swimming-en-0.4.png',fullPage:true});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Add meal',exact:true}).click();await noOverflow(page);
  await page.keyboard.press('Escape');await expect(modal(page)).not.toBeVisible();
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');await noOverflow(page);
  expect(errors).toEqual([]);
});
