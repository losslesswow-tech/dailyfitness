import fs from 'node:fs';
import crypto from 'node:crypto';
const groups={
  running:{slug:'running',labels:{12026:'慢跑约 4.2–6 km/h',12028:'跑步约 6.4–6.8 km/h',12029:'跑步约 6.9–7.7 km/h',12030:'跑步约 8.0–8.4 km/h',12045:'跑步约 8.9–9.3 km/h',12050:'跑步约 9.7–10.1 km/h',12060:'跑步约 10.8 km/h',12070:'跑步约 11.3 km/h',12080:'跑步约 12.1 km/h',12090:'跑步约 12.9 km/h',12100:'跑步约 13.8 km/h',12110:'跑步约 14.5 km/h',12120:'跑步约 16.1 km/h',12130:'跑步约 17.7 km/h'}},
  walking:{slug:'walking',labels:{17151:'平地慢走，低于约 3.2 km/h',17152:'平地慢走，约 3.2–3.9 km/h',17170:'平地步行，约 4 km/h',17190:'平地适中步行，约 4.5–5.5 km/h',17200:'平地快走，约 5.6–6.3 km/h',17220:'平地很快步行，约 6.4–7.1 km/h',17230:'平地快速步行，约 7.2–7.9 km/h',17032:'爬坡，无负重，5–20% 坡，极慢',17034:'爬坡，无负重，1–5% 坡，适中至较快',17035:'爬坡，无负重，6–10% 坡，适中至较快',17036:'爬坡，无负重，11–20% 坡，慢至适中',17038:'陡坡约 30%，低于约 1.9 km/h',17039:'陡坡 30–40%，约 1.9–2.9 km/h',17040:'陡坡 10–40%，约 2.9–8 km/h',17082:'一般无负重徒步',17080:'越野徒步',17131:'一般爬楼梯'}},
  bicycling:{slug:'bicycling',labels:{'01010':'休闲骑行，低于约 16 km/h','01020':'骑行约 16–19 km/h','01030':'骑行约 19–22 km/h','01040':'骑行约 23–26 km/h','01050':'骑行约 26–31 km/h','01060':'骑行高于约 32 km/h'}},
  water:{slug:'water-activities',labels:{18240:'自由泳，慢速休闲',18230:'自由泳，快速较高强度',18265:'蛙泳，休闲',18260:'蛙泳，训练或比赛',18255:'仰泳，休闲',18250:'仰泳，训练或比赛',18270:'蝶泳，一般',18310:'一般休闲游泳',18070:'水上划船，休闲'}},
  conditioning:{slug:'conditioning-exercise',labels:{'02071':'划船机，低于 100 W，中等强度','02070':'划船机，一般较高强度','02005':'健身操，低冲击中等强度','02006':'健身操，高冲击较高强度','02054':'多动作力量训练，一般强度','02050':'力量训练，较高强度','02048':'椭圆机，中等强度','02101':'轻度拉伸','02056':'自重力量训练，一般强度'}},
  sports:{slug:'sports',labels:{15552:'跳绳，少于 100 次/分钟',15551:'跳绳，约 100–120 次/分钟',15550:'跳绳，约 120–160 次/分钟',15030:'羽毛球，休闲单双打',15050:'篮球，非比赛一般活动',15040:'篮球比赛',15610:'足球，休闲',15605:'足球比赛',15660:'乒乓球',15680:'网球双打'}}
};
const entries={},pages=[];
for(const [file,group]of Object.entries(groups)){
  const raw=fs.readFileSync('.local/energy-source/'+file+'.html'),html=raw.toString('utf8');
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>c[1].replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()));
  const byCode=new Map(rows.filter(r=>/^\d{5}$/.test(r[0]||'')).map(r=>[r[0],r]));
  for(const [rawCode,label]of Object.entries(group.labels)){
    const code=rawCode.padStart(5,'0'),row=byCode.get(code);
    if(!row||!Number.isFinite(Number(row[1])))throw Error('Missing official MET row: '+code);
    entries[code]={code,met:Number(row[1]),label,url:'https://pacompendium.com/'+group.slug+'/'};
  }
  pages.push({url:'https://pacompendium.com/'+group.slug+'/',sha256:crypto.createHash('sha256').update(raw).digest('hex')});
}
const data={version:'2024',retrieved:'2026-11-03',ageRange:[19,59],documentation:'https://pacompendium.com/adult-compendium/',citation:'Herrmann et al. 2024 Adult Compendium of Physical Activities. doi:10.1016/j.jshs.2023.10.010',pages,entries};
fs.writeFileSync('web/data/activities.js','// Selected unmodified MET values from the official 2024 Adult Compendium; Chinese labels are display translations.\nglobalThis.ActivityCatalog='+JSON.stringify(data)+';\n');
console.log('Generated '+Object.keys(entries).length+' activity profiles from official tables.');
