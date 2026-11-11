'use strict';
const FURS=['#B8743C','#9C6436','#C98B4E','#7E5A3C','#D2A06A','#8E7A66','#A85A3A','#6F6A60'];
const HATS=[['none','Без шапки'],['hardhat','Каска'],['cap','Кепка'],['beret','Берет']];
const HAT_KEYS=HATS.map(h=>h[0]);
const TOOLS_OK=['typing','pointer','chart','abacus','scroll','magnifier','letters'];
const STATE={working:'Работает',waiting:'Ждёт',resting:'Отдыхает'};
const TABS=[['office','Кабинет'],['chat','Чат'],['progress','Ход работы'],['questions','Вопросы'],['results','Результаты'],['team','Команда'],['spend','Расход'],['log','Журнал']];
const TASK_ST={pending:['resting','В очереди'],'in-progress':['working','В работе'],review:['waiting','На проверке'],repair:['waiting','На доработке'],done:['working','Готово'],failed:['waiting','Не получилось']};
const CLS={light:'лёгкая',work:'рабочая',strong:'сильная',expensive:'дорогая'};
const PER_ROW=6,PER_ROOM=18,ROWH=290,MAX_IMG=300*1024,NARROW=matchMedia('(max-width:640px)');

const S={page:'projects',slug:null,tab:'office',projects:null,project:null,roles:null,access:null,raw:{},
 drawerId:null,room:0,linkOpen:false,connOpen:false,roleCat:'all',charsSlug:null,back:null,busy:false,offline:false,lastInbox:-1,loginErr:''};

const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('ru-RU');
function plural(n,f){n=Math.abs(n)%100;const d=n%10;if(n>10&&n<20)return f[2];if(d>1&&d<5)return f[1];if(d===1)return f[0];return f[2]}
const tok=n=>`${fmt(n)} ${plural(Number(n||0),['токен','токена','токенов'])}`;
const fur=c=>/^#[0-9a-fA-F]{6}$/.test(c||'')?c:FURS[0];
const hat=h=>HAT_KEYS.includes(h)?h:'none';
const tool=t=>TOOLS_OK.includes(t)?t:'typing';
const st=s=>STATE[s]?s:'resting';
const img=u=>typeof u==='string'&&/^data:image\/(png|gif|webp|svg\+xml|jpeg);base64,[A-Za-z0-9+/=]+$/.test(u)?u:null;
const cut=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s};
const hm=s=>{s=String(s||'');const m=s.match(/T(\d{2}:\d{2})/);return m?m[1]:s};
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=(h*33+s.charCodeAt(i))|0;return (h>>>0).toString(36)}

function shade(hex,k){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=c=>Math.round(k<0?c*(1+k):c+(255-c)*k);return '#'+[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,'0')).join('')}

