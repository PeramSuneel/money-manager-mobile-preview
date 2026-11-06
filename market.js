(()=>{'use strict';
const $=id=>document.getElementById(id),num=v=>Number(v)||0,fmt=v=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(num(v));
let rates=null,stamp='',source='',purchases=[],refreshing=false;
try{purchases=JSON.parse(localStorage.getItem('mmMetalPurchases.v1')||'[]')}catch{}
try{const c=JSON.parse(localStorage.getItem('mmMarketCache.v2')||'null');if(c?.rates){rates=c.rates;stamp=c.stamp||'';source=c.source||''}}catch{}
const displayTime=v=>{const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})};
async function readText(url){const res=await fetch(url,{cache:'no-store',headers:{'Accept':'text/plain'}});if(!res.ok)throw Error('Source returned '+res.status);return res.text()}
async function readJson(url){const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error('Source returned '+res.status);return res.json()}
function parseRates(page){
 const lines=page.split(/\r?\n/);
 for(const line of lines){
  if(/^\s*\|?\s*1\s*\|/.test(line)&&line.includes('₹')){
   const cells=[...line.matchAll(/₹\s*([\d,]+)(?:\s*\(([+-]?[\d,]+)\))?/g)];
   const vals=cells.map(m=>num(m[1].replace(/,/g,'')));
   if(vals.length>=3&&vals[0]>1000&&vals[1]>1000&&vals[2]>1000){
    return {g24:vals[0],g22:vals[1],g18:vals[2],change24:cells[0][2]===undefined?null:num(cells[0][2].replace(/,/g,'')),change22:cells[1][2]===undefined?null:num(cells[1][2].replace(/,/g,'')),change18:cells[2][2]===undefined?null:num(cells[2][2].replace(/,/g,''))};
   }
  }
 }
 throw Error('Goodreturns response received, but its gold-rate table could not be recognised');
}
function parseGoldHistory(page){
 const rows=[],seen=new Set();
 const months={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
 const add=(day,month,year,v24,v22,kind='daily')=>{
  const mi=months[String(month).toLowerCase()];if(mi===undefined)return;
  const date=[year,String(mi+1).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
  if(!(v24>1000&&v22>1000)||seen.has(date))return;
  seen.add(date);const d=new Date(year,mi,Number(day));
  rows.push({date,label:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),g24:v24,g22:v22,kind});
 };
 const money=s=>num(String(s).replace(/,/g,''));
 const daily=/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\s*\|\s*₹\s*([\d,]+)(?:\s*\([^)]*\))?\s*\|\s*₹\s*([\d,]+)/gi;
 let m;while((m=daily.exec(page))!==null)add(m[2],m[1],Number(m[3]),money(m[4]),money(m[5]),'daily');
 const sections=[...page.matchAll(/Gold Price Movement in Bangalore,\s*([A-Za-z]+)\s+(20\d{2})/gi)];
 for(let si=0;si<sections.length;si++){
  const section=sections[si],month=section[1],year=Number(section[2]),from=section.index,to=si+1<sections.length?sections[si+1].index:page.length,chunk=page.slice(from,to);
  const monthWord=month.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const firstLast=new RegExp('(?:^|\\n)\\s*(\\d{1,2})\\s+'+monthWord+'\\s+rate\\s*\\|\\s*₹\\s*([\\d,]+)\\s*\\|\\s*₹\\s*([\\d,]+)','gi');
  let x;while((x=firstLast.exec(chunk))!==null)add(x[1],month,year,money(x[2]),money(x[3]),'monthly-summary');
  const extremes=new RegExp('(Highest|Lowest) rate in '+monthWord+'\\s*\\|\\s*₹\\s*([\\d,]+)\\s*\\((\\d{1,2})\\s+'+monthWord+'\\)\\s*\\|\\s*₹\\s*([\\d,]+)\\s*\\((\\d{1,2})\\s+'+monthWord+'\\)','gi');
  while((x=extremes.exec(chunk))!==null){add(x[3],month,year,money(x[2]),money(x[4]),'monthly-extreme');add(x[5],month,year,money(x[2]),money(x[4]),'monthly-extreme')}
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
function setStatus(s){['metalStatus','metalFreshness','dashMetalFreshness'].forEach(id=>{if($(id))$(id).textContent=s})}
function draw(){if(!rates)return;[['gold24',rates.g24],['gold22',rates.g22],['gold18',rates.g18],['dashGold24',rates.g24],['dashGold22',rates.g22],['dashGold18',rates.g18]].forEach(([id,v])=>{if($(id))$(id).textContent=fmt(v)});if(rates.silver){[['silverGram',rates.silver],['dashSilver',rates.silver]].forEach(([id,v])=>{if($(id))$(id).textContent=fmt(v)})}['metalSource','dashMetalSource'].forEach(id=>{if($(id))$(id).textContent=source});['metalFreshness','dashMetalFreshness'].forEach(id=>{if($(id))$(id).textContent='Goodreturns updated: '+displayTime(stamp)});renderDayChange('gold24Change','24');renderDayChange('gold22Change','22');renderDayChange('gold18Change','18');renderDayChange('dashGoldMove','24');renderDayChange('dashGold22Move','22');renderDayChange('dashGold18Move','18');renderDayChange('silverChange','silver');renderDayChange('dashSilverMove','silver');[['gold24','24'],['gold22','22'],['gold18','18'],['dashGold24','24'],['dashGold22','22'],['dashGold18','18'],['silverGram','silver'],['dashSilver','silver']].forEach(([id,purity])=>applyRateDirection(id,purity));syncRates();calculateInvestment();calculateJewellery()}
function parseSilverChange(page){
 const lines=page.split(/\r?\n/);
 for(const line of lines){
  if(/^\s*\|?\s*1\s*\|/.test(line)&&line.includes('₹')){
   const m=line.match(/\|\s*1\s*\|\s*₹\s*[\d,]+(?:\.\d+)?\s*\|\s*₹\s*[\d,]+(?:\.\d+)?\s*\|\s*([+−-])?\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
   if(m)return num(m[2].replace(/,/g,''))*(m[1]==='-'||m[1]==='−'?-1:1);
  }
 }
 const m=page.match(/Silver\s*\/g[^\n₹]{0,40}₹\s*[\d,]+[^\n+−-]{0,12}([+−-])\s*₹?\s*([\d,]+)/i);
 return m?num(m[2].replace(/,/g,''))*(m[1]==='-'||m[1]==='−'?-1:1):null;
}
function parseSilverRate(page){const lines=page.split(/\r?\n/);for(const line of lines){if(/^\s*\|?\s*1\s*\|/.test(line)&&line.includes('₹')){const m=line.match(/₹\s*([\d,]+(?:\.\d+)?)/);if(m){const v=Number(m[1].replace(/,/g,''));if(v>50&&v<1000)return v}}}const patterns=[/silver price in Bangalore[^₹]{0,100}₹\s*([\d,]+(?:\.\d+)?)/i,/Silver\s*per gram[^₹]{0,50}₹\s*([\d,]+(?:\.\d+)?)/i];for(const p of patterns){const m=page.match(p);if(m){const v=Number(m[1].replace(/,/g,''));if(v>50&&v<1000)return v}}throw Error('Goodreturns silver-rate table could not be recognised')}
async function fetchReaderPage(path){let lastError;for(const prefix of ['https://r.jina.ai/http://','https://r.jina.ai/https://']){try{const page=await readText(prefix+'www.goodreturns.in/'+path);if(page.length>250)return page}catch(e){lastError=e}}throw lastError||Error('Reader did not return page content')}
let goldHistory=[];
try{const h=JSON.parse(localStorage.getItem('mmGoldHistory.v1')||'[]');if(Array.isArray(h))goldHistory=h}catch{}
function mergeGoldHistory(incoming,liveRates,publishedDateText){
 const merged=new Map();
 for(const row of goldHistory)if(row?.date)merged.set(row.date,row);
 for(const row of incoming)if(row?.date)merged.set(row.date,{...(merged.get(row.date)||{}),...row});
 const dateMatch=String(publishedDateText||'').match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+(\\d{1,2}),?\\s+(20\\d{2})/i);
 if(dateMatch&&liveRates?.g24>1000&&liveRates?.g22>1000){
  const monthNames={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const mi=monthNames[dateMatch[1].slice(0,3).toLowerCase()];
  if(mi!==undefined){const d=new Date(Number(dateMatch[3]),mi,Number(dateMatch[2]));const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');const prev=merged.get(date)||{};merged.set(date,{...prev,date,label:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),g24:liveRates.g24,g22:liveRates.g22,kind:'daily'})}
 }
 goldHistory=[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date));
 try{localStorage.setItem('mmGoldHistory.v1',JSON.stringify(goldHistory))}catch{}
}
function localDateString(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')}
let dailyMetalRates=[];
try{const saved=JSON.parse(localStorage.getItem('mmDailyMetalRates.v1')||'[]');if(Array.isArray(saved))dailyMetalRates=saved}catch{}
function parseSilverHistory(page){
 const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11},rows=[];
 const re=/\|\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})\s*\|\s*₹\s*([\d,]+(?:\.\d+)?)\s*\|/gi;
 let m;while((m=re.exec(page))!==null){const mi=months[m[1].slice(0,3).toLowerCase()],date=[m[3],String(mi+1).padStart(2,'0'),String(m[2]).padStart(2,'0')].join('-');const value=num(m[4]);if(value>50&&value<10000)rows.push({date,silver:value/10})}
 return rows;
}
function mergePublishedMetalHistory(goldRows,silverRows){
 const map=new Map(dailyMetalRates.map(x=>[x.date,x]));
 for(const row of goldRows||[]){if(!row.date||!row.g24||!row.g22)continue;const old=map.get(row.date)||{};map.set(row.date,{...old,date:row.date,g24:num(row.g24),g22:num(row.g22),g18:num(row.g18)||num(row.g24)*.75})}
 for(const row of silverRows||[]){if(!row.date||!row.silver)continue;const old=map.get(row.date)||{};map.set(row.date,{...old,date:row.date,silver:num(row.silver)})}
 dailyMetalRates=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-400);
 try{localStorage.setItem('mmDailyMetalRates.v1',JSON.stringify(dailyMetalRates))}catch{}
}
function recordDailyMetalRates(current){
 if(![current.g24,current.g22,current.g18,current.silver].every(v=>num(v)>0))return;
 const date=localDateString();
 const row={date,g24:num(current.g24),g22:num(current.g22),g18:num(current.g18),silver:num(current.silver)};
 const map=new Map(dailyMetalRates.map(x=>[x.date,x]));map.set(date,row);
 dailyMetalRates=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-400);
 try{localStorage.setItem('mmDailyMetalRates.v1',JSON.stringify(dailyMetalRates))}catch{}
}
function dayChangeFor(key){
 if(!rates||!num(rates[key]))return null;
 const changeKey=key==='g24'?'change24':key==='g22'?'change22':key==='g18'?'change18':'changeSilver';
 const published=rates[changeKey];
 if(published!==null&&published!==undefined&&Number.isFinite(Number(published))){
  const delta=Number(published),previous=num(rates[key])-delta;
  return {delta,pct:previous?delta/previous*100:0};
 }
 const history=dailyMetalRates.filter(x=>num(x[key])>0).sort((a,b)=>a.date.localeCompare(b.date));
 const today=localDateString(),current=num(rates[key]);
 const prior=history.filter(x=>x.date<today).slice(-1)[0]||history.filter(x=>x.date!==today).slice(-1)[0];
 if(!prior)return null;
 const delta=current-num(prior[key]),pct=prior[key]?delta/num(prior[key])*100:0;
 return {delta,pct};
}
function applyRateDirection(id,purity){
 const el=$(id);if(!el)return;
 el.classList.remove('rate-change-up','rate-change-down','rate-change-flat','rate-change-unavailable');
 /* Current quoted rates must never inherit movement colours. */
 el.style.setProperty('color','var(--text)','important');
}
function renderDayChange(id,purity){
 const el=$(id);if(!el)return;
 const key=purity==='24'?'g24':purity==='22'?'g22':purity==='18'?'g18':'silver';
 const change=dayChangeFor(key);
 el.classList.remove('day-change-up','day-change-down','day-change-flat','day-change-unavailable');
 /* Keep the label neutral; colour only the numeric movement span. */
 el.style.setProperty('color','var(--muted)','important');
 el.style.setProperty('font-weight','650','important');
 if(!change){
  el.innerHTML='1-day change: <span class="day-change-value">not published</span>';
  el.classList.add('day-change-unavailable');
  const value=el.querySelector('.day-change-value');
  if(value)value.style.setProperty('color','var(--muted)','important');
  return;
 }
 const sign=change.delta>0?'+':change.delta<0?'−':'';
 const direction=change.delta>0?'is-up':change.delta<0?'is-down':'is-flat';
 el.innerHTML='<span class="day-change-label">1-day change:</span><span class="day-change-value '+direction+'"> '+sign+fmt(Math.abs(change.delta))+'</span>';
 el.classList.add(change.delta>0?'day-change-up':change.delta<0?'day-change-down':'day-change-flat');
 const value=el.querySelector('.day-change-value');
 if(value)value.style.setProperty('color',change.delta>0?'var(--green)':change.delta<0?'var(--red)':'var(--muted)','important');
}
async function refreshRates(){
 if(refreshing)return;refreshing=true;setStatus('Fetching Goodreturns gold and silver rates…');
 try{
  const [goldPage,silverPage]=await Promise.all([fetchReaderPage('gold-rates/bangalore.html'),fetchReaderPage('silver-rates/bangalore.html')]);
  const parsed=parseRates(goldPage),silver=parseSilverRate(silverPage),silverChange=parseSilverChange(silverPage);rates={...parsed,silver,changeSilver:silverChange};
  const history=parseGoldHistory(goldPage),silverHistory=parseSilverHistory(silverPage);
  mergePublishedMetalHistory(history,silverHistory);
  const datePattern=/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}/i;
  const dateMatch=silverPage.match(datePattern)||goldPage.match(datePattern);
  stamp=dateMatch?dateMatch[0]:new Date().toISOString();
  mergeGoldHistory(history,parsed,dateMatch?.[0]||'');
  recordDailyMetalRates(rates);
  source='Goodreturns · Bangalore · gold and silver published indicative rates';
  try{localStorage.setItem('mmMarketCache.v2',JSON.stringify({rates,stamp,source,savedAt:Date.now()}))}catch{}
  draw();setStatus('Successfully updated gold and silver from Goodreturns · '+displayTime(stamp));
 }catch(e){
  setStatus('Could not update both metal rates: '+(e?.message||'Network or proxy error')+'. Showing last saved rates if available.');
  if(rates)draw();else ['gold24','gold22','gold18','dashGold24','dashGold22','dashGold18','silverGram','dashSilver'].forEach(id=>{if($(id))$(id).textContent='Unavailable'});
 }finally{refreshing=false}
}
function selectedRate(metal,purity){if(metal==='silver')return rates?.silver||0;return purity==='18'?(rates?.g18||0):purity==='22'?(rates?.g22||0):(rates?.g24||0)}
function syncRates(){const im=$('investMetal')?.value||'gold',ip=$('investPurity')?.value||'22',jm=$('jewelMetal')?.value||'gold',jp=$('jewelPurity')?.value||'22';if($('investRate')&&!$('investRate').dataset.userEdited)$('investRate').value=selectedRate(im,ip)||'';if($('jewelRate')&&!$('jewelRate').dataset.userEdited)$('jewelRate').value=selectedRate(jm,jp)||''}
function calculateInvestment(){const budget=num($('investBudget')?.value),rate=num($('investRate')?.value),gst=num($('investGst')?.value),grams=rate&&budget?budget/(rate*(1+gst/100)):0;if($('investGrams'))$('investGrams').textContent=grams?grams.toFixed(3)+' g':'—';if($('investSummary'))$('investSummary').textContent=grams?'Approx. '+fmt(budget)+' including '+gst+'% GST, excluding dealer charges.':'Enter a budget and valid rate.'}
function renderPurchases(){if(!$('metalPurchaseTable'))return;$('metalPurchaseTable').innerHTML=purchases.map(p=>'<tr><td>'+p.date+'</td><td>'+p.metal+'</td><td>'+p.purity+'</td><td>'+fmt(p.rate)+'</td><td>'+Number(p.grams).toFixed(3)+' g</td><td>'+fmt(p.budget)+'</td><td><button class="text-button" data-remove-metal="'+p.id+'">Remove</button></td></tr>').join('');$('metalPurchaseEmpty')?.classList.toggle('show',!purchases.length);if($('metalHoldingTotal'))$('metalHoldingTotal').textContent='Gold '+purchases.filter(p=>p.metal==='Gold').reduce((s,p)=>s+num(p.grams),0).toFixed(3)+' g · Silver '+purchases.filter(p=>p.metal==='Silver').reduce((s,p)=>s+num(p.grams),0).toFixed(3)+' g'}
function savePurchase(){const budget=num($('investBudget')?.value),rate=num($('investRate')?.value),gst=num($('investGst')?.value),metal=$('investMetal')?.value||'gold',purity=metal==='silver'?'999':($('investPurity')?.value||'22')+'K',grams=budget/(rate*(1+gst/100));if(!budget||!rate||!grams){if($('metalPurchaseFeedback'))$('metalPurchaseFeedback').textContent='Enter a valid budget and rate first.';return}purchases.unshift({id:Date.now().toString(36),date:new Date().toLocaleDateString('en-CA'),metal:metal==='gold'?'Gold':'Silver',purity,rate,grams,budget});try{localStorage.setItem('mmMetalPurchases.v1',JSON.stringify(purchases))}catch{}renderPurchases();if($('metalPurchaseFeedback'))$('metalPurchaseFeedback').textContent='Purchase saved on this device.'}
function calculateJewellery(){const rate=num($('jewelRate')?.value),grams=num($('jewelGrams')?.value),wastage=num($('jewelWastage')?.value),making=num($('jewelMaking')?.value),discount=num($('jewelDiscount')?.value),gst=num($('jewelGst')?.value),type=$('jewelMakingType')?.value||'gram',metal=rate*grams,waste=metal*wastage/100,makingCost=type==='gram'?making*grams:metal*making/100,subtotal=metal+waste+makingCost,discountValue=subtotal*discount/100,taxable=Math.max(0,subtotal-discountValue),tax=taxable*gst/100,total=taxable+tax,lines=[['Metal value',metal],['Wastage',waste],['Making charges',makingCost],['Subtotal',subtotal],['Discount',-discountValue],['GST',tax],['Final estimate',total]];if($('jewelBreakdown'))$('jewelBreakdown').innerHTML=lines.map((x,i)=>'<div class="calc-line '+(i===6?'total':'')+'"><span>'+x[0]+'</span><b>'+fmt(x[1])+'</b></div>').join('');if($('jewelTotal'))$('jewelTotal').textContent=fmt(total)}
$('refreshMarket')?.addEventListener('click',refreshRates);$('saveMetalPurchase')?.addEventListener('click',savePurchase);$('metalPurchaseTable')?.addEventListener('click',e=>{const b=e.target.closest('[data-remove-metal]');if(b){purchases=purchases.filter(p=>p.id!==b.dataset.removeMetal);try{localStorage.setItem('mmMetalPurchases.v1',JSON.stringify(purchases))}catch{}renderPurchases()}});
['investMetal','investPurity'].forEach(id=>$(id)?.addEventListener('change',()=>{if($('investRate'))delete $('investRate').dataset.userEdited;syncRates();calculateInvestment()}));['jewelMetal','jewelPurity'].forEach(id=>$(id)?.addEventListener('change',()=>{if($('jewelRate'))delete $('jewelRate').dataset.userEdited;syncRates();calculateJewellery()}));['investBudget','investRate','investGst'].forEach(id=>$(id)?.addEventListener('input',()=>{if(id==='investRate')$('investRate').dataset.userEdited='1';calculateInvestment()}));['jewelRate','jewelGrams','jewelWastage','jewelMaking','jewelDiscount','jewelGst','jewelMakingType'].forEach(id=>$(id)?.addEventListener('input',()=>{if(id==='jewelRate')$('jewelRate').dataset.userEdited='1';calculateJewellery()}));
renderPurchases();syncRates();calculateInvestment();calculateJewellery();draw();refreshRates();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshRates()});window.addEventListener('online',refreshRates);setInterval(()=>{if(!document.hidden)refreshRates()},10*60*1000);
})();