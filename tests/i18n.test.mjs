import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../web/i18n.js',import.meta.url),'utf8');
function runtime(extra={}){const context=vm.createContext({navigator:{language:'en-US'},...extra});vm.runInContext(source,context);return context.I18n;}

test('locale uses saved preference and handles unavailable storage without touching health data',()=>{
  const writes=[];
  const i=runtime({navigator:{language:'zh-TW'},localStorage:{getItem:()=> 'en',setItem:(...args)=>writes.push(args)}});
  assert.equal(i.language,'en');i.setLanguage('zh-CN');assert.equal(i.t('日历'),'日历');
  assert.deepEqual(writes,[['dailyfitness.language','zh-CN']]);
  assert.equal(runtime({localStorage:{getItem:()=>{throw Error('blocked');}}}).language,'en');
  assert.equal(runtime({navigator:{language:'zh-SG'}}).language,'zh-CN');
});

test('failed native preference save keeps the previous language and reports the error in that language',()=>{
  const i=runtime({AndroidStore:{getLanguage:()=> 'en',setLanguage:()=>false}});
  assert.throws(()=>i.setLanguage('zh-CN'),/Could not save/);assert.equal(i.language,'en');
  assert.throws(()=>i.setLanguage('fr'),/Unsupported/);
});

test('messages preserve interpolation values, including user text and dollar signs',()=>{
  const i=runtime();assert.equal(i.t('备注：{0}','我的动作 $& {1}'),'Notes: 我的动作 $& {1}');
  assert.equal(i.t('第 {0} 组已保存',3),'Set 3 saved');
  for(const [key,value]of Object.entries(i.messages)){
    const placeholders=text=>[...new Set(text.match(/\{\d+\}/g)||[])].sort();
    assert.deepEqual(placeholders(value),placeholders(key),`Lost interpolation: ${key}`);
    assert.ok(!/\p{Script=Han}/u.test(value),`Untranslated English message: ${key}`);
  }
});

test('all authored UI messages and built-in activities have English translations',()=>{
  const i=runtime(),app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  for(const match of app.matchAll(/tr\(("(?:[^"\\]|\\.)*")/g)){
    const key=JSON.parse(match[1]);assert.ok(Object.hasOwn(i.messages,key),`Missing message: ${key}`);
  }
  const context=vm.createContext({});
  for(const file of ['core.js','data/activities.js'])vm.runInContext(fs.readFileSync(new URL('../web/'+file,import.meta.url),'utf8'),context);
  for(const value of [...context.Fitness.CARDIO,...context.Fitness.MUSCLES,...context.Fitness.EQUIPMENT,...context.Fitness.MEALS,...context.Fitness.STROKES,...Object.values(context.ActivityCatalog.entries).map(x=>x.label)])assert.ok(Object.hasOwn(i.messages,value),`Missing built-in: ${value}`);
});