function chip(m,opt={}){
 const f=fur(m.fur),d=shade(f,-.42),t=shade(f,-.2),o='#2B1A10';
 const sw=`stroke="${o}" stroke-width="2.4" stroke-linejoin="round"`;
 const tl=tool(opt.tool||m.tool),s=st(opt.state||m.state),pic=img(m.img);
 const delay=(String(m.id||m.name||'x').charCodeAt(0)%7)*0.6;
 const label=esc(`${m.name||''}${m.role?', '+m.role:''}: ${STATE[s].toLowerCase()}`);
 const eyes=s==='resting'
  ?`<path d="M47 51 Q51 54.5 55 51" fill="none" stroke="${o}" stroke-width="2.4" stroke-linecap="round"/><path d="M65 51 Q69 54.5 73 51" fill="none" stroke="${o}" stroke-width="2.4" stroke-linecap="round"/>`
  :`<circle cx="51" cy="50" r="3.6" fill="${o}"/><circle cx="69" cy="50" r="3.6" fill="${o}"/><circle cx="52.2" cy="48.8" r="1.2" fill="#fff"/><circle cx="70.2" cy="48.8" r="1.2" fill="#fff"/>`;
 const hats={none:'',
  hardhat:`<path d="M37 37 Q38 13 60 13 Q82 13 83 37 Z" fill="#F2C230" ${sw}/><rect x="33" y="34" width="54" height="6" rx="3" fill="#E0AE1C" ${sw}/><path d="M60 14 V34" stroke="#C9970F" stroke-width="3"/>`,
  cap:`<path d="M39 35 Q40 16 60 16 Q80 16 81 35 Z" fill="#3E6FA8" ${sw}/><path d="M78 33 Q92 31 96 36 Q86 39 76 37 Z" fill="#335E91" ${sw}/>`,
  beret:`<ellipse cx="58" cy="28" rx="24" ry="8.5" fill="#8B2F3C" ${sw}/><circle cx="58" cy="19.5" r="2.6" fill="#8B2F3C" stroke="${o}" stroke-width="2"/>`};
 let tl2='',armPath='M77 79 Q86 72 93 63',hand=[93,63],leftArm=`<ellipse cx="41" cy="88" rx="5.5" ry="10" fill="${f}" ${sw} transform="rotate(15 41 88)"/>`;
 switch(tl){
  case 'typing':
   armPath='M77 80 Q83 92 76 101';hand=[76,101];
   leftArm=`<g class="armL"><path d="M43 80 Q37 92 44 101" fill="none" stroke="${o}" stroke-width="11.5" stroke-linecap="round"/><path d="M43 80 Q37 92 44 101" fill="none" stroke="${f}" stroke-width="7" stroke-linecap="round"/><circle cx="44" cy="101" r="4.6" fill="${d}" stroke="${o}" stroke-width="2"/></g>`;break;
  case 'letters':
   tl2=`<g class="carry"><rect x="85" y="47" width="26" height="17" rx="2" fill="#FBF7EE" ${sw}/><path d="M85 47 L98 57 L111 47" fill="none" stroke="${o}" stroke-width="1.6"/><rect x="88" y="41" width="26" height="17" rx="2" fill="#FFFDF7" ${sw}/><path d="M88 41 L101 51 L114 41" fill="none" stroke="${o}" stroke-width="1.6"/></g>`;break;
  case 'magnifier':
   tl2=`<line x1="93" y1="63" x2="101" y2="53" stroke="#7A4E2A" stroke-width="4" stroke-linecap="round"/><circle cx="107" cy="45" r="9.5" fill="#CFE6F2" fill-opacity=".75" stroke="${o}" stroke-width="3"/><path d="M103 41 Q105 39 108 39" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;break;
  case 'chart':
   tl2=`<rect x="92" y="44" width="25" height="31" rx="3" fill="#F7F3EA" ${sw}/><rect x="98.5" y="41" width="12" height="5" rx="2" fill="#7A8B99" stroke="${o}" stroke-width="1.6"/><rect class="bar" x="96" y="62" width="4" height="9" fill="#2B8556"/><rect class="bar b2" x="102" y="56" width="4" height="15" fill="#C77C14"/><rect class="bar b3" x="108" y="52" width="4" height="19" fill="#3E6FA8"/>`;break;
  case 'abacus':
   tl2=`<rect x="89" y="44" width="30" height="26" rx="3" fill="#E9D7B5" ${sw}/><g stroke="#7A4E2A" stroke-width="1.5"><line x1="91" y1="51" x2="117" y2="51"/><line x1="91" y1="57" x2="117" y2="57"/><line x1="91" y1="63" x2="117" y2="63"/></g><g fill="#A8382F"><circle class="bead" cx="95" cy="51" r="2.6"/><circle cx="100" cy="51" r="2.6"/><circle cx="95" cy="57" r="2.6"/><circle class="bead" cx="100" cy="63" r="2.6"/><circle cx="95" cy="63" r="2.6"/></g>`;break;
  case 'scroll':
   tl2=`<rect x="92" y="46" width="23" height="28" fill="#F4E6C4" ${sw}/><rect x="90" y="42" width="27" height="6" rx="3" fill="#D9C08C" ${sw}/><rect x="90" y="72" width="27" height="6" rx="3" fill="#D9C08C" ${sw}/><g stroke="#A08C66" stroke-width="1.4"><line x1="96" y1="54" x2="111" y2="54"/><line x1="96" y1="59" x2="111" y2="59"/><line x1="96" y1="64" x2="106" y2="64"/></g>`;break;
  case 'pointer':
   tl2=`<line x1="93" y1="63" x2="115" y2="31" stroke="#6B4A2B" stroke-width="3.2" stroke-linecap="round"/><path d="M115 31 L129 35 L116 41 Z" fill="var(--accent)" stroke="${o}" stroke-width="2"/>`;break;
 }
 const fnt='font-family="Golos Text,system-ui,sans-serif"';
 const extra=s==='waiting'
  ?`<g class="qmark"><circle cx="100" cy="18" r="11" fill="var(--wait)" stroke="${o}" stroke-width="2"/><text x="100" y="23.5" font-size="15" font-weight="700" text-anchor="middle" fill="#fff" ${fnt}>?</text></g>`
  :s==='resting'?`<text class="zz" x="84" y="30" font-size="13" font-weight="700" fill="var(--rest)" ${fnt}>z</text><text class="zz z2" x="92" y="22" font-size="10" font-weight="700" fill="var(--rest)" ${fnt}>z</text>`:'';
 const walk=opt.walk?' walking':'';
 if(pic) return `<svg class="chip custom st-${s}${walk}" viewBox="0 0 140 130" style="--d:${delay}s" ${opt.attrs||''} role="img" aria-label="${label}"><g class="bodyg"><image href="${esc(pic)}" x="10" y="14" width="120" height="112" preserveAspectRatio="xMidYMax meet"/>${tl==='letters'?'<g transform="translate(-4 30)">'+tl2+'</g>':''}</g>${extra}</svg>`;
 return `<svg class="chip tool-${tl} st-${s}${walk}" viewBox="0 0 140 130" style="--d:${delay}s" ${opt.attrs||''} role="img" aria-label="${label}">
 <g class="bodyg">
  <g class="tail"><path d="M40 100 C12 98 6 64 20 46 C28 36 42 40 36 54 C30 68 32 84 46 92 Z" fill="${t}" ${sw}/>
  <path d="M24 52 C20 62 22 78 32 88" fill="none" stroke="${d}" stroke-width="2.4" stroke-linecap="round"/></g>
  <g class="legL"><ellipse cx="48" cy="115" rx="9" ry="4.2" fill="${d}" ${sw}/></g><g class="legR"><ellipse cx="72" cy="115" rx="9" ry="4.2" fill="${d}" ${sw}/></g>
  <ellipse cx="60" cy="89" rx="27" ry="26" fill="${f}" ${sw}/>
  <ellipse cx="60" cy="94" rx="15.5" ry="17" fill="#F2DDB8"/>
  <path d="M42 74 Q37 89 44 103" fill="none" stroke="${d}" stroke-width="3" stroke-linecap="round"/>
  <path d="M78 74 Q83 89 76 103" fill="none" stroke="${d}" stroke-width="3" stroke-linecap="round"/>
  ${leftArm}
  <g class="head">
   <circle cx="42" cy="31" r="7.5" fill="${f}" ${sw}/><circle cx="42" cy="31" r="3.4" fill="#E9A99A"/>
   <circle cx="78" cy="31" r="7.5" fill="${f}" ${sw}/><circle cx="78" cy="31" r="3.4" fill="#E9A99A"/>
   <circle cx="60" cy="50" r="24" fill="${f}" ${sw}/>
   <path d="M60 27 V40 M52.5 29 L54.5 39 M67.5 29 L65.5 39" stroke="${d}" stroke-width="3.2" stroke-linecap="round"/>
   <path d="M44 45 Q51 41 57 45 M63 45 Q69 41 76 45" fill="none" stroke="${d}" stroke-width="2.4" stroke-linecap="round"/>
   <ellipse cx="45.5" cy="59" rx="8" ry="6" fill="#EBC79A"/><ellipse cx="74.5" cy="59" rx="8" ry="6" fill="#EBC79A"/>
   <g class="eyes">${eyes}</g>
   <ellipse cx="60" cy="57" rx="3.2" ry="2.3" fill="${o}"/>
   <path d="M56.5 61 Q60 64.5 63.5 61" fill="none" stroke="${o}" stroke-width="2" stroke-linecap="round"/>
   ${hats[hat(m.hat)]}
  </g>
 </g>
 <g class="arm">
  <path d="${armPath}" fill="none" stroke="${o}" stroke-width="11.5" stroke-linecap="round"/>
  <path d="${armPath}" fill="none" stroke="${f}" stroke-width="7" stroke-linecap="round"/>
  ${tl2}
  <circle cx="${hand[0]}" cy="${hand[1]}" r="4.6" fill="${d}" stroke="${o}" stroke-width="2"/>
 </g>
 ${extra}
</svg>`;
}

const pill=s=>`<span class="pill ${st(s)}">${STATE[st(s)]}</span>`;
const mini=m=>`<span class="av">${chip(m)}</span>`;
const KIND_LABEL={xlsx:'XLSX',docx:'DOCX',pdf:'PDF',task:'—'};
const ficon=k=>{k=String(k||'');const c=/^[a-z0-9]{1,6}$/.test(k)?k:'file';return `<span class="ficon ${c}">${esc(KIND_LABEL[c]||c.toUpperCase().slice(0,4))}</span>`};
const fileList=(arr,empty)=>arr&&arr.length?`<ul class="files">${arr.map(([k,n,m])=>`<li>${ficon(k)}<span><span class="fn">${esc(n)}</span>${m?`<br><span class="fm">${esc(m)}</span>`:''}</span></li>`).join('')}</ul>`:`<p class="hint">${empty}</p>`;
function size(b){b=Number(b||0);if(b<1024)return `${fmt(b)} байт`;if(b<1048576)return `${(b/1024).toLocaleString('ru-RU',{maximumFractionDigits:1})} КБ`;return `${(b/1048576).toLocaleString('ru-RU',{maximumFractionDigits:1})} МБ`}

/* ---------- данные ---------- */
const P=()=>S.project||{};
const team=()=>Array.isArray(P().team)?P().team:[];
const by=id=>team().find(m=>m.id===id);
const lead=()=>team().find(m=>m.role==='Оркестратор')||team()[0]||null;
const isLead=m=>{const l=lead();return !!(l&&m&&l.id===m.id)};
const leadName=()=>(lead()||{}).name||'Бригадир';
function openQs(){
 const out=[],seen=new Set();
 team().forEach(m=>{if(m.question&&m.question.id!=null&&!seen.has(String(m.question.id))){out.push({id:m.question.id,q:m.question.q,opts:m.question.opts||[],m});seen.add(String(m.question.id))}});
 (P().questions||[]).forEach(q=>{if(q.status==='waiting'&&q.id!=null&&!seen.has(String(q.id))){out.push({id:q.id,q:q.q,opts:q.opts||[],m:lead()});seen.add(String(q.id))}});
 return out;
}

class AuthError extends Error{}
async function api(path,body){
 const opt={credentials:'same-origin',headers:{}};
 if(body!==undefined){opt.method='POST';opt.headers['Content-Type']='application/json';if(S.access&&S.access.csrf)opt.headers['X-Chekan-CSRF']=S.access.csrf;opt.body=JSON.stringify(body)}
 let r;
 try{r=await fetch(path,opt)}catch(e){throw new Error('Нет связи с Чеканом. Проверьте, что компьютер с Чеканом включён.')}
 const text=await r.text();let json=null;
 try{json=text?JSON.parse(text):{}}catch(e){json=null}
 if(r.status===401&&path!=='/api/login'){needLogin();throw new AuthError('Нужен вход')}
 if(!r.ok){const err=new Error((json&&json.error)||'Что-то пошло не так. Попробуйте ещё раз.');err.status=r.status;err.data=json;throw err}
 if(json===null)throw new Error('Чекан ответил непонятно. Обновите страницу.');
 return {text,json};
}
async function loadAccess(){
 try{const {json}=await api('/api/access');S.access=json;if(json.signed_in===false&&!json.host){needLogin();return false}}
 catch(e){if(!(e instanceof AuthError))S.access=null}
 renderConn();return true;
}
async function fetchInto(key,path){
 const {text,json}=await api(path);
 const same=S.raw[key]===text;S.raw[key]=text;
 return {json,same};
}
async function loadPage(force){
 const pg=S.page;
 try{
  let changed=!!force;
  if(pg==='projects'||pg==='chars'){const r=await fetchInto('projects','/api/projects');S.projects=r.json.projects||[];changed=changed||!r.same}
  if(pg==='project'||pg==='chars'){
   const slug=pg==='chars'?charsSlug():S.slug;
   if(slug){const r=await fetchInto('p:'+slug,'/api/p/'+encodeURIComponent(slug));S.project=r.json;changed=changed||!r.same}
  }
  if(pg==='roles'&&(!S.roles||force)){const r=await fetchInto('roles','/api/roles');S.roles=r.json;changed=true}
  S.offline=false;
  if(changed&&S.page===pg)render();
 }catch(e){
  if(e instanceof AuthError)return;
  if(!S.offline||force)toast(e.message,true);
  S.offline=!e.status;
  if(e.status===404&&pg==='project'){S.project={title:'Проект не найден',team:[],missing:true};render()}
 }
}
function charsSlug(){
 const ps=S.projects||[];
 if(S.charsSlug&&ps.some(p=>p.slug===S.charsSlug))return S.charsSlug;
 const own=ps.find(p=>!p.classic);return own?own.slug:null;
}

/* ---------- маршруты ---------- */
function parse(){
 const p=location.pathname.replace(/\/+$/,'')||'/';
 const m=p.match(/^\/p\/([^/]+)$/);
 if(m){S.page='project';const slug=decodeURIComponent(m[1]);if(slug!==S.slug){S.room=0;S.linkOpen=false;S.lastInbox=-1}if(S.project&&S.project.slug!==slug)S.project=null;S.slug=slug;const h=location.hash.slice(1);S.tab=TABS.some(t=>t[0]===h)?h:'office';return}
 S.page={'/':'projects','/roles':'roles','/chars':'chars','/prefs':'prefs','/login':'login'}[p]||'projects';
}
function go(url){history.pushState(null,'',url);route()}
function route(){
 parse();closeDrawer();S.path=location.pathname;
 if(S.page==='login'){render();return}
 render(true);
 window.scrollTo(0,0);
 loadPage(true);
}
function needLogin(){
 if(S.page==='login')return;
 S.back=location.pathname+location.hash;
 history.replaceState(null,'','/login');S.page='login';S.path='/login';closeDrawer();render(true);
}

/* ---------- сцена «Кабинет» ---------- */
function cloudSvg(cx,y,text){
 text=cut(text,22);
 const w=Math.min(190,Math.round(text.length*7.6+28));
 return `<g><rect x="${cx-w/2}" y="${y}" width="${w}" height="28" rx="14" fill="var(--cloud)" stroke="var(--cloud-line)" stroke-width="1.5"/><circle cx="${cx-6}" cy="${y+35}" r="4" fill="var(--cloud)" stroke="var(--cloud-line)" stroke-width="1.5"/><circle cx="${cx-2}" cy="${y+43}" r="2.4" fill="var(--cloud)" stroke="var(--cloud-line)" stroke-width="1.5"/><text x="${cx}" y="${y+19}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--fg)">${esc(text)}</text></g>`;
}
function plate(cx,y,m){
 const s=st(m.state),c={working:'var(--work)',waiting:'var(--wait)',resting:'var(--rest)'}[s];
 return `<text x="${cx}" y="${y}" text-anchor="middle" font-size="15" font-weight="600" fill="var(--desk-ink)">${esc(cut(m.name,16))}</text><circle cx="${cx-34}" cy="${y+17}" r="4.5" fill="${c}"/><text x="${cx-25}" y="${y+21}" font-size="12.5" fill="var(--desk-ink)" opacity=".9">${STATE[s]}</text>`;
}
function screen(m,x,y){
 const W=58,H=37,s=st(m.state),work=s==='working';
 let inner='',bg='#EAF2EE';
 if(s==='resting'){bg='#1C2433';inner=`<circle cx="${x+29}" cy="${y+18}" r="9" fill="#E9E2C8"/><circle cx="${x+33}" cy="${y+15}" r="8" fill="#1C2433"/>`}
 else switch(tool(m.tool)){
  case 'pointer':{const others=team().filter(o=>o.id!==m.id).slice(0,6);inner=others.map((o,i)=>`<rect x="${x+5+(i%3)*18}" y="${y+5+Math.floor(i/3)*16}" width="14" height="12" rx="2" fill="var(--${{working:'work',waiting:'wait',resting:'rest'}[st(o.state)]})"/>`).join('');break}
  case 'chart':inner=`<rect class="scr-bar" x="${x+8}" y="${y+18}" width="8" height="15" fill="#2B8556"/><rect class="scr-bar b2" x="${x+20}" y="${y+10}" width="8" height="23" fill="#C77C14"/><rect class="scr-bar b3" x="${x+32}" y="${y+6}" width="8" height="27" fill="#3E6FA8"/><rect class="scr-bar" x="${x+44}" y="${y+14}" width="8" height="19" fill="#2B8556"/>`;break;
  case 'abacus':inner=[0,1,2,3].map(i=>`<rect x="${x+5}" y="${y+5+i*8}" width="30" height="4" fill="#9AA8A0"/><rect x="${x+38}" y="${y+5+i*8}" width="14" height="4" fill="#5C6A61"/>`).join('');break;
  case 'magnifier':inner=`<rect x="${x+16}" y="${y+9}" width="26" height="18" rx="2" fill="none" stroke="#7A8B99" stroke-width="2"/><path d="M${x+16} ${y+9} L${x+29} ${y+19} L${x+42} ${y+9}" fill="none" stroke="#7A8B99" stroke-width="2"/>`;break;
  case 'scroll':inner=[0,1,2,3,4].map(i=>`<rect x="${x+8}" y="${y+5+i*6}" width="${[42,40,42,36,24][i]}" height="2.5" fill="#A08C66"/>`).join('');break;
  default:inner=[0,1,2,3].map(i=>`<rect x="${x+6}" y="${y+6+i*7}" width="${[44,38,46,22][i]}" height="3" fill="#7A8B99"/>`).join('')+(work?`<rect class="cursor" x="${x+30}" y="${y+26}" width="2" height="7" fill="#1D2620"/>`:'');
 }
 if(s==='waiting')inner+=`<circle cx="${x+48}" cy="${y+28}" r="6" fill="var(--wait)"/>`;
 return `<rect x="${x-3}" y="${y-3}" width="${W+6}" height="${H+6}" rx="4" fill="#2D3640"/><rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${bg}"/>${inner}<rect x="${x+25}" y="${y+H+3}" width="8" height="12" fill="#55606A"/><rect x="${x+15}" y="${y+H+14}" width="28" height="4" rx="2" fill="#55606A"/>`;
}
function desk(cx,dy,m,cls,extra){
 const ch=chip(m,{attrs:`x="${cx-76}" y="${288+dy}" width="150" height="139"`,tool:'typing'});
 return `<g class="hit" data-open="${esc(m.id)}" tabindex="0" role="button" aria-label="Открыть карточку: ${esc(m.name)}">
  ${cloudSvg(cx-4,254+dy,m.spec||m.role||'')}
  <rect x="${cx-44}" y="${318+dy}" width="80" height="100" rx="16" fill="var(--chair)"/>
  <g${cls?` class="${cls}"`:''}>${ch}</g>
  <rect x="${cx-88}" y="${414+dy}" width="176" height="12" rx="3" fill="var(--desk)"/>
  <rect x="${cx-80}" y="${426+dy}" width="160" height="66" rx="3" fill="var(--desk2)"/>
  <rect x="${cx-78}" y="${492+dy}" width="10" height="22" fill="var(--desk2)"/><rect x="${cx+68}" y="${492+dy}" width="10" height="22" fill="var(--desk2)"/>
  ${screen(m,cx+30,357+dy)}
  <rect x="${cx-36}" y="${406+dy}" width="58" height="8" rx="2" fill="#C9CED3" stroke="#8C949B"/>
  ${extra||''}
  ${plate(cx,452+dy,m)}
 </g>`;
}
function rooms(){const t=team(),out=[];for(let i=0;i<t.length;i+=PER_ROOM)out.push(t.slice(i,i+PER_ROOM));return out.length?out:[[]]}
function whiteboard(){
 const stg=Array.isArray(P().stages)?P().stages:[];
 const per=Math.max(1,Math.ceil(stg.length/2)),gap=Math.min(32,Math.floor(124/per));
 return stg.map(([n,c],i)=>{const col=Math.floor(i/per),x=col?622:492,y=96+(i%per)*gap;
  const dot=c==='done'?`<circle cx="${x+8}" cy="${y-5}" r="9" fill="var(--work)"/><path d="M${x+3.5} ${y-5} l3 3 l5.5 -6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`
   :c==='current'?`<circle cx="${x+8}" cy="${y-5}" r="9" fill="var(--accent)"/><circle cx="${x+8}" cy="${y-5}" r="3" fill="var(--accent-ink)"/>`
   :`<circle cx="${x+8}" cy="${y-5}" r="8" fill="none" stroke="var(--trim)" stroke-width="2"/>`;
  return dot+`<text x="${x+24}" y="${y}" font-size="15" font-weight="${c==='current'?700:500}" fill="var(--ink)">${esc(cut(n,12))}</text>`}).join('');
}
function office(){
 const rs=rooms(),ri=Math.min(S.room,rs.length-1),members=rs[ri];
 const per=NARROW.matches?3:PER_ROW,rowsN=Math.max(1,Math.ceil(members.length/per)),H=580+(rowsN-1)*ROWH;
 const pos={};
 members.forEach((m,i)=>{const r=Math.floor(i/per),inRow=Math.min(per,members.length-r*per),c=i%per;pos[m.id]={cx:610-(inRow-1)*100+200*c,dy:r*ROWH}});
 const act=(P().chain||[]).find(c=>c.st==='active'&&c.from&&c.to&&c.from!==c.to&&pos[c.from]&&pos[c.to]);
 const planks=[];for(let y=412;y<H;y+=y<530?(y<446?34:y<486?40:44):48)planks.push(`<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="var(--wood2)" stroke-width="2"/>`);
 const desks=members.map(m=>{const p=pos[m.id];let cls='',extra='';
  if(act&&m.id===act.from)cls='away';
  if(act&&m.id===act.to){cls='sync';extra=`<g class="handstack"><rect x="${p.cx-76}" y="${402+p.dy}" width="30" height="12" rx="1.5" fill="#FBF7EE" stroke="#C9BFAE"/><path d="M${p.cx-76} ${402+p.dy} L${p.cx-61} ${410+p.dy} L${p.cx-46} ${402+p.dy}" fill="none" stroke="#C9BFAE"/><rect x="${p.cx-74}" y="${396+p.dy}" width="30" height="8" rx="1.5" fill="#FFFDF7" stroke="#C9BFAE"/></g>`}
  return desk(p.cx,p.dy,m,cls,extra)}).join('');
 let walker='';
 if(act){const a=pos[act.from],b=pos[act.to],m=by(act.from),sx=b.cx>=a.cx?1:-1;
  const vars=`--sx:${sx};--rx:${-sx};--x1:${30*sx}px;--y1:104px;--x2:${b.cx-a.cx-50*sx}px;--y2:${b.dy-a.dy+104}px`;
  walker=`<g class="hit" data-open="${esc(m.id)}" tabindex="-1" aria-hidden="true"><g class="walker" style="${vars}">${chip(m,{attrs:`x="${a.cx-76}" y="${288+a.dy}" width="150" height="139"`,tool:'letters',walk:true,state:'working'})}</g></g>`;
 }
 const clock=Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return `<line x1="${(990+26*Math.sin(a)).toFixed(1)}" y1="${(95-26*Math.cos(a)).toFixed(1)}" x2="${(990+30*Math.sin(a)).toFixed(1)}" y2="${(95-30*Math.cos(a)).toFixed(1)}" stroke="var(--ink)" stroke-width="2"/>`}).join('');
 const svg=`<svg class="office" viewBox="${NARROW.matches?'300 0 620':'0 0 1200'} ${H}" role="img" aria-label="Кабинет команды">
 <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset="1" stop-color="var(--sky2)"/></linearGradient></defs>
 <rect width="1200" height="380" fill="var(--wall)"/><rect y="324" width="1200" height="56" fill="var(--wall2)"/><rect y="320" width="1200" height="5" fill="var(--trim)"/>
 <rect y="380" width="1200" height="${H-380}" fill="var(--wood)"/>${planks.join('')}
 <rect x="36" y="36" width="178" height="156" rx="6" fill="var(--trim)"/><rect x="46" y="46" width="158" height="136" fill="url(#sky)"/>
 <path d="M80 92 q8 -14 22 -6 q12 -10 24 2 q12 0 10 12 h-60 q-6 -8 4 -8 Z" fill="#FFFFFF" opacity=".85"/>
 <rect x="122" y="46" width="6" height="136" fill="var(--trim)"/><rect x="46" y="112" width="158" height="6" fill="var(--trim)"/><rect x="28" y="190" width="194" height="10" rx="3" fill="var(--trim)"/>
 <rect x="470" y="34" width="276" height="176" rx="8" fill="var(--board)" stroke="var(--trim)" stroke-width="5"/>
 <text x="490" y="64" font-size="16" font-weight="700" fill="var(--ink)">План проекта</text>${whiteboard()}
 <circle cx="990" cy="95" r="34" fill="var(--board)" stroke="var(--trim)" stroke-width="5"/>${clock}
 <line x1="990" y1="95" x2="981" y2="79" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/><line x1="990" y1="95" x2="995.5" y2="70" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/><circle cx="990" cy="95" r="3" fill="var(--ink)"/>
 <rect x="1036" y="176" width="150" height="8" rx="2" fill="var(--trim)"/>
 <rect x="1044" y="134" width="16" height="42" fill="#2F5FA8"/><rect x="1062" y="140" width="16" height="36" fill="#B8743C"/><rect x="1080" y="130" width="16" height="46" fill="#2B8556"/><rect x="1110" y="146" width="40" height="30" rx="3" fill="#F2F2EE"/>
 ${desks}${walker}
</svg>`;
 let cap='';
 if(act){const a=by(act.from),b=by(act.to),w=esc(act.what||'работу');
  cap=`<div class="caption" aria-hidden="true"><span class="c1">Сейчас: <b>${esc(a.name)}</b> готовит «${w}»</span><span class="c2">Сейчас: <b>${esc(a.name)}</b> несёт «${w}» → <b>${esc(b.name)}</b></span><span class="c3">Сейчас: <b>${esc(b.name)}</b> получил «${w}» и берётся за работу</span></div>`}
 const html=`<div class="office-wrap">${svg}</div>${cap}`;
 return `<div data-keep="office" data-h="${hash(html)}" style="display:grid;gap:14px">${html}</div>`;
}
function roomSwitch(){
 const rs=rooms();if(rs.length<2)return '';
 const q=new Set(openQs().map(x=>x.m&&x.m.id));
 return `<div class="rooms" role="group" aria-label="Отделы">${rs.map((r,i)=>{const n=r.filter(m=>q.has(m.id)).length;return `<button class="btn" data-room="${i}" aria-pressed="${i===Math.min(S.room,rs.length-1)}">Отдел ${i+1} · ${r.length} ${plural(r.length,['участник','участника','участников'])}${n?`<span class="badge">${n}</span>`:''}</button>`}).join('')}</div>`;
}
function stagesList(){
 const stg=Array.isArray(P().stages)?P().stages:[];
 return `<ol class="stages" aria-label="Этапы">${stg.map(([n,c])=>`<li class="${c==='done'||c==='current'?c:''}"${c==='current'?' aria-current="step"':''}>${esc(n)}</li>`).join('')}</ol>`;
}
function askCard(q,i){
 const m=q.m||{name:leadName(),role:'Оркестратор'};
 const who=isLead(m)||!q.m?`Спрашивает ${esc(m.name)}`:`Спрашивает ${esc(m.name)} (${esc(String(m.role||'').toLowerCase())}) через Бригадира`;
 return `<section class="ask" aria-label="Вопрос к вам">
  <div class="who"><div class="mini">${chip(m)}</div><div><p class="q">${esc(q.q)}</p><p class="src">${who} · вопрос продублирован в чат Claude</p></div></div>
  <div class="opts">${(q.opts||[]).map(o=>`<button class="btn" data-qid="${esc(q.id)}" data-text="${esc(o)}">${esc(o)}</button>`).join('')}
   <form class="own" data-own="${esc(q.id)}"><input id="own-${i}" placeholder="Свой вариант" aria-label="Свой вариант" autocomplete="off"><button class="btn primary">Ответить</button></form></div>
 </section>`;
}
function counts(){
 const c={working:0,waiting:0,resting:0};team().forEach(m=>c[st(m.state)]++);
 return `<div class="legend">${Object.keys(c).map(k=>`<span>${pill(k)} ${c[k]}</span>`).join('')}</div>`;
}
function progressPanel(){
 const rows=team().map(m=>{const [d,t]=Array.isArray(m.prog)?m.prog.map(Number):[0,0];const n=Math.min(Math.max(t,0),30);
  const segs=Array.from({length:n},(_,i)=>`<span class="seg2 ${i<d?'on':''}${i===d&&st(m.state)==='working'?' cur':''}"></span>`).join('');
  return `<li><button class="prow" data-open="${esc(m.id)}">${chip(m)}<span class="pn"><b>${esc(m.name)}</b><span class="rl">${esc(m.spec)}</span></span><span class="pbar" aria-label="Шаг ${d} из ${t}">${segs}</span><span class="pst">${t?`<span class="ps">Шаг ${d} из ${t}</span>`:''}${esc(m.step)}</span>${pill(m.state)}</button></li>`}).join('');
 return `<section class="panel"><h2>Кто на каком этапе</h2>${rows?`<ul class="prog">${rows}</ul>`:'<p class="hint">Команда ещё не собрана.</p>'}</section>`;
}
function renderOffice(){
 const q=openQs();
 return `<div class="page">${stagesList()}${q.length?askCard(q[0],0):''}${roomSwitch()}${office()}${counts()}${progressPanel()}</div>`;
}

