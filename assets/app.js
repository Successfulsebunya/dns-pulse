'use strict';const $=id=>document.getElementById(id);let data=[],config={},lineChart=null,pieChart=null;const cutoff=()=>Date.now()-86400000;const timestamp=s=>new Date(s).getTime();const time=s=>new Date(s).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});const write=(id,text)=>$(id).textContent=text;const empty=(id,text)=>{$(id).textContent=text;$(id).className='empty'};function render(){const d=$('domain').value;const samples=data.filter(s=>s.domain===d&&timestamp(s.at)>=cutoff()).sort((a,b)=>timestamp(a.at)-timestamp(b.at));const latest=samples.at(-1);const successes=samples.filter(s=>s.up).length;write('lastCheck',latest?time(latest.at):'Not yet measured');write('uptime',samples.length?(100*successes/samples.length).toFixed(1)+'%':'—');write('uptimeDetail',successes+' successful / '+samples.length+' checks');const lat=samples.filter(s=>typeof s.latency_ms==='number').map(s=>s.latency_ms);write('latency',lat.length?(lat.reduce((a,b)=>a+b,0)/lat.length).toFixed(0)+' ms':'—');write('health',latest?(latest.up?'Healthy':'DNS failure'):'No data');$('health').className=latest?(latest.up?'good':'bad'):'';write('healthDetail',latest?latest.resolver+' · '+time(latest.at):'Waiting for monitoring');const events=[];const prev=new Map;for(const s of samples){const p=prev.get(s.resolver);if(p){if(p.up!==s.up)events.push({at:s.at,text:s.resolver+': '+(s.up?'DNS recovered':'DNS failed')});for(const type of ['A','AAAA','MX','NS'])if(JSON.stringify(p.records?.[type]||[])!==JSON.stringify(s.records?.[type]||[]))events.push({at:s.at,text:s.resolver+': '+type+' record changed'});}prev.set(s.resolver,s)}write('changes',events.filter(e=>e.text.includes('record changed')).length);const resolvers=Object.keys(config.resolvers||{}),times=[...new Set(samples.map(s=>s.at))];if(lineChart)lineChart.destroy();lineChart=new Chart($('responseChart'),{type:'line',data:{labels:times.map(time),datasets:resolvers.map((r,i)=>({label:r,data:times.map(t=>samples.find(s=>s.at===t&&s.resolver===r)?.latency_ms??null),borderColor:['#46dbad','#68aaff','#ffbc69'][i%3],backgroundColor:['#46dbad','#68aaff','#ffbc69'][i%3],pointRadius:times.length>30?0:3,borderWidth:2,tension:.2}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#c1d5e5'}}},scales:{x:{ticks:{color:'#91adc2',maxTicksLimit:7},grid:{color:'#24384b'}},y:{beginAtZero:true,ticks:{color:'#91adc2'},grid:{color:'#24384b'}}}}});if(pieChart)pieChart.destroy();pieChart=new Chart($('availabilityChart'),{type:'doughnut',data:{labels:['Successful','Failed'],datasets:[{data:samples.length?[successes,samples.length-successes]:[0,0],backgroundColor:samples.length?['#46dbad','#fa7d90']:['#24384b','#24384b'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{position:'bottom',labels:{color:'#c1d5e5'}}}}});const current=samples.filter(s=>s.resolver===resolvers[0]).at(-1)||latest;write('recordResolver',current?.resolver||'No measurements');$('recordRows').replaceChildren();if(!current)empty('recordRows','Records appear after the first measurement');else for(const t of ['A','AAAA','MX','NS']){const row=document.createElement('div'),tag=document.createElement('span'),val=document.createElement('span');row.className='record-row';tag.className='record-type';tag.textContent=t;val.className='record-values';val.textContent=(current.records?.[t]||[]).join(' · ')||'None returned';row.append(tag,val);$('recordRows').append(row)}$('eventRows').replaceChildren();if(!events.length)empty('eventRows','No changes or incidents in this time window');else for(const e of events.slice(-7).reverse()){const row=document.createElement('div'),label=document.createElement('small');row.className='event-row';row.textContent=e.text;label.textContent=time(e.at);row.append(label);$('eventRows').append(row)}write('notice',samples.length?samples.length+' resolver checks in the last 24 hours.':'Enter a domain above to collect real DNS measurements.')}
// Tokens carry a random session identifier and domain settings, never measurements.
const SESSION_KEY='dns-pulse-session-v1', TYPES={A:1,AAAA:28,MX:15,NS:2};
let session=null,busy=false,generation=0;
function normalizeDomain(value){
  const domain=value.trim().toLowerCase().replace(/\.$/,'');
  if(!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain))throw Error('Enter a domain such as example.com, without a URL or path.');
  return domain;
}
function freshSession(){return {v:1,id:crypto.randomUUID(),domains:[],selected:'',samples:[]};}
function tokenFor(s){return btoa(JSON.stringify({v:1,id:s.id,domains:s.domains})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function parseToken(value){
  let token=value.trim();
  if(token.startsWith('https://')||token.startsWith('http://'))token=new URL(token).searchParams.get('session')||'';
  if(token.length>10000||!/^[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid session token.');
  let payload;try{payload=JSON.parse(atob(token.replace(/-/g,'+').replace(/_/g,'/')));}catch{throw Error('Invalid session token.');}
  if(payload.v!==1||typeof payload.id!=='string'||!/^[0-9a-f-]{36}$/.test(payload.id)||!Array.isArray(payload.domains)||payload.domains.length>20)throw Error('Invalid session token.');
  return {v:1,id:payload.id,domains:[...new Set(payload.domains.map(d=>normalizeDomain(String(d))))],selected:'',samples:[]};
}
function message(text){write('sessionMessage',text);}
function persist(){
  const since=cutoff();session.samples=session.samples.filter(s=>timestamp(s.at)>=since).slice(-12000);
  try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch{message('Browser storage is unavailable; keep this tab open to retain your measurements.');}
  const url=new URL(location.href);url.searchParams.set('session',tokenFor(session));history.replaceState(null,'',url);
}
function displaySession(){
  data=session.samples;config.domains=session.domains;
  const select=$('domain');select.replaceChildren();
  for(const domain of session.domains){const option=document.createElement('option');option.value=domain;option.textContent=domain;select.add(option);}
  if(session.domains.includes(session.selected))select.value=session.selected;
  session.selected=select.value;
  write('generated',data.length?'Latest measurement '+time(data.at(-1).at):'No measurements yet');
  $('recordRows').className='';$('eventRows').className='';render();
}
async function queryDNS(endpoint,domain,type){
  const started=performance.now();
  try{
    const url=new URL(endpoint);url.searchParams.set('name',domain);url.searchParams.set('type',type);
    const response=await fetch(url,{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(12000),cache:'no-store'});
    if(!response.ok)throw Error('Resolver returned HTTP '+response.status);
    const result=await response.json();
    if(typeof result.Status!=='number')throw Error('Invalid resolver response');
    return {ok:result.Status===0,ms:Math.round((performance.now()-started)*10)/10,answers:(result.Answer||[]).filter(a=>a.type===TYPES[type]).map(a=>String(a.data)).sort()};
  }catch(error){return {ok:false,ms:null,answers:[],error:error.message};}
}
async function checkDomains(domains=session.domains){
  if(busy||!domains.length)return;
  busy=true;const currentGeneration=generation;const target=session;
  $('checkDomain').disabled=true;$('refresh').disabled=true;message('Collecting real DNS measurements…');
  try{
    const at=new Date().toISOString();
    const samples=await Promise.all(domains.flatMap(domain=>Object.entries(config.resolvers).map(async([resolver,endpoint])=>{
      const checks=Object.fromEntries(await Promise.all(Object.keys(TYPES).map(async type=>[type,await queryDNS(endpoint,domain,type)])));
      return {at,domain,resolver,up:['A','AAAA'].some(t=>checks[t].ok&&checks[t].answers.length>0),latency_ms:checks.A.ms,records:Object.fromEntries(Object.keys(TYPES).map(t=>[t,checks[t].answers])),errors:Object.fromEntries(Object.entries(checks).filter(([,c])=>c.error).map(([t,c])=>[t,c.error]))};
    })));
    if(currentGeneration!==generation)return;
    target.samples.push(...samples);persist();displaySession();
    const failures=samples.filter(s=>Object.keys(s.errors).length);
    message('Session '+session.id+' · '+(failures.length?'Some resolver requests failed. Network or browser restrictions can affect checks.':'Checks completed. Share your link or token to share these domains.'));
  }finally{busy=false;$('checkDomain').disabled=false;$('refresh').disabled=false;}
}
async function join(value){
  try{const next=parseToken(value);generation++;session=next;persist();displaySession();message('Joined session '+session.id+'. Collecting fresh measurements in this browser.');await checkDomains();}
  catch(error){message(error.message);}
}
async function copy(text,label){
  try{await navigator.clipboard.writeText(text);message(label+' copied. It shares domain settings, not measurement history.');}
  catch{ $('sessionToken').value=text;message('Copy the '+label.toLowerCase()+' from the join field.');}
}
$('domainForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  try{const domain=normalizeDomain($('domainInput').value);if(!session.domains.includes(domain)){if(session.domains.length>=20)throw Error('A session supports up to 20 domains. Start a new session to check more.');session.domains.push(domain);}
    session.selected=domain;persist();displaySession();await checkDomains([domain]);
  }catch(error){message(error.message);}
});
$('joinForm').addEventListener('submit',event=>{event.preventDefault();if(busy){message('Wait for the current checks to finish, then join the session.');return;}join($('sessionToken').value);});
$('newSession').addEventListener('click',()=>{generation++;session=freshSession();$('domainInput').value='';$('sessionToken').value='';persist();displaySession();message('New session '+session.id+'. Enter a domain to begin.');});
$('shareSession').addEventListener('click',()=>{const url=new URL(location.href);url.hash='';url.searchParams.set('session',tokenFor(session));copy(url.href,'Session link');});
$('copyToken').addEventListener('click',()=>copy(tokenFor(session),'Session token'));
$('domain').addEventListener('change',()=>{session.selected=$('domain').value;persist();displaySession();});
$('refresh').addEventListener('click',()=>checkDomains());
async function initialize(){
  try{
    const response=await fetch('config.json');if(!response.ok)throw Error('Could not load DNS resolver configuration.');config=await response.json();
    const shared=new URL(location.href).searchParams.get('session');let saved=null;
    try{saved=JSON.parse(sessionStorage.getItem(SESSION_KEY));}catch{}
    let tokenError='';
    if(shared){try{const incoming=parseToken(shared);session=saved&&saved.id===incoming.id&&Array.isArray(saved.samples)&&JSON.stringify(saved.domains)===JSON.stringify(incoming.domains)?saved:incoming;}catch(error){session=freshSession();tokenError=error.message+' Started a new session. ';}}
    else session=freshSession();
    persist();displaySession();message(tokenError+'Session '+session.id+'. Enter a domain or share your session token.');
    if(session.domains.length)await checkDomains();
    setInterval(()=>{if(!document.hidden)checkDomains();},300000);
  }catch(error){message(error.message);}
}
initialize();