/* ---------- вкладки проекта ---------- */
function projectHead(){
 const p=P(),q=openQs().length;
 return `<div class="phead">
  <a class="back" href="/" data-nav>← Проекты</a>
  <div class="phrow"><h1>${esc(p.title)}</h1>
   <div class="pact">${p.finished?'':p.paused?`<button class="btn primary" data-pause="0">Продолжить</button>`:`<button class="btn" data-pause="1">Поставить на паузу</button>`}
   <a class="btn" href="#chat">Чат с Бригадиром</a>
   ${S.access&&S.access.host&&p.continue_url&&!p.finished?`<a class="btn" href="${esc(p.continue_url)}">Продолжить в Claude</a>`:''}
   ${p.link?`<button class="btn" data-link="1" aria-expanded="${S.linkOpen}">Ссылка на прогон</button>`:''}</div></div>
  ${S.linkOpen&&p.link?`<div class="linkbox"><div class="lrow"><code id="runlink">${esc(p.link)}</code><button class="btn primary" data-copy="runlink">Скопировать</button></div>
   <p class="hint">Ссылка работает на любом устройстве в вашей сети: на компьютере, КовКоде или телефоне. С другого устройства Чекан спросит пароль и откроет сразу этот прогон.</p></div>`:''}
  <div class="meta">${p.mode_label?`<span class="chipm">Режим <b>${esc(p.mode_label)}</b></span>`:''}${p.section?`<span class="chipm">Раздел в Claude <b>${esc(p.section)}</b></span>`:''}${p.finished?'<span class="chipm"><b>Сдан</b></span>':''}</div>
  ${Array.isArray(p.progress)&&p.progress.length?`<ul class="report" aria-label="Отчёт Бригадира">${p.progress.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}
  ${p.paused?`<div class="pausebar">Пауза${p.paused_since?' с '+esc(hm(p.paused_since)):''}. Новые задачи не раздаются. Продолжить можно в любой момент: кнопкой здесь или фразой «продолжай» в чате с Бригадиром.</div>`:''}
  <nav class="subnav" aria-label="Разделы проекта">${TABS.map(([k,l])=>`<a href="#${k}"${S.tab===k?' aria-current="page"':''}>${l}${k==='questions'&&q?`<span class="badge">${q}</span>`:''}</a>`).join('')}</nav>
 </div>`;
}
function renderChat(){
 const box=P().inbox||[],ln=leadName();
 return `<div class="page"><section class="panel chatpage"><h2>Чат с Бригадиром</h2>
  <div class="chat big" id="ochat">${box.length?box.map(x=>`<div class="msg ${x.who==='me'?'self':'lead'}"><span class="by">${x.who==='me'?'Вы':esc(ln)}${x.at?' · '+esc(hm(x.at)):''}</span>${esc(x.text)}</div>`).join(''):'<p class="hint">Пока сообщений нет. Напишите Бригадиру, он ответит здесь и в Claude.</p>'}</div>
  <form class="own" id="chatform"><input id="chatin" placeholder="Напишите Бригадиру" aria-label="Сообщение Бригадиру" autocomplete="off" maxlength="4000"><button class="btn primary">Отправить</button></form>
  <p class="hint">Это та же переписка, что в Claude. Бригадир читает новые сообщения между шагами, обычно в течение минуты. Если сессия Бригадира закрыта, сообщение подождёт.</p></section></div>`;
}
function renderProgressPage(){
 const tasks=P().tasks||[],rev=team().find(m=>m.role==='Проверяющий');
 const list=tasks.map((t,i)=>{const m=by(t.owner),[pc,pl]=TASK_ST[t.status]||['resting','В очереди'];
  const label=t.status==='done'&&t.accepted?'Готово, принято':pl;
  const checks=Array.isArray(t.checks)?t.checks:[];
  return `<li class="task ${esc(t.status)}">
   <div class="thead"><span class="tn">${i+1}</span><b>${esc(t.title)}</b><span class="pill ${pc}">${label}</span></div>
   <div class="towner">${m?`<button class="linkbtn" data-open="${esc(m.id)}">${mini(m)}${esc(m.name)}, ${esc(String(m.spec||m.role||'').toLowerCase())}</button>`:'<span class="hint">Исполнитель ещё не назначен</span>'}${rev?`<span class="hint">Проверяет: ${esc(rev.name)}</span>`:''}</div>
   ${(t.checklist||[]).length?`<ul class="check">${t.checklist.map(c=>`<li class="${t.accepted?'ok':''}">${esc(c)}</li>`).join('')}</ul>`:''}
   ${checks.length?`<ul class="verd">${checks.map(c=>`<li><span class="${c.verdict==='accept'?'v-accept':'v-return'}">${c.verdict==='accept'?'Принято':'Вернул на доработку'}</span>${c.at?` <span class="hint">· ${esc(hm(c.at))}</span>`:''}<br>${esc(c.note)}</li>`).join('')}</ul>`:''}</li>`}).join('');
 return `<div class="page">${stagesList()}
  <section class="panel"><h2>Задачи и чек-листы</h2>${list?`<ol class="tasks">${list}</ol>`:'<p class="hint">Задач пока нет: Бригадир ещё составляет план.</p>'}</section>
  ${progressPanel()}</div>`;
}
const CHANNEL={claude:'Чат Claude',dash:'Кабинет',remote:'Кабинет с другого устройства',gmail:'Почта',mail:'Почта',telegram:'Телеграм'};
function renderQuestions(){
 const q=openQs(),done=(P().questions||[]).filter(x=>x.status==='answered');
 return `<div class="page">${q.length?q.map(askCard).join(''):'<section class="panel"><p>Открытых вопросов нет.</p></section>'}
  <p class="hint">Вопросы приходят в чат с Бригадиром в Claude. Засчитывается первый ответ, откуда бы он ни пришёл.</p>
  <section class="panel"><h2>Ответы</h2>${done.length?`<ul class="qa">${done.map(x=>`<li><span class="qq">${esc(x.q)}</span><span class="qa-a">${esc(x.answer)}</span><span class="hint">${esc(CHANNEL[String(x.by||'').toLowerCase()]||x.by||'')}${x.at?' · '+esc(hm(x.at)):''}</span></li>`).join('')}</ul>`:'<p class="hint">Ответов пока нет.</p>'}</section></div>`;
}
function renderResults(){
 const r=P().results||[];
 return `<div class="page"><section class="panel"><h2>${P().finished?'Готово':'Результаты'}</h2>
  ${r.length?`<ul class="files">${r.map(x=>`<li>${ficon(x.kind)}<span><span class="fn">${esc(x.path)}</span><br><span class="fm">${x.task?'Задача '+esc(x.task)+' · ':''}${size(x.size)}</span></span></li>`).join('')}</ul>`:'<p class="hint">Здесь появятся результаты, которые прошли проверку.</p>'}
  <p class="hint">Файлы лежат в папке проекта на компьютере, где запущен Чекан.</p></section></div>`;
}
function renderTeamPage(){
 const t=team();
 return `<div class="page">
  <div class="meta"><span class="chipm">Участников <b>${t.length}</b></span><a class="btn" href="#chat">Добавить участника через Бригадира</a></div>
  <section class="panel">${t.length?`<ul class="trows">${t.map(m=>`<li><button class="linkbtn tperson" data-open="${esc(m.id)}">${mini(m)}<span><b>${esc(m.name)}</b><br><span class="hint">${esc(m.role)}</span></span></button>
   ${pill(m.state)}<span class="tmodel">Модель <b>${esc(m.model||'—')}</b></span><span class="tmodel">${m.cls?`Класс <b>${esc(CLS[m.cls]||m.cls)}</b>`:''}</span><span class="tmodel">Потрачено <b>${tok(m.tokens)}</b></span></li>`).join('')}</ul>`:'<p class="hint">Команда ещё не собрана.</p>'}</section></div>`;
}
function renderSpend(){
 const sp=P().spend||{},total=Number(sp.total||0),bud=Number(sp.budget||0),list=[...(sp.by_member||[])].sort((a,b)=>(b.tokens||0)-(a.tokens||0));
 const max=Math.max(1,...list.map(x=>Number(x.tokens||0)));
 const bar=bud>0?`<div class="budget" aria-label="Потрачено ${fmt(total)} из лимита ${fmt(bud)}"><span style="width:${Math.min(100,total/bud*100).toFixed(1)}%"></span><i style="left:80%"></i></div>
   <div class="blegend"><span>0</span><span class="stopmark" style="left:80%">пауза на ${fmt(Math.round(bud*.8))}</span><span>лимит ${fmt(bud)}</span></div>`:'';
 return `<div class="page">
  <section class="panel"><h2>Потрачено в этом прогоне</h2>
   <p class="big"><b>${fmt(total)}</b> <span>${plural(total,['токен','токена','токенов'])}</span></p>${bar}
   <p class="hint">Токен — кусочек текста, примерно полслова. Модель тратит токены, когда читает и пишет, по ним считается лимит подписки.${bud>0?` Когда потрачено ${fmt(Math.round(bud*.8))}, прогон встанет на паузу и спросит, продолжать ли.`:' Лимит на этот прогон не задан.'}</p></section>
  <section class="panel"><h2>Кто сколько потратил</h2>${list.length?`<ul class="sbars">${list.map(x=>{const m=by(x.id)||{name:x.name,fur:FURS[0]};return `<li>${mini(m)}<span>${esc(x.name)}${m.model?` <span class="hint">· ${esc(m.model)}</span>`:''}</span><span class="sb"><span style="width:${x.tokens>0?Math.max(2,x.tokens/max*100).toFixed(1):0}%"></span></span><span class="num">${fmt(x.tokens)}</span></li>`}).join('')}</ul>`:'<p class="hint">Пока никто ничего не потратил.</p>'}</section></div>`;
}
function renderLog(){
 const f=[...(P().feed||[])].reverse(),l=lead();
 return `<div class="page"><section class="panel"><h2>Журнал</h2>${f.length?`<ul class="feed">${f.map(([t,id,x])=>{const m=(id&&by(id))||l;return `<li><time>${esc(t)}</time>${m?chip(m):'<span></span>'}<span>${esc(x)}</span></li>`}).join('')}</ul>`:'<p class="hint">Событий пока нет.</p>'}</section></div>`;
}

/* ---------- карточка участника ---------- */
const upl=id=>`<label class="btn upl">Свой персонаж<input type="file" accept="image/png,image/gif,image/svg+xml,image/webp" data-upload="${esc(id)}" hidden></label>`;
function lookEditor(m){
 return `<div class="swatches">${FURS.map(c=>`<button class="sw" style="background:${c}" data-fur="${esc(m.id)}" data-c="${c}" aria-pressed="${c===fur(m.fur)&&!img(m.img)}" aria-label="Цвет шерсти ${FURS.indexOf(c)+1}"></button>`).join('')}</div>
  <div class="hats">${HATS.map(([k,l])=>`<button class="btn" data-hat="${esc(m.id)}" data-k="${k}" aria-pressed="${k===hat(m.hat)}">${l}</button>`).join('')}</div>
  <div class="chact">${upl(m.id)}${img(m.img)?`<button class="btn" data-reset="${esc(m.id)}">Вернуть бурундука</button>`:''}</div>`;
}
function detail(m){
 const ld=isLead(m),ln=leadName(),chat=Array.isArray(m.chat)?m.chat:[];
 return `<div class="dhead">${chip(m)}<div><h2>${esc(m.name)}</h2><p class="rl">${esc(m.role)}</p>${pill(m.state)}</div><button class="close" data-close aria-label="Закрыть">×</button></div>
 <div class="sect"><h3>Сейчас</h3><div class="now">${esc(m.doing||'—')}${m.stage||m.step?`<br><span class="hint">${esc([m.stage,m.step&&m.step!==m.doing?m.step:''].filter(Boolean).join(' · '))}</span>`:''}</div>
  <p class="hint">${m.model?`Модель ${esc(m.model)}${m.cls?` (${esc(CLS[m.cls]||m.cls)})`:''} · `:''}потрачено ${tok(m.tokens)}</p></div>
 ${Array.isArray(m.tools)&&m.tools.length?`<div class="sect"><h3>Чем пользуется</h3><div class="ttools">${m.tools.map(t=>`<details class="tip"><summary>${esc(t.title)}<span class="q" aria-hidden="true">?</span></summary><p>${esc(t.what)}</p></details>`).join('')}</div></div>`:''}
 <div class="sect"><h3>Получил</h3>${fileList(m.got,'Пока ничего не получал.')}</div>
 <div class="sect"><h3>Выдал</h3>${fileList(m.made,'Пока ничего не выдал.')}</div>
 <div class="sect"><h3>Чат${ld?'':' с Бригадиром'}</h3>${chat.length?`<div class="chat">${chat.map(([w,x,t])=>`<div class="msg ${w==='lead'?'lead':'self'}"><span class="by">${w==='lead'?esc(ln):esc(m.name)}${t?' · '+esc(t):''}</span>${esc(x)}</div>`).join('')}</div>`:'<p class="hint">Переписки пока нет.</p>'}
 ${ld?'':`<div class="lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span>Этот чат только для чтения. ${esc(m.name)} слушает только Бригадира, поэтому вопросы и правки пишите ему.</span></div>`}
 <button class="btn${ld?' primary':''}" data-tochat="1">Написать Бригадиру</button></div>
 <div class="sect"><h3>Внешний вид</h3>${lookEditor(m)}</div>`;
}
function openDrawer(id){const m=by(id);if(!m)return;S.drawerId=id;const d=$('#drawer');d.innerHTML=detail(m);d.hidden=false;$('#scrim').hidden=false;d.scrollTop=0;d.querySelector('.close').focus({preventScroll:true})}
function closeDrawer(){S.drawerId=null;$('#drawer').hidden=true;$('#scrim').hidden=true}
function refreshDrawer(){
 if(!S.drawerId)return;const m=by(S.drawerId);if(!m||S.page!=='project'){closeDrawer();return}
 const d=$('#drawer'),y=d.scrollTop,html=detail(m);if(d.dataset.h===hash(html))return;
 d.innerHTML=html;d.dataset.h=hash(html);d.scrollTop=y;
}

/* ---------- страницы ---------- */
function renderProjects(){
 const ps=S.projects;
 if(!ps)return '<p class="hint">Загружаем…</p>';
 const c={ask:0,run:0,pause:0,done:0};ps.forEach(p=>{if(p.status in c)c[p.status]++});
 return `<div class="page">
  <div class="ptitle"><h1>Проекты</h1><p class="hint">Новый проект начинается в Claude: напишите задачу и слово «чекан» или «давай на автомате».</p></div>
  <div class="meta"><span class="chipm"><b>${c.ask}</b> ждёт ответа</span><span class="chipm"><b>${c.run}</b> идёт</span><span class="chipm"><b>${c.pause}</b> на паузе</span><span class="chipm"><b>${c.done}</b> сдан</span></div>
  ${ps.length?`<div class="pgrid">${ps.map(p=>{const crew=Array.isArray(p.team)?p.team:[],s=['ask','run','pause','done'].includes(p.status)?p.status:'run';
   const href=p.classic&&p.classic_url?p.classic_url:'/p/'+encodeURIComponent(p.slug);
   return `<a class="pcard st-${s}" href="${esc(href)}"${p.classic?'':' data-nav'}>
   <span class="ptop"><span class="sdot s-${s}">${esc(p.status_text)}</span>${p.stage?`<span class="hint">Этап «${esc(p.stage)}»</span>`:''}</span>
   <span class="pname">${esc(p.title)}</span>
   <span class="crew">${crew.slice(0,7).map(m=>mini({...m,id:m.name})).join('')}${crew.length>7?`<span class="more">+${crew.length-7}</span>`:''}</span>
   <span class="pfoot"><span>${p.section&&p.section!==p.title?esc(p.section):''}</span><span>${p.tokens!=null?'потрачено '+tok(p.tokens):''}</span></span>
  </a>`}).join('')}</div>`:'<section class="panel empty"><p>Проектов пока нет.</p><p class="hint">Напишите задачу в Claude, и проект появится здесь.</p></section>'}</div>`;
}
function renderRoles(){
 const R=S.roles;if(!R)return '<p class="hint">Загружаем…</p>';
 const cats=R.cats||{},roles=R.roles||[];
 const list=roles.filter(r=>S.roleCat==='all'||r.cat===S.roleCat);
 const furOf=s=>FURS[parseInt(hash(String(s)),36)%FURS.length];
 return `<div class="page"><div class="ptitle"><h1>Роли</h1><p class="hint">Готовые специалисты: ${roles.length} ${plural(roles.length,['роль','роли','ролей'])} в библиотеке. Бригадир предлагает команду под задачу, вы убираете лишних и добавляете своих. Нужной роли нет — Бригадир создаст её сам.</p></div>
  <div class="cats" role="group" aria-label="Направления">${[['all','Все'],...Object.entries(cats)].map(([k,l])=>`<button class="btn" data-cat="${esc(k)}" aria-pressed="${k===S.roleCat}">${esc(l)}</button>`).join('')}</div>
  <div class="rgrid">${list.map(r=>{const m={id:r.slug,name:r.title,role:r.title,fur:furOf(r.slug),hat:r.slug==='orchestrator'?'hardhat':'none',tool:r.tool,state:'working'};const ch=Array.isArray(r.checks)?r.checks:r.checks?[r.checks]:[];
   return `<article class="rcard">
   <div class="rhead">${mini(m)}<div><h3>${esc(r.title)}</h3><p class="hint">${esc(r.does)}</p></div></div>
   <p class="rmeta">${r.cls?`Модель <b>${esc(CLS[r.cls]||r.cls)}</b> · `:''}${esc(cats[r.cat]||'')}</p>
   ${ch.length?`<div><p class="rmeta"><b>Как проверяют работу</b></p><ul class="rchecks">${ch.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
  </article>`}).join('')||'<p class="hint">В этом направлении ролей пока нет.</p>'}</div></div>`;
}
function renderChars(){
 const ps=(S.projects||[]).filter(p=>!p.classic),slug=charsSlug();
 const head=`<div class="ptitle"><h1>Персонажи</h1><p class="hint">По умолчанию команда — бурундуки. Любого участника можно заменить своим персонажем: тамагочи, питомцем, рисунком, фото. Загрузите картинку PNG, GIF, WebP или SVG до 300 КБ. Дыхание, подпрыгивание за работой, знак вопроса и сон Чекан добавит сам.</p></div>`;
 if(!S.projects)return `<div class="page">${head}<p class="hint">Загружаем…</p></div>`;
 if(!slug)return `<div class="page">${head}<section class="panel empty"><p>Проектов пока нет, поэтому и команды нет.</p></section></div>`;
 const pick=ps.length>1?`<div class="projpick" role="group" aria-label="Проект">${ps.map(p=>`<button class="btn" data-chars="${esc(p.slug)}" aria-pressed="${p.slug===slug}">${esc(p.title)}</button>`).join('')}</div>`:'';
 const ready=S.project&&S.project.slug===slug,t=ready?team():[];
 const mine=[...new Set(t.map(m=>img(m.img)).filter(Boolean))];
 return `<div class="page">${head}${pick}
  ${ready?`<div class="rgrid">${t.map(m=>`<article class="rcard"><div class="chbig">${chip(m)}</div><div><h3>${esc(m.name)}</h3><p class="hint">${esc(m.role)}</p></div>${lookEditor(m)}</article>`).join('')}</div>`:'<p class="hint">Загружаем…</p>'}
  <section class="panel"><h2>Мои персонажи</h2>${mine.length?`<div class="mychars">${mine.map(u=>`<img src="${esc(u)}" alt="Свой персонаж">`).join('')}</div>`:'<p class="hint">Загруженные персонажи появятся здесь.</p>'}</section></div>`;
}
function accessControls(){
 const a=S.access;if(!a)return '<p class="hint">Не удалось узнать настройки входа.</p>';
 const dis=a.host?'':' disabled';
 return `${a.host?'<p class="hostnote">Вы на компьютере, где запущен Чекан, поэтому пароль здесь не нужен. Задать, сменить или удалить пароль можно только отсюда.</p>':'<p class="hint">Пароль и вход меняются только на компьютере, где запущен Чекан.</p>'}
  <label class="trow" for="remote-on"><span><b>Разрешить вход с других устройств</b><br><span class="hint">Отвечать на вопросы, писать Бригадиру и ставить паузу можно будет с другого компьютера или телефона. Без пароля не включается.</span></span><input type="checkbox" id="remote-on" class="toggle" data-remote="1"${a.remote?' checked':''}${dis}></label>
  <div class="trow"><span><b>Пароль</b><br><span class="hint">${a.has_password?'Задан. Хранится только отпечаток, сам пароль не сохраняется.':'Не задан. Без пароля вход с других устройств не включится.'}</span></span><span class="pwset"><input type="password" id="pw1" placeholder="${a.has_password?'Новый пароль':'Пароль, от 10 символов'}" autocomplete="new-password" aria-label="Пароль"${dis}><button class="btn" data-setpw="1"${dis}>${a.has_password?'Сменить':'Задать'}</button>${a.has_password?`<button class="btn" data-delpw="1"${dis}>Удалить</button>`:''}</span></div>
  ${a.sessions!=null?`<div class="trow"><span><b>Где выполнен вход</b><br><span class="hint">Устройств с открытым входом: ${fmt(a.sessions)}</span></span><button class="btn" data-logoutall="1"${dis}>Выйти везде</button></div>`:''}`;
}
function addrList(){
 const ad=(S.access&&S.access.addresses)||[];
 return ad.length?`<ul class="addr">${ad.map(([l,u],i)=>`<li><span class="hint">${esc(l)}</span><code id="addr-${i}">${esc(u)}</code><button class="btn" data-copy="addr-${i}">Скопировать</button></li>`).join('')}</ul>`:'';
}
function renderPrefs(){
 return `<div class="page"><div class="ptitle"><h1>Настройки</h1></div>
  <section class="panel"><h2>Вход с других устройств</h2>${accessControls()}${S.access&&S.access.remote?addrList():''}</section>
  <section class="panel"><h2>Работа команды</h2>
   <p>Режим работы, сколько участников работают одновременно, лимит токенов и дорогие модели задаются при постановке задачи.</p>
   <p class="hint">Чтобы поменять их в идущем проекте, напишите Бригадиру во вкладке «Чат», например: «работайте по двое» или «лимит 300 тысяч токенов».</p></section>
  <section class="panel"><h2>Каналы связи</h2>
   <div class="trow"><span><b>Чат с Бригадиром в Claude</b><br><span class="hint">Основной канал. Работает всегда.</span></span><span class="pill working">Включён</span></div>
   <p class="hint">Почта и Google Drive подключаются при постановке задачи. Если дополнительный канал не отвечает, всё идёт через чат в Claude.</p></section>
  <section class="panel"><h2>Хранение</h2><p class="hint">Всё по проекту лежит в его папке на компьютере, где запущен Чекан. Временные файлы удаляются сами после сдачи.</p></section></div>`;
}
function renderLogin(){
 return `<div class="page login"><section class="panel"><h1>Вход в Чекан</h1><p class="hint">Это устройство не то, где запущен Чекан. Введите пароль владельца.</p>
  <form class="own" id="loginform"><input id="pw" type="password" placeholder="Пароль" aria-label="Пароль" autocomplete="current-password"><button class="btn primary">Войти</button></form>
  ${S.loginErr?`<p class="loginerr" role="alert">${esc(S.loginErr)}</p>`:''}
  <p class="hint">После 5 неверных попыток вход закрывается на 15 минут. В домашней сети без Tailscale пароль идёт открытым текстом, поэтому вне дома пользуйтесь Tailscale.</p></section></div>`;
}
function renderConn(){
 const a=S.access,b=document.querySelector('[data-conn]');
 b.hidden=!a||S.page==='login';
 if(!a)return;
 b.querySelector('.cdot').classList.toggle('off',!a.remote);
 const box=$('#connbox');
 if(S.connOpen){
  const html=`<div class="barin"><div class="cbox">${a.remote?`<p><b>Кабинет открыт для ваших устройств.</b> Зайдите с другого компьютера или телефона по адресу и введите пароль.</p>${addrList()}
   <p class="hint">Снаружи интернета адрес не виден. Через Tailscale (защищённая сеть между вашими устройствами) подключение шифруется. В домашней сети без Tailscale пароль идёт открытым текстом, поэтому вне дома пользуйтесь Tailscale.</p>`
   :'<p><b>Вход с других устройств выключен.</b></p>'}${accessControls()}</div></div>`;
  if(box.dataset.h!==hash(html)){const vals=keepInputs(box);box.innerHTML=html;box.dataset.h=hash(html);restoreInputs(box,vals)}
 }
 box.hidden=!S.connOpen;b.setAttribute('aria-expanded',String(S.connOpen));
}

/* ---------- отрисовка ---------- */
function keepInputs(root){
 const vals={};root.querySelectorAll('input[id]').forEach(i=>{if(i.type!=='file'&&i.type!=='checkbox')vals[i.id]=i.value});
 const a=document.activeElement;
 if(a&&root.contains(a)&&a.id){vals.__focus=a.id;try{vals.__sel=[a.selectionStart,a.selectionEnd]}catch(e){}}
 return vals;
}
function restoreInputs(root,vals){
 Object.keys(vals).forEach(id=>{if(id.startsWith('__'))return;const i=root.querySelector('#'+CSS.escape(id));if(i)i.value=vals[id]});
 if(vals.__focus){const i=root.querySelector('#'+CSS.escape(vals.__focus));if(i){i.focus({preventScroll:true});try{if(vals.__sel)i.setSelectionRange(vals.__sel[0],vals.__sel[1])}catch(e){}}}
}
function viewHtml(){
 switch(S.page){
  case 'login':return renderLogin();
  case 'projects':return renderProjects();
  case 'roles':return renderRoles();
  case 'chars':return renderChars();
  case 'prefs':return renderPrefs();
 }
 if(!S.project)return '<p class="hint">Загружаем…</p>';
 if(S.project.missing)return '<div class="page"><a class="back" href="/" data-nav>← Проекты</a><section class="panel empty"><p>Такого проекта нет.</p><p class="hint">Возможно, его папку перенесли или удалили.</p></section></div>';
 const R={office:renderOffice,chat:renderChat,progress:renderProgressPage,questions:renderQuestions,results:renderResults,team:renderTeamPage,spend:renderSpend,log:renderLog};
 return projectHead()+`<div class="${P().paused?'paused':''}">${R[S.tab]()}</div>`;
}
NARROW.addEventListener('change',()=>{if(S.page==='project')render()});
function render(fresh){
 const g=S.page==='project'?'projects':S.page;
 document.querySelectorAll('.gnav a').forEach(a=>a.setAttribute('aria-current',a.dataset.g===g?'page':'false'));
 document.title=S.page==='project'&&S.project?`Чекан · ${S.project.title}`:'Чекан';
 const v=$('#view'),html=viewHtml();
 const keep={};v.querySelectorAll('[data-keep]').forEach(n=>keep[n.dataset.keep]=n);
 const vals=fresh?{}:keepInputs(v),y=window.scrollY;
 v.innerHTML=html;
 if(!fresh)v.querySelectorAll('[data-keep]').forEach(n=>{const o=keep[n.dataset.keep];if(o&&o.dataset.h===n.dataset.h)n.replaceWith(o)});
 restoreInputs(v,vals);
 if(!fresh)window.scrollTo(0,y);
 const oc=$('#ochat');if(oc){const n=(P().inbox||[]).length;if(fresh||n!==S.lastInbox)oc.scrollTop=oc.scrollHeight;S.lastInbox=n}
 refreshDrawer();renderConn();
}
let tt;function toast(t,err){const el=$('#toast');el.textContent=t;el.classList.toggle('err',!!err);el.hidden=false;clearTimeout(tt);tt=setTimeout(()=>el.hidden=true,err?5000:2800)}

/* ---------- действия ---------- */
async function act(path,body,ok,after){
 if(S.busy)return false;S.busy=true;
 try{await api(path,body||{});if(ok)toast(ok);if(after)after();await loadPage(true);return true}
 catch(e){if(!(e instanceof AuthError))toast(e.message,true);return false}
 finally{S.busy=false}
}
const slugP=()=>'/api/p/'+encodeURIComponent(S.page==='chars'?charsSlug():S.slug);
function answer(qid,text){text=String(text||'').trim();if(!text){toast('Напишите ответ или выберите вариант',true);return}
 act(slugP()+'/answer',{qid,text},'Ответ передан Бригадиру.')}
function look(rid,body){
 const m=by(rid);if(m){Object.assign(m,body);if(body.reset)m.img=null;render()}
 act(slugP()+'/look',{rid,...body},body.reset?'Бурундук вернулся':'Внешний вид сохранён');
}
async function accessAct(path,body,ok){
 if(S.busy)return;S.busy=true;
 try{await api(path,body||{});toast(ok);}
 catch(e){if(!(e instanceof AuthError))toast(e.message,true)}
 finally{S.busy=false}
 await loadAccess();if(S.page==='prefs')render();
 setTimeout(async()=>{await loadAccess();if(S.page==='prefs')render()},1500);
}
function copyFrom(id){
 const el=document.getElementById(id);if(!el)return;const v=el.textContent;
 const fallback=()=>{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);let done=false;try{done=document.execCommand('copy')}catch(e){}toast(done?'Скопировано':'Выделено: скопируйте вручную')};
 if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(v).then(()=>toast('Скопировано'),fallback);else fallback();
}

document.addEventListener('click',e=>{
 if(e.target.id==='scrim'){closeDrawer();return}
 const a=e.target.closest('a[data-nav]');
 if(a&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&e.button===0){e.preventDefault();go(a.getAttribute('href'));return}
 const t=e.target.closest('button,[data-open]');
 if(!t)return;
 const d=t.dataset;
 if(d.open){openDrawer(d.open)}
 else if(t.hasAttribute('data-close')){closeDrawer()}
 else if(d.tochat){closeDrawer();location.hash='chat'}
 else if(d.conn){S.connOpen=!S.connOpen;renderConn()}
 else if(d.copy){copyFrom(d.copy)}
 else if(d.link){S.linkOpen=!S.linkOpen;render()}
 else if(d.pause){const on=d.pause==='1';act(slugP()+(on?'/pause':'/resume'),{},on?'Пауза. Работающие доделают текущий шаг.':'Работа продолжается.')}
 else if(d.qid!==undefined&&d.text!==undefined){answer(d.qid,d.text)}
 else if(d.fur){look(d.fur,{fur:d.c})}
 else if(d.hat){look(d.hat,{hat:d.k})}
 else if(d.reset){look(d.reset,{reset:true})}
 else if(d.room){S.room=+d.room;render()}
 else if(d.cat){S.roleCat=d.cat;render()}
 else if(d.chars){S.charsSlug=d.chars;S.project=null;render();loadPage(true)}
 else if(d.setpw){const i=t.closest('.pwset').querySelector('input'),v=i.value;if(v.length<10){toast('Пароль должен быть не короче 10 символов',true);return}const had=S.access&&S.access.has_password;i.value='';accessAct('/api/access/password',{password:v},had?'Пароль сменён. Все старые входы закрыты.':'Пароль задан. Теперь можно включить вход с других устройств.')}
 else if(d.delpw){if(!confirm('Удалить пароль? Вход с других устройств выключится, все входы закроются.'))return;accessAct('/api/access/password/delete',{},'Пароль удалён. Вход с других устройств выключен.')}
 else if(d.logoutall){accessAct('/api/access/logout-all',{},'Все входы закрыты. На других устройствах снова попросят пароль.')}
});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.dataset&&el.dataset.upload){const rid=el.dataset.upload,f=el.files&&el.files[0];el.value='';if(!f)return;
  if(!/^image\/(png|gif|webp|svg\+xml)$/.test(f.type)){toast('Подойдёт картинка PNG, GIF, WebP или SVG',true);return}
  if(f.size>MAX_IMG){toast('Картинка больше 300 КБ. Возьмите поменьше.',true);return}
  const r=new FileReader();r.onload=()=>look(rid,{img:r.result});r.onerror=()=>toast('Не удалось прочитать картинку',true);r.readAsDataURL(f);return}
 if(el.dataset&&el.dataset.remote){const on=el.checked;el.checked=!on;accessAct('/api/access/remote',{on},on?'Вход с других устройств включён':'Вход с других устройств выключен. Все входы закрыты.')}
});
document.addEventListener('submit',async e=>{
 const f=e.target;e.preventDefault();
 if(f.id==='chatform'){const i=f.querySelector('input'),v=i.value.trim();if(!v)return;i.value='';if(!await act(slugP()+'/chat',{text:v},'Сообщение отправлено Бригадиру.')){const n=$('#chatin');if(n&&!n.value)n.value=v}return}
 if(f.id==='loginform'){const pw=f.querySelector('input').value;if(!pw)return;
  try{await api('/api/login',{password:pw});S.loginErr='';await loadAccess();const back=S.back&&S.back!=='/login'?S.back:'/';S.back=null;S.raw={};go(back)}
  catch(err){let m=err.message;if(err.data&&err.data.retry_after){const min=Math.ceil(err.data.retry_after/60);m+=` Попробуйте через ${min} ${plural(min,['минуту','минуты','минут'])}.`}S.loginErr=m;render(true)}
  return}
 if(f.dataset.own!==undefined){const i=f.querySelector('input');answer(f.dataset.own,i.value)}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&S.drawerId){closeDrawer();return}
 const g=e.target.closest&&e.target.closest('g[data-open]');
 if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openDrawer(g.dataset.open)}
});
window.addEventListener('popstate',()=>{if(location.pathname!==S.path)route()});
window.addEventListener('hashchange',()=>{if(S.page==='project'){parse();closeDrawer();render(true);window.scrollTo(0,0)}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.page!=='login')loadPage(false)});
setInterval(()=>{if(!document.hidden&&!S.busy&&['project','projects','chars'].includes(S.page))loadPage(false)},3000);

(async()=>{parse();S.path=location.pathname;const ok=await loadAccess();if(!ok)return;if(S.page==='login'){S.back='/';render(true);return}render(true);loadPage(true)})();
