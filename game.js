"use strict";
/* GAIA CONSOLE — SimEarth-spirited planetary sim. VGA/DOS shell, vanilla JS + canvas, touch-first. */

const W=64,H=40,N=W*H;
const idx=(x,y)=>y*W+((x%W)+W)%W;
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a=1,b=0)=>b+Math.random()*(a-b);

const alt=new Float32Array(N),temp=new Float32Array(N),moist=new Float32Array(N);
const bio=new Float32Array(N),lcl=new Uint8Array(N),cloud=new Float32Array(N),seed=new Float32Array(N);

const CLASSES=["Lifeless","Microbes","Eukaryotes","Soft-bodied","Arthropods","Fish","Amphibians","Reptiles","Dinosaurs","Mammals","Sentient"];
const CLASS_DESC=["sterile rock & sea","first microbial mats","complex cells in the sea","jellies & worms","shelled, jointed life","backbones in the ocean","first lungs on land","scaled colonizers","the great saurians","warm-blooded & clever","tool-makers awaken"];
const TECH_AGES=["Stone","Bronze","Iron","Industrial","Atomic","Information","Nanotech"];

/* per-class emoji, used on the evolution milestone card & biome portrait */
const CLASS_ICON=["·","🦠","🧫","🪼","🦐","🐟","🐸","🦎","🦕","🐘","🧠"];
/* civilization technophases (SimEarth's seven ages) */
const TECH_ICON=["🪨","⚒️","⚔️","🏭","☢️","💾","🔬"];
const TECH_DESC=["stone tools & fire","farms & bronze","iron, sail & empire","fossil fuel & smoke","atoms split — power & peril","computers & networks","molecular machines reach for space"];

/* per-class O₂ floor (%), indexed by life class */
const O2_NEED=[0,0,1,3,6,8,10,12,14,16,18];
/* distinct family palette, indexed by life class — lets each family read on the LIFE map */
const LIFE_COLORS=[
  [20,22,40],      // 0 lifeless (unused; handled in renderLife)
  [180,205,130],   // 1 Microbes  — pale olive
  [80,210,205],    // 2 Eukaryotes— cyan-teal
  [165,120,225],   // 3 Soft-body — violet
  [205,150,75],    // 4 Arthropods— amber
  [70,140,235],    // 5 Fish      — blue
  [60,200,120],    // 6 Amphibians— emerald
  [180,182,60],    // 7 Reptiles  — olive-yellow
  [232,120,50],    // 8 Dinosaurs — orange
  [95,200,70],     // 9 Mammals   — green
  [235,110,210],   //10 Sentient  — magenta
];
/* placeable families for the Fauna brush (cls = life class, hab = habitat rule) */
const FAMILIES=[
  {key:"microbes",cls:1,ic:"🦠",nm:"Microbes",hab:"any"},
  {key:"soft",    cls:3,ic:"🪼",nm:"Soft-body",hab:"sea"},
  {key:"arthro",  cls:4,ic:"🦐",nm:"Arthropod",hab:"sea"},
  {key:"fish",    cls:5,ic:"🐟",nm:"Fish",hab:"sea"},
  {key:"amph",    cls:6,ic:"🐸",nm:"Amphibian",hab:"wetland"},
  {key:"reptile", cls:7,ic:"🦎",nm:"Reptile",hab:"land"},
  {key:"dino",    cls:8,ic:"🦕",nm:"Dinosaur",hab:"land"},
  {key:"mammal",  cls:9,ic:"🐘",nm:"Mammal",hab:"land"},
];
const HAB_TXT={any:"warm water or land",sea:"open ocean",wetland:"warm wet land",land:"warm land"};
function famByKey(k){return FAMILIES.find(f=>f.key===k)||FAMILIES[0];}

const TOOLS=[
  {id:"inspect",ic:"🔍",nm:"Survey",cost:0,hint:"<b>Survey:</b> tap any tile to read it."},
  {id:"raise",ic:"⛰",nm:"Raise",cost:1,hint:"<b>Raise:</b> drag to push up land & mountains."},
  {id:"lower",ic:"🌀",nm:"Sink",cost:1,hint:"<b>Sink:</b> drag to lower land into the sea."},
  {id:"volcano",ic:"🌋",nm:"Volcano",cost:4,hint:"<b>Volcano:</b> tap to erupt — new land + <span class='hot'>CO₂</span>."},
  {id:"water",ic:"💧",nm:"Rain",cost:1,hint:"<b>Rain:</b> drag to add moisture & rivers."},
  {id:"seed",ic:"🌱",nm:"Seed",cost:2,hint:"<b>Seed life:</b> drag where it can grow."},
  {id:"fauna",ic:"🐾",nm:"Fauna",cost:2,hint:"<b>Fauna:</b> pick a family below, then tap where it can live."},
  {id:"co2up",ic:"♨",nm:"+CO₂",cost:2,hint:"<b>+CO₂:</b> warms the <span class='hot'>whole world</span>."},
  {id:"co2dn",ic:"❄",nm:"−CO₂",cost:2,hint:"<b>−CO₂:</b> cools the whole world."},
  {id:"meteor",ic:"☄",nm:"Meteor",cost:6,hint:"<b>Meteor:</b> impact + mass extinction."},
  {id:"city",ic:"🏙",nm:"Spark",cost:8,hint:"<b>Spark mind:</b> tap dry land (needs O₂)."},
];

let G;
function freshGlobal(){return{t:0,paused:true,speed:2,solar:0.72,avgTemp:14,co2:320,ch4:0,o2:1,albedo:0.30,
  seaLevel:0,biomass:0,iceFrac:0,maxClass:0,abiogenesis:false,energy:60,energyMax:120,
  preserve:false,
  civ:{on:false,tech:0,pop:0,pollution:0,mood:1,cities:[],age:0,lastAge:0,exodus:false,collapsed:0},
  log:{temp:[],co2:[],o2:[],bio:[]},logTick:0,layer:"terrain",tool:"inspect",faunaPick:"fish",started:false,scenario:""};}

const SCENARIOS={
  genesis:{emoji:"🌑",name:"Genesis Earth",desc:"Hot young rock under a dim sun",
    init(){G.solar=0.72;G.co2=4200;G.ch4=0.4;G.o2=0.2;G.avgTemp=42;makeTerrain(0.40,1.0);}},
  aqua:{emoji:"🌊",name:"Aquaria",desc:"A warm world of endless ocean",
    init(){G.solar=0.92;G.co2=380;G.ch4=0.02;G.o2=2;G.avgTemp=18;makeTerrain(0.18,0.7);}},
  mars:{emoji:"🔴",name:"Cold Mars",desc:"A frozen desert with thin air",
    init(){G.solar=0.62;G.co2=90;G.ch4=0;G.o2=0.1;G.avgTemp=-48;makeTerrain(0.62,1.1);}},
  garden:{emoji:"🌍",name:"Living Earth",desc:"A living blue marble",
    init(){G.solar=0.96;G.co2=300;G.ch4=0.03;G.o2=20.9;G.avgTemp=15;makeTerrain(0.34,0.85);seedLifeEverywhere(9);}},
  random:{emoji:"🎲",name:"Wildcard",desc:"A random, untested world",
    init(){G.solar=rand(1.05,0.65);G.co2=rand(3000,120);G.ch4=rand(0.4,0);G.o2=rand(4,0.2);G.avgTemp=rand(45,-40);makeTerrain(rand(0.55,0.20),rand(1.1,0.6));}}
};

function makeTerrain(landThresh,ruggedness){
  for(let i=0;i<N;i++) seed[i]=Math.random();
  const oct=[{f:4,a:1},{f:8,a:0.5},{f:16,a:0.27},{f:32,a:0.14}];
  const field=new Float32Array(N);
  for(const o of oct){
    const gw=o.f,gh=Math.max(3,Math.round(o.f*H/W)),grid=new Float32Array(gw*gh);
    for(let i=0;i<grid.length;i++) grid[i]=Math.random()*2-1;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const fx=x/W*gw,fy=y/H*gh,x0=Math.floor(fx)%gw,y0=clamp(Math.floor(fy),0,gh-1),x1=(x0+1)%gw,y1=clamp(y0+1,0,gh-1);
      const tx=fx-Math.floor(fx),ty=fy-Math.floor(fy);
      const a=grid[y0*gw+x0],b=grid[y0*gw+x1],c=grid[y1*gw+x0],d=grid[y1*gw+x1];
      const sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty);
      field[y*W+x]+=lerp(lerp(a,b,sx),lerp(c,d,sx),sy)*o.a;
    }
  }
  let mn=1e9,mx=-1e9; for(let i=0;i<N;i++){if(field[i]<mn)mn=field[i];if(field[i]>mx)mx=field[i];}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x; let v=(field[i]-mn)/(mx-mn); v=Math.pow(v,lerp(1.0,1.5,ruggedness-0.6));
    let a=clamp((v-landThresh)/Math.max(0.12,(1-landThresh))*ruggedness,-1,1);
    if(a<0) a=-Math.pow(-a,0.85);
    alt[i]=a; moist[i]=a<0?1:clamp(0.55-a*0.5+(seed[i]-0.5)*0.3,0,1); bio[i]=0;lcl[i]=0;cloud[i]=0;temp[i]=G.avgTemp;
  }
}
function seedLifeEverywhere(maxc){
  for(let i=0;i<N;i++){const ok=(alt[i]<0)||(alt[i]>=0&&alt[i]<0.6&&moist[i]>0.25);
    if(ok&&Math.random()<0.7){bio[i]=rand(0.9,0.4);lcl[i]=Math.min(maxc,1+(Math.random()*maxc|0));}}
  G.abiogenesis=true;G.maxClass=maxc;
}
const cosLat=new Float32Array(H);
for(let y=0;y<H;y++){const lat=(y/(H-1))*Math.PI-Math.PI/2;cosLat[y]=Math.cos(lat);}

let landFrac=0.3;
function recomputeAlbedo(){
  let aSum=0,iceN=0;
  for(let i=0;i<N;i++){const isOcean=alt[i]<G.seaLevel,t=temp[i];let a;
    if(t<-2){a=isOcean?0.62:0.66;iceN++;}
    else if(isOcean){a=0.07;}
    else{const dry=clamp(1-moist[i],0,1);a=lerp(0.18,0.34,dry);a=lerp(a,0.11,clamp(bio[i],0,1));}
    a+=cloud[i]*0.22;aSum+=a;}
  G.albedo=clamp(aSum/N,0.05,0.85);G.iceFrac=iceN/N;
}
function climateStep(dt){
  if(!G.civ.on&&G.solar<1.06) G.solar+=0.0000016*dt;
  recomputeAlbedo();
  const vapor=clamp(0.30*(G.avgTemp+5),-4,26);
  const co2Term=8*Math.log2((G.co2+1)/280),ch4Term=7*G.ch4,vaporTerm=0.30*vapor;
  const sunTemp=26+55*(G.solar-0.70)-88*G.albedo;
  let target=clamp(sunTemp+co2Term+ch4Term+vaporTerm,-95,125);
  G.avgTemp+=(target-G.avgTemp)*clamp(0.012*dt,0,0.6); G.avgTemp=clamp(G.avgTemp,-95,130);
  landFrac=0; for(let i=0;i<N;i++) if(alt[i]>=G.seaLevel) landFrac++; landFrac/=N;
  const volc=(0.9+(G.solar<0.85?1.6:0))*dt*0.06;
  const weather=clamp(G.avgTemp-2,0,80)*landFrac*dt*0.010*(G.co2/400);
  const photo=G.biomass*dt*0.018,resp=G.biomass*dt*0.004;
  G.co2+=volc-weather-photo*1.1+resp; G.o2+=photo*0.42-resp*0.3;
  if(G.civ.on){
    if(G.civ.age>=3&&G.civ.age<=4){G.co2+=G.civ.pop*G.civ.tech*dt*0.16;G.ch4+=G.civ.pop*dt*0.000005;}
    if(G.civ.age>=5){G.co2+=(300-G.co2)*0.004*dt;G.ch4-=G.ch4*0.003*dt;}  // clean tech relaxes CO₂ toward ~300, never into a snowball
  }
  if(G.biomass<0.001) G.o2-=G.o2*0.001*dt;
  G.ch4=clamp(G.ch4-G.ch4*0.0008*dt,0,3); G.co2=clamp(G.co2,0.2,200000); G.o2=clamp(G.o2,0,35);
  for(let y=0;y<H;y++){const latBonus=24*(cosLat[y]-0.5);
    for(let x=0;x<W;x++){const i=y*W+x,altCool=alt[i]>0?alt[i]*32:0,oceanMod=alt[i]<0?4:0;
      temp[i]+=((G.avgTemp+latBonus-altCool+oceanMod)-temp[i])*0.25;}}
}
function cloudStep(dt){for(let i=0;i<N;i++){
  const evap=(alt[i]<0&&temp[i]>0)?clamp(temp[i]/40,0,1)*0.04:moist[i]*0.012;
  cloud[i]=clamp(cloud[i]+(evap-cloud[i]*0.05)*dt,0,1);}}

let lastClass=0;
function lifeStep(dt){
  if(!G.abiogenesis){
    if(G.avgTemp>0&&G.avgTemp<70&&G.o2<6&&Math.random()<0.004*dt){
      for(let tries=0;tries<40;tries++){const i=(Math.random()*N)|0;
        if(alt[i]<0&&temp[i]>2&&temp[i]<75){bio[i]=0.25;lcl[i]=1;G.abiogenesis=true;G.maxClass=1;if(lastClass<1)lastClass=1;milestone(1,"LIFE BEGINS");break;}}}
    G.biomass=sumBio();return;
  }
  const o2=G.o2,o2Need=O2_NEED;
  for(let pass=0;pass<2;pass++)for(let k=0;k<900;k++){
    const i=(Math.random()*N)|0; if(bio[i]<=0.02) continue;
    const x=i%W,y=(i/W)|0,t=temp[i];
    if(t<-12||t>78){bio[i]*=0.90;if(bio[i]<0.02){bio[i]=0;lcl[i]=0;}continue;}
    const isLand=alt[i]>=G.seaLevel;
    const habit=isLand?clamp(1-Math.abs(t-20)/45,0,1)*clamp(moist[i]*1.4,0,1)*clamp((o2-2)/8,0,1):clamp(1-Math.abs(t-22)/55,0,1);
    bio[i]=clamp(bio[i]+(habit*0.06-0.004)*dt,0,1);
    const nx=x+((Math.random()*3|0)-1),ny=clamp(y+((Math.random()*3|0)-1),0,H-1),j=idx(nx,ny);
    const nLand=alt[j]>=G.seaLevel;
    const can=nLand?(o2>2&&temp[j]>-8&&temp[j]<70&&moist[j]>0.05):(temp[j]>-6&&temp[j]<76);
    if(can&&bio[j]<bio[i]*0.9){bio[j]=clamp(bio[j]+bio[i]*0.12*dt,0,1);
      if(bio[j]>0.05&&lcl[j]<lcl[i]) lcl[j]=Math.max(lcl[j],nLand?Math.min(lcl[i],6):lcl[i]);
      if(lcl[j]===0) lcl[j]=1;}
    const cur=lcl[i];
    if(cur>=1&&cur<10&&bio[i]>0.5){const want=cur+1,needLand=(want>=6);
      if(o2>=o2Need[want]&&(!needLand||isLand)&&t>-5&&t<55&&Math.random()<0.0016*dt*(want>=8?0.5:1)){
        lcl[i]=want; if(want>G.maxClass){G.maxClass=want;announceClass(want);}}}
  }
  G.biomass=sumBio();
}
function sumBio(){let s=0;for(let i=0;i<N;i++) s+=bio[i];return s/N;}
function announceClass(c){if(c<=lastClass)return;lastClass=c;milestone(c);if(c===10)maybeStartCiv();}
function maybeStartCiv(){if(G.civ.on)return;
  for(let i=0;i<N;i++) if(lcl[i]>=10&&alt[i]>=G.seaLevel&&temp[i]>0&&temp[i]<35){
    const c=G.civ;c.on=true;c.tech=0;c.pop=0.04;c.age=0;c.lastAge=0;c.mood=1;c.pollution=0;c.exodus=false;c.collapsed=0;c.cities=[{x:i%W,y:(i/W)|0}];
    toast("Civilization begins — the first cities rise");return;}}
function civDepart(tag,icon,title,sub){
  const c=G.civ;
  showMilestone(tag,icon,title,sub,clockStr(),'rgb(120,200,255)');
  for(let i=0;i<N;i++) if(lcl[i]>=10) lcl[i]=9;       // sentients gone; their wild kin remain
  G.maxClass=9;lastClass=9;
  c.on=false;c.cities=[];c.pop=0;c.tech=0;c.age=0;c.lastAge=0;c.pollution=0;c.collapsed=0;
}
function civStep(dt){
  if(!G.civ.on)return; const c=G.civ;
  const stress=clamp(Math.abs(G.avgTemp-15)/30,0,1.4);
  c.mood+=((1-stress)-c.mood)*0.02*dt;c.mood=clamp(c.mood,0,1.2);
  const habLand=clamp(landFrac*2,0,1)*clamp((G.o2-12)/10,0,1);
  c.pop+=(habLand*c.mood*0.010*(0.3+c.tech)-0.002*stress)*dt;c.pop=clamp(c.pop,0,6);
  // technophases advance slowly — a steady multi-minute arc through the seven ages
  c.tech+=(0.00018+c.pop*0.00003)*c.mood*dt;c.tech=clamp(c.tech,0,1);
  c.age=Math.min(TECH_AGES.length-1,Math.floor(c.tech*TECH_AGES.length));
  if(c.age>c.lastAge){c.lastAge=c.age;civMilestone(c.age);}
  if(c.age>=3&&c.age<=4) c.pollution+=c.pop*0.008*dt; else c.pollution-=c.pollution*0.012*dt;
  c.pollution=clamp(c.pollution,0,3);
  if(G.avgTemp>46) for(let k=0;k<120;k++){const i=(Math.random()*N)|0;if(alt[i]>=0)bio[i]*=0.997;}
  // EXODUS — past nanotech the cities lift off; the world is left a living preserve
  if(c.tech>=1&&!c.exodus){c.exodus=true;G.preserve=true;
    civDepart('EXODUS','🚀','TO THE STARS','The cities lift off — the world is left a living preserve.');return;}
  // COLLAPSE — runaway climate ends the civilization, but life endures
  if(G.avgTemp>54||G.avgTemp<-28||(c.pollution>2.4&&c.mood<0.18)){
    if(++c.collapsed>60){civDepart('COLLAPSE','💀','CIVILIZATION FALLS','The cities go dark — but the planet endures.');return;}
  } else c.collapsed=Math.max(0,c.collapsed-1);
}
function tick(dt){G.t+=dt;climateStep(dt);cloudStep(dt);lifeStep(dt);civStep(dt);
  G.logTick+=dt;if(G.logTick>=4){pushLog();G.logTick=0;}}
function pushLog(){const L=G.log,cap=120;
  L.temp.push(G.avgTemp);L.co2.push(G.co2);L.o2.push(G.o2);L.bio.push(G.biomass);
  for(const k in L) if(L[k].length>cap) L[k].shift();}

const planet=document.getElementById('planet'),pctx=planet.getContext('2d');
const off=document.createElement('canvas');off.width=W;off.height=H;
const octx=off.getContext('2d'),img=octx.createImageData(W,H),pxd=img.data;
function setPx(i,r,g,b){const p=i*4;pxd[p]=r;pxd[p+1]=g;pxd[p+2]=b;pxd[p+3]=255;}
function mix(c1,c2,t){return[lerp(c1[0],c2[0],t),lerp(c1[1],c2[1],t),lerp(c1[2],c2[2],t)];}
const BAYER4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function renderTerrain(){
  for(let i=0;i<N;i++){const a=alt[i],t=temp[i],v=bio[i],s=seed[i],x=i%W,y=(i/W)|0;let c;
    if(a<G.seaLevel){ if(t<-2) c=[200,216,248]; else {const d=clamp(-a,0,1);
      const band=Math.min(3,(d*3.999)|0);c=mix([62,124,210],[14,22,96],band/3);} }
    else{ if(t<-4) c=[224,232,248];
      else if(a>0.55) c=mix([120,112,128],[176,176,184],a-0.55);
      else{const dry=clamp(1-moist[i],0,1);let base=mix([96,176,72],[200,168,80],dry);
        if(dry>0.7&&t>22) base=mix(base,[216,176,96],(dry-0.7)/0.3);
        if(t>20&&moist[i]>0.6) base=mix(base,[40,128,48],clamp((t-20)/20,0,1));
        c=mix(base,[24,80,40],clamp(v,0,0.9));} }
    const bay=BAYER4[(y&3)*4+(x&3)]-7.5,tex=(s-0.5)*5+bay*1.8;c=[c[0]+tex,c[1]+tex,c[2]+tex];
    if(cloud[i]>0.2){const cc=clamp((cloud[i]-0.2)*0.85,0,0.55);c=mix(c,[232,238,248],cc);}
    setPx(i,clamp(c[0],0,255)|0,clamp(c[1],0,255)|0,clamp(c[2],0,255)|0);}
  if(G.civ.on) for(const ct of G.civ.cities){const i=idx(ct.x,ct.y),g=clamp(G.civ.tech,0,1);setPx(i,255,clamp(200+g*55,0,255)|0,clamp(80+g*100,0,255)|0);}
}
function renderClimate(){for(let i=0;i<N;i++){const t=clamp(temp[i],-40,55),u=(t+40)/95;let c;
  if(u<0.25)c=mix([40,40,200],[56,200,200],u/0.25);
  else if(u<0.5)c=mix([56,200,200],[56,200,72],(u-0.25)/0.25);
  else if(u<0.7)c=mix([56,200,72],[248,224,56],(u-0.5)/0.20);
  else c=mix([248,224,56],[216,48,32],(u-0.7)/0.30);
  if(alt[i]<G.seaLevel)c=[c[0]*0.78,c[1]*0.78,c[2]*0.85];
  setPx(i,c[0]|0,c[1]|0,c[2]|0);}}
function renderLife(){for(let i=0;i<N;i++){const v=bio[i],k=lcl[i];let c;
  if(v<0.02||k<=0)c=alt[i]<G.seaLevel?[12,16,44]:[26,24,32];
  else{const fam=LIFE_COLORS[k]||LIFE_COLORS[1];c=mix([14,16,30],fam,clamp(0.4+v*0.7,0,1));}
  setPx(i,c[0]|0,c[1]|0,c[2]|0);}
  if(G.civ.on) for(const ct of G.civ.cities) setPx(idx(ct.x,ct.y),255,235,140);}
let lifeKeySig='';
function updateLifeKey(){const key=document.getElementById('lifeKey');
  if(!key)return;
  if(G.layer!=='life'){if(key.style.display!=='none'){key.style.display='none';lifeKeySig='';}return;}
  const present=new Array(11).fill(false);
  for(let i=0;i<N;i++){if(bio[i]>0.05&&lcl[i]>0)present[lcl[i]]=true;}
  const sig=present.join('');if(sig===lifeKeySig&&key.style.display==='block')return;
  lifeKeySig=sig;key.style.display='block';
  let html='';for(let c=10;c>=1;c--){if(!present[c])continue;const col=LIFE_COLORS[c];
    html+=`<span><i style="background:rgb(${col[0]},${col[1]},${col[2]})"></i>${CLASSES[c]}</span>`;}
  key.innerHTML=html||'<span class="empty">No life yet</span>';}
function renderAir(){for(let i=0;i<N;i++){const cl=cloud[i],m=moist[i];
  const base=alt[i]<G.seaLevel?[16,28,72]:[40,40,56];let c=mix(base,[96,144,200],clamp(m*0.5,0,0.5));c=mix(c,[240,244,252],clamp(cl,0,0.9));
  setPx(i,c[0]|0,c[1]|0,c[2]|0);}}

/* ===== CLOSE-UP TILE DETAIL =====
   At native resolution every cell is one flat pixel; zoomed in that's a big
   blank block. When the on-screen cell grows past DETAIL_MIN we stamp a small,
   abstract motif over each visible terrain tile so it reads as what it is —
   waves, grass blades, tree clumps, a snow-capped peak, dunes, ice floes.
   It fades in with zoom and is skipped entirely when zoomed out (cheap + clean). */
const DETAIL_MIN=15;
function terrainCat(i){
  if(alt[i]<G.seaLevel) return temp[i]<-2?'seaice':'ocean';
  if(temp[i]<-4) return 'glacier';
  if(alt[i]>0.55) return 'mountain';
  const m=moist[i],t=temp[i];
  if(m<0.3&&t>22) return 'desert';
  if(t>20&&m>0.6) return 'jungle';
  if(m>0.45) return 'forest';
  return 'grass';
}
function stampCell(i,sx,sy,w,h){
  const j=seed[i],cat=terrainCat(i);
  const R=(fx,fy,fw,fh,col)=>{pctx.fillStyle=col;
    pctx.fillRect(Math.round(sx+fx*w),Math.round(sy+fy*h),Math.max(1,Math.round(fw*w)),Math.max(1,Math.round(fh*h)));};
  switch(cat){
    case 'ocean':{const c='rgba(176,214,255,0.42)';
      R(0.10+j*0.12,0.27,0.34,0.05,c);R(0.50,0.56+j*0.10,0.32,0.05,c);R(0.18,0.80,0.26,0.05,'rgba(120,170,235,0.38)');break;}
    case 'seaice':{const w_='rgba(238,247,255,0.7)';R(0.14,0.16,0.36,0.22,w_);R(0.52,0.50,0.32,0.24,w_);R(0.30,0.60,0.14,0.12,'rgba(150,182,228,0.5)');break;}
    case 'glacier':{const w_='rgba(245,250,255,0.62)';R(0.10,0.14,0.34,0.20,w_);R(0.50,0.50,0.36,0.22,w_);R(0.42,0.30,0.06,0.42,'rgba(150,182,228,0.5)');break;}
    case 'mountain':{const X=f=>sx+f*w,Y=f=>sy+f*h,d=(j-0.5)*0.12;   // soft jagged ridge, low contrast
      const pts=[[0.04,0.64],[0.22,0.40+d],[0.40,0.58],[0.58,0.32-d],[0.76,0.55],[0.96,0.42]];
      pctx.lineJoin='round';pctx.lineCap='round';
      pctx.strokeStyle='rgba(92,88,106,0.4)';pctx.lineWidth=Math.max(1.5,h*0.05);
      pctx.beginPath();pts.forEach((p,k)=>k?pctx.lineTo(X(p[0]),Y(p[1])):pctx.moveTo(X(p[0]),Y(p[1])));pctx.stroke();break;}
    case 'desert':{const c='rgba(246,224,160,0.48)';
      R(0.10+j*0.10,0.34,0.44,0.05,c);R(0.40,0.55,0.44,0.05,c);R(0.20,0.74,0.30,0.05,c);break;}
    case 'jungle':{const c='rgba(12,52,26,0.58)',hl='rgba(120,205,92,0.42)';
      R(0.14,0.24,0.24,0.28,c);R(0.50,0.32,0.26,0.32,c);R(0.32,0.56,0.24,0.26,c);R(0.64,0.60,0.16,0.20,c);R(0.22,0.28,0.07,0.07,hl);break;}
    case 'forest':{const c='rgba(20,64,32,0.55)';
      R(0.16,0.30,0.24,0.28,c);R(0.54,0.40,0.22,0.28,c);R(0.36,0.54,0.22,0.26,c);break;}
    default:{const c='rgba(26,84,38,0.5)';   // grassland — short blades
      for(let n=0;n<4;n++) R(0.16+n*0.18+j*0.04,0.46-(n&1)*0.08,0.05,0.34,c);}
  }
}
function drawDetail(left,top,vw,vh,ppcX,ppcY){
  const cs=Math.min(ppcX,ppcY); if(cs<DETAIL_MIN) return;
  const alpha=clamp((cs-DETAIL_MIN)/(DETAIL_MIN*0.8),0,1);
  const x0=Math.floor(left),x1=Math.ceil(left+vw),y0=Math.max(0,Math.floor(top)),y1=Math.min(H,Math.ceil(top+vh));
  pctx.save();pctx.globalAlpha=alpha;
  for(let wy=y0;wy<y1;wy++)for(let wx=x0;wx<x1;wx++)
    stampCell(wy*W+(((wx%W)+W)%W),(wx-left)*ppcX,(wy-top)*ppcY,ppcX,ppcY);
  pctx.restore();
}
/* ===== FAUNA SPRITES =====
   Scatter the dominant family's emoji over inhabited tiles — SimEarth-style.
   A cell shows an icon with a probability that rises with its biomass, gated by
   the cell's fixed seed so the scatter is stable (no shimmer) and organic:
   dense where life thrives, sparse at the frontier. Grows as life multiplies and
   spreads through lifeStep. Drawn on the LAND & LIFE maps, fading in with zoom. */
const FAUNA_MIN=16;
function fract(v){return v-Math.floor(v);}
function drawFauna(left,top,vw,vh,ppcX,ppcY){
  const cs=Math.min(ppcX,ppcY); if(cs<FAUNA_MIN) return;
  const alpha=clamp((cs-FAUNA_MIN)/(FAUNA_MIN*0.7),0,1);
  const x0=Math.floor(left),x1=Math.ceil(left+vw),y0=Math.max(0,Math.floor(top)),y1=Math.min(H,Math.ceil(top+vh));
  pctx.save();pctx.globalAlpha=alpha;
  pctx.textAlign='center';pctx.textBaseline='middle';
  pctx.shadowColor='rgba(0,0,0,0.5)';pctx.shadowBlur=Math.max(1,cs*0.1);
  pctx.font=Math.round(cs*0.8)+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  for(let wy=y0;wy<y1;wy++)for(let wx=x0;wx<x1;wx++){
    const i=wy*W+(((wx%W)+W)%W),k=lcl[i],b=bio[i];
    if(k<=0||b<=0.06) continue;
    if(seed[i]>=clamp((b-0.06)/0.55,0,1)*0.55) continue;        // scatter density ∝ biomass
    const jx=(seed[i]-0.5)*0.32,jy=(fract(seed[i]*7.31)-0.5)*0.32;
    pctx.fillText(CLASS_ICON[k]||'•',Math.round((wx-left+0.5+jx)*ppcX),Math.round((wy-top+0.5+jy)*ppcY));
  }
  pctx.restore();
}
function render(){
  if(G.layer==="climate")renderClimate(); else if(G.layer==="life")renderLife(); else if(G.layer==="air")renderAir(); else renderTerrain();
  octx.putImageData(img,0,0); pctx.imageSmoothingEnabled=false;
  pctx.clearRect(0,0,planet.width,planet.height);
  const pw=planet.width,ph=planet.height,z=cam.zoom,vw=W/z,vh=H/z;
  const left=cam.cx-vw/2,top=clamp(cam.cy-vh/2,0,Math.max(0,H-vh));
  const fullW=pw*z,fullH=ph*z,baseX=-left*(pw/vw),baseY=-top*(ph/vh),ppcX=pw/vw,ppcY=ph/vh;
  // three horizontal copies cover the east/west wrap-around seam
  for(let ox=-1;ox<=1;ox++) pctx.drawImage(off,0,0,W,H,baseX+ox*fullW,baseY,fullW,fullH);
  if(G.layer==="terrain"){drawDetail(left,top,vw,vh,ppcX,ppcY);drawFauna(left,top,vw,vh,ppcX,ppcY);}
  else if(G.layer==="life") drawFauna(left,top,vw,vh,ppcX,ppcY);
  updateLifeKey();
}
function fit(){const r=planet.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  planet.width=Math.max(1,Math.round(r.width*dpr));planet.height=Math.max(1,Math.round(r.height*dpr));}
window.addEventListener('resize',()=>{fit();render();});

/* CAMERA — the viewport into the world. zoom=1 shows the whole planet (the old
   behavior); higher zoom moves the eye closer. The world wraps horizontally, so
   the camera pans freely east/west and is clamped north/south. */
const DEFAULT_ZOOM=3.5,MIN_ZOOM=1,MAX_ZOOM=12;
const cam={zoom:DEFAULT_ZOOM,cx:W/2,cy:H/2};
function clampCam(){
  cam.zoom=clamp(cam.zoom,MIN_ZOOM,MAX_ZOOM);
  const viewH=H/cam.zoom;
  cam.cy=clamp(cam.cy,viewH/2,H-viewH/2);
  cam.cx=((cam.cx%W)+W)%W;
}
function resetCam(){cam.zoom=DEFAULT_ZOOM;cam.cx=W/2;cam.cy=H/2;clampCam();}
/* Zoom by `ratio` while keeping the world point under fractional screen coords
   (fx,fy) ∈ [0,1] pinned in place — the natural "zoom toward the cursor/pinch". */
function zoomAt(fx,fy,ratio){
  const z0=cam.zoom,vw0=W/z0,vh0=H/z0;
  const left0=cam.cx-vw0/2,top0=clamp(cam.cy-vh0/2,0,Math.max(0,H-vh0));
  const wx=left0+fx*vw0,wy=top0+fy*vh0;
  cam.zoom=clamp(z0*ratio,MIN_ZOOM,MAX_ZOOM);
  const vw1=W/cam.zoom,vh1=H/cam.zoom;
  cam.cx=wx-fx*vw1+vw1/2;cam.cy=wy-fy*vh1+vh1/2;
  clampCam();
}

const dock=document.getElementById('dock'),hintEl=document.getElementById('hint');
TOOLS.forEach(t=>{const b=document.createElement('button');
  b.className='tool'+(t.id==='inspect'?' on':'');b.dataset.tool=t.id;
  b.innerHTML=`<span class="ic">${t.ic}</span><span class="nm">${t.nm}</span>`+(t.cost?`<span class="cost">${t.cost}</span>`:'');
  b.addEventListener('click',()=>selectTool(t.id));dock.appendChild(b);});
const faunaBar=document.getElementById('faunaBar');
function buildFaunaBar(){faunaBar.innerHTML='';
  FAMILIES.forEach(f=>{const b=document.createElement('button');
    b.className='fchip'+(f.key===G.faunaPick?' on':'');b.dataset.fam=f.key;
    const col=LIFE_COLORS[f.cls];
    b.innerHTML=`<i style="background:rgb(${col[0]},${col[1]},${col[2]})"></i><span class="fe">${f.ic}</span><span class="fn">${f.nm}</span>`;
    b.addEventListener('click',()=>{G.faunaPick=f.key;updateFaunaBar();updateHintFauna();});
    faunaBar.appendChild(b);});}
function updateFaunaBar(){[...faunaBar.children].forEach(b=>b.classList.toggle('on',b.dataset.fam===G.faunaPick));}
function updateHintFauna(){const f=famByKey(G.faunaPick);
  hintEl.innerHTML=`<b>${f.nm}:</b> tap where it can live — needs <span class="hot">${HAB_TXT[f.hab]}</span>, O₂ ≥ ${O2_NEED[f.cls]}%`;}
function selectTool(id){G.tool=id;
  document.querySelectorAll('.tool').forEach(el=>el.classList.toggle('on',el.dataset.tool===id));
  faunaBar.style.display=id==='fauna'?'flex':'none';
  if(id==='fauna'){updateFaunaBar();updateHintFauna();}
  else hintEl.innerHTML=TOOLS.find(x=>x.id===id).hint;}
function cellFromEvent(e){const r=planet.getBoundingClientRect();
  const px=(e.touches?e.touches[0].clientX:e.clientX)-r.left,py=(e.touches?e.touches[0].clientY:e.clientY)-r.top;
  const z=cam.zoom,vw=W/z,vh=H/z;
  const left=cam.cx-vw/2,top=clamp(cam.cy-vh/2,0,Math.max(0,H-vh));
  const wx=left+(px/r.width)*vw,wy=top+(py/r.height)*vh;
  const x=((Math.floor(wx)%W)+W)%W,y=clamp(Math.floor(wy),0,H-1);
  return{x,y,i:idx(x,y)};}
let applyTimer=0;
function applyTool(cell,isTap){const{x,y,i}=cell,T=G.tool;
  if(T==='inspect'){inspectCell(i);return;}
  const def=TOOLS.find(t=>t.id===T),now=performance.now();
  if(!isTap&&now-applyTimer<70){brushGeometry(T,x,y);return;}
  if(G.energy<def.cost){if(isTap)hintEl.innerHTML="<span class='hot'>Not enough energy</span> — let the world breathe.";return;}
  switch(T){
    case 'raise':brushAlt(x,y,0.18);break;
    case 'lower':brushAlt(x,y,-0.18);break;
    case 'water':brushField(moist,x,y,0.4,1);break;
    case 'seed':brushSeed(x,y);break;
    case 'fauna':if(!placeFauna(x,y,false))return;break;
    case 'volcano':doVolcano(x,y);break;
    case 'meteor':doMeteor(x,y);break;
    case 'co2up':G.co2*=1.18;G.co2+=120;toast("CO₂ injected — the air thickens");break;
    case 'co2dn':G.co2*=0.84;toast("CO₂ scrubbed — the sky thins");break;
    case 'city':doNurture(x,y);break;}
  G.energy-=def.cost;applyTimer=now;render();updateUI();}
function brushGeometry(T,x,y){
  if(T==='raise'){if(spend(1))brushAlt(x,y,0.10);}
  else if(T==='lower'){if(spend(1))brushAlt(x,y,-0.10);}
  else if(T==='water'){if(spend(1))brushField(moist,x,y,0.25,1);}
  else if(T==='seed'){if(spend(2))brushSeed(x,y);}
  else if(T==='fauna'){if(G.energy>=2&&placeFauna(x,y,true))G.energy-=2;}
  render();}
function placeFauna(cx,cy,silent){
  const f=famByKey(G.faunaPick),c=f.cls;
  if(G.o2<O2_NEED[c]){if(!silent)toast(f.nm+" need O₂ ≥ "+O2_NEED[c]+"% (now "+G.o2.toFixed(1)+"%)");return false;}
  let placed=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const j=idx(cx+dx,clamp(cy+dy,0,H-1)),isLand=alt[j]>=G.seaLevel,t=temp[j],m=moist[j];let ok;
    if(f.hab==='sea')ok=!isLand&&t>-6&&t<78;
    else if(f.hab==='wetland')ok=isLand&&m>0.25&&t>-4&&t<45;
    else if(f.hab==='land')ok=isLand&&t>-5&&t<55&&m>0.05;
    else ok=isLand?(t>-8&&m>0.05):(t>-6&&t<80);
    if(ok){bio[j]=clamp(Math.max(bio[j],(dx||dy)?0.55:0.8),0,1);if(lcl[j]<c)lcl[j]=c;placed++;}
  }
  if(placed===0){if(!silent)toast(f.nm+" can't settle there — needs "+HAB_TXT[f.hab]);return false;}
  if(!G.abiogenesis)G.abiogenesis=true;
  if(c>G.maxClass){G.maxClass=c;announceClass(c);}
  return true;}
function spend(c){if(G.energy>=c){G.energy-=c;return true;}return false;}
function brushAlt(cx,cy,amt){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const j=idx(cx+dx,clamp(cy+dy,0,H-1)),f=(dx||dy)?0.5:1;alt[j]=clamp(alt[j]+amt*f,-1,1);if(alt[j]>=0&&moist[j]>0.9)moist[j]=0.6;}}
function brushField(arr,cx,cy,amt,mx){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const j=idx(cx+dx,clamp(cy+dy,0,H-1));arr[j]=clamp(arr[j]+amt*((dx||dy)?0.5:1),0,mx);}}
function brushSeed(cx,cy){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const j=idx(cx+dx,clamp(cy+dy,0,H-1));if((alt[j]<G.seaLevel)||(temp[j]>-8&&moist[j]>0.1)){bio[j]=clamp(bio[j]+0.5,0,1);if(lcl[j]===0)lcl[j]=1;}}
  if(!G.abiogenesis){G.abiogenesis=true;G.maxClass=Math.max(G.maxClass,1);}}
function doVolcano(cx,cy){alt[idx(cx,cy)]=clamp(alt[idx(cx,cy)]+0.7,-1,1);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const j=idx(cx+dx,clamp(cy+dy,0,H-1));alt[j]=clamp(alt[j]+0.25,-1,1);temp[j]+=20;bio[j]*=0.3;}
  G.co2+=240;G.ch4+=0.02;toast("Eruption — new land, ash & CO₂");}
function doMeteor(cx,cy){for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  if(Math.hypot(dx,dy)>2.4)continue;const j=idx(cx+dx,clamp(cy+dy,0,H-1));alt[j]=clamp(alt[j]-0.5,-1,1);bio[j]=0;lcl[j]=0;}
  G.avgTemp-=10;
  for(let k=0;k<600;k++){const i=(Math.random()*N)|0;bio[i]*=0.5;if(lcl[i]>5&&Math.random()<0.4)lcl[i]=Math.max(1,lcl[i]-2);}
  G.maxClass=0;for(let i=0;i<N;i++)if(lcl[i]>G.maxClass)G.maxClass=lcl[i];lastClass=G.maxClass;
  toast("Impact! Dust shrouds the sky — a mass extinction");}
function doNurture(cx,cy){const i=idx(cx,cy);
  if(alt[i]<G.seaLevel){hintEl.innerHTML="<span class='hot'>Needs dry land</span> — a mind can't wake in the sea.";return;}
  if(G.o2<14){hintEl.innerHTML="<span class='hot'>Air too thin</span> — get O₂ above 14% first.";G.energy+=8;return;}
  bio[i]=1;lcl[i]=10;if(!G.civ.on)maybeStartCiv();
  else{G.civ.cities.push({x:cx,y:cy});G.civ.pop=clamp(G.civ.pop+0.3,0,6);toast("A new city rises");}}
function inspectCell(i){
  const surf=alt[i]<G.seaLevel?(temp[i]<-2?"Sea ice":"Ocean"):(temp[i]<-4?"Glacier":alt[i]>0.55?"Mountain":moist[i]<0.3&&temp[i]>22?"Desert":temp[i]>20&&moist[i]>0.6?"Rainforest":moist[i]>0.45?"Forest":"Grassland");
  const life=lcl[i]?CLASSES[lcl[i]]+" "+(bio[i]*100|0)+"%":"no life";
  hintEl.innerHTML=`<b>${surf}</b> · ${temp[i].toFixed(0)}°C · ${(moist[i]*100|0)}% wet · ${life}`;}

let drawing=false,pendingTap=null;
/* Survey applies instantly; world-editing tools defer their first hit until a
   drag or release, so dropping a second finger to pinch never paints a tile. */
function pdown(e){e.preventDefault();drawing=true;pendingTap=null;
  if(G&&G.tool==='inspect')applyTool(cellFromEvent(e),true);else pendingTap=cellFromEvent(e);}
function pmove(e){if(!drawing)return;e.preventDefault();
  if(G.tool==='inspect'){inspectCell(cellFromEvent(e).i);return;}
  if(pendingTap){applyTool(pendingTap,true);pendingTap=null;return;}
  applyTool(cellFromEvent(e),false);}
function pup(){if(pendingTap){applyTool(pendingTap,true);pendingTap=null;}drawing=false;}

/* Pinch-to-zoom & two-finger pan. */
let pinch=null;
function pinchInfo(e){const t0=e.touches[0],t1=e.touches[1],r=planet.getBoundingClientRect();
  return{dist:Math.hypot(t1.clientX-t0.clientX,t1.clientY-t0.clientY),
    mx:(t0.clientX+t1.clientX)/2-r.left,my:(t0.clientY+t1.clientY)/2-r.top,rw:r.width,rh:r.height};}
function touchStart(e){
  if(e.touches.length>=2){e.preventDefault();drawing=false;pendingTap=null;const p=pinchInfo(e);pinch={dist:p.dist,mx:p.mx,my:p.my};return;}
  pdown(e);}
function touchMove(e){
  if(pinch){e.preventDefault();const p=pinchInfo(e),z=cam.zoom,vw=W/z,vh=H/z;
    cam.cx-=(p.mx-pinch.mx)/p.rw*vw;cam.cy-=(p.my-pinch.my)/p.rh*vh;          // pan with the midpoint
    zoomAt(p.mx/p.rw,p.my/p.rh,p.dist/(pinch.dist||p.dist));                  // zoom about the midpoint
    pinch.dist=p.dist;pinch.mx=p.mx;pinch.my=p.my;render();return;}
  pmove(e);}
function touchEnd(e){
  if(pinch){if(e.touches.length<2)pinch=null;if(e.touches.length===0)drawing=false;return;}
  pup(e);}
planet.addEventListener('touchstart',touchStart,{passive:false});
planet.addEventListener('touchmove',touchMove,{passive:false});
planet.addEventListener('touchend',touchEnd);
planet.addEventListener('touchcancel',touchEnd);
planet.addEventListener('mousedown',pdown);
planet.addEventListener('mousemove',pmove);
window.addEventListener('mouseup',pup);
planet.addEventListener('wheel',e=>{e.preventDefault();const r=planet.getBoundingClientRect();
  zoomAt((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,e.deltaY<0?1.12:1/1.12);render();},{passive:false});
document.querySelectorAll('.lay').forEach(b=>b.addEventListener('click',()=>{
  G.layer=b.dataset.layer;document.querySelectorAll('.lay').forEach(x=>x.classList.toggle('on',x===b));render();}));

function fmt(n,d=0){return n>=10000?(n/1000).toFixed(1)+"k":n.toFixed(d);}
function eraName(){if(G.civ.on)return"Civ · "+TECH_AGES[G.civ.age];const c=G.maxClass;
  if(!G.abiogenesis)return G.solar<0.8?"Hadean":"Pre-biotic";
  if(c<=1)return"Archean";if(c<=2)return"Proterozoic";if(c<=4)return"Cambrian";
  if(c<=5)return"Paleozoic";if(c<=6)return"Devonian";if(c<=8)return"Mesozoic";return"Cenozoic";}
function clockStr(){if(G.civ.on)return"Yr "+fmt(2000+G.civ.tech*8000);return clamp(4.5-G.t*0.0016,0,4.6).toFixed(2)+" BYA";}
function updateUI(){
  document.getElementById('v-era').textContent=eraName();
  document.getElementById('v-clk').textContent=clockStr();
  const tt=document.getElementById('v-temp');tt.innerHTML=G.avgTemp.toFixed(0)+'<small>°C</small>';
  tt.style.color=G.avgTemp>40?'var(--red)':G.avgTemp<-5?'var(--cyan)':'var(--yellow)';
  document.getElementById('v-co2').innerHTML=fmt(G.co2)+'<small> ppm</small>';
  document.getElementById('v-o2').innerHTML=G.o2.toFixed(1)+'<small>%</small>';
  document.getElementById('v-life').innerHTML=(G.biomass*100).toFixed(0)+'<small>%</small>';
  document.getElementById('enFill').style.width=(G.energy/G.energyMax*100)+'%';
  document.getElementById('enNum').textContent=Math.floor(G.energy);
  updateBiowin();
  if(monOpen||document.body.classList.contains('wide'))updateMonitors();}
const toastEl=document.getElementById('toast');let toastT=0;
function toast(m){toastEl.textContent=m;toastEl.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(()=>toastEl.style.opacity=0,2600);}

const evoEl=document.getElementById('evo'),flashEl=document.getElementById('flash');let evoT=0;
function showMilestone(tag,icon,title,sub,foot,rgb){
  evoEl.style.setProperty('--fam',rgb);
  evoEl.innerHTML=`<div class="et">★ ${tag} ★</div><div class="ei">${icon}</div>`+
    `<div class="en">${title}</div><div class="ed">${sub}</div><div class="ee">${foot}</div>`;
  evoEl.classList.add('show');
  flashEl.classList.remove('go');void flashEl.offsetWidth;flashEl.classList.add('go');
  clearTimeout(evoT);evoT=setTimeout(()=>evoEl.classList.remove('show'),3800);
}
function milestone(c,banner){const col=LIFE_COLORS[c]||[255,225,77];
  showMilestone(banner||'NEW LIFEFORM',CLASS_ICON[c]||'✶',CLASSES[c].toUpperCase(),CLASS_DESC[c],eraName()+' ERA',`rgb(${col[0]},${col[1]},${col[2]})`);}
function civMilestone(age){showMilestone('CIVILIZATION',TECH_ICON[age],TECH_AGES[age].toUpperCase()+' AGE',TECH_DESC[age],clockStr(),'rgb(120,200,255)');}
evoEl.addEventListener('click',()=>evoEl.classList.remove('show'));

const biowin=document.getElementById('biowin'),biIc=biowin.querySelector('.bi'),biBx=biowin.querySelector('.bx');
function updateBiowin(){
  let top=0;for(let i=0;i<N;i++) if(bio[i]>0.05&&lcl[i]>top) top=lcl[i];
  if(G.civ.on) top=10;
  if(top<=0){biowin.style.display='none';return;}
  biowin.style.display='flex';
  const b=G.biomass;const status=b>0.4?'Thriving':b>0.2?'Established':b>0.08?'Lightly inhabited':'Sparse';
  biIc.textContent=CLASS_ICON[top];
  biBx.innerHTML=`<b>${CLASSES[top]}</b><small>${status}</small>`;
}

const playBtn=document.getElementById('play');
playBtn.addEventListener('click',()=>{G.paused=!G.paused;playBtn.textContent=G.paused?'▶':'❚❚';playBtn.classList.toggle('paused',G.paused);});
document.querySelectorAll('.spd').forEach(b=>b.addEventListener('click',()=>{
  G.speed=+b.dataset.spd;document.querySelectorAll('.spd').forEach(x=>x.classList.toggle('on',x===b));}));
document.getElementById('newBtn').addEventListener('click',()=>document.getElementById('modal').classList.remove('hidden'));

const monitors=document.getElementById('monitors');let monOpen=false;
document.getElementById('monBtn').addEventListener('click',()=>{monOpen=true;monitors.classList.add('open');updateMonitors();});
document.getElementById('monClose').addEventListener('click',()=>{monOpen=false;monitors.classList.remove('open');});
function spark(id,data,color){const cv=document.getElementById(id),dpr=Math.min(window.devicePixelRatio||1,2);
  const w=cv.clientWidth||140,h=42;cv.width=w*dpr;cv.height=h*dpr;const x=cv.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,w,h);
  if(data.length<2)return;let mn=Math.min(...data),mx=Math.max(...data);if(mx-mn<1e-6){mx+=1;mn-=1;}
  x.beginPath();data.forEach((v,k)=>{const px=2+(k/(data.length-1))*(w-4),py=h-2-((v-mn)/(mx-mn))*(h-4);k?x.lineTo(px,py):x.moveTo(px,py);});
  x.strokeStyle=color;x.lineWidth=2;x.stroke();x.lineTo(w-2,h-2);x.lineTo(2,h-2);x.closePath();x.globalAlpha=.14;x.fillStyle=color;x.fill();x.globalAlpha=1;}
function updateMonitors(){
  spark('g-temp',G.log.temp,'#ffe14d');spark('g-co2',G.log.co2,'#ff6fe0');spark('g-o2',G.log.o2,'#54ffff');spark('g-bio',G.log.bio,'#5dff67');
  document.getElementById('g-temp-v').textContent=G.avgTemp.toFixed(1);
  document.getElementById('g-co2-v').textContent=fmt(G.co2);
  document.getElementById('g-o2-v').textContent=G.o2.toFixed(1);
  document.getElementById('g-bio-v').textContent=(G.biomass*100).toFixed(0)+'%';
  const co2pct=clamp(G.co2/10000*100,0.1,80),o2=G.o2,ch4=clamp(G.ch4*10,0,10),n2=Math.max(0,100-o2-co2pct-ch4);
  const parts=[["N₂",n2,"#3a4a78"],["O₂",o2,"#54ffff"],["CO₂",co2pct,"#ff6fe0"],["CH₄",ch4,"#5dff67"]];
  const tot=parts.reduce((s,p)=>s+p[1],0)||1;
  const bar=document.getElementById('atmoBar');bar.innerHTML='';const leg=document.getElementById('atmoLeg');leg.innerHTML='';
  parts.forEach(p=>{const w=p[1]/tot*100;const d=document.createElement('div');d.style.width=w+'%';d.style.background=p[2];d.textContent=w>9?p[0]:'';bar.appendChild(d);
    const s=document.createElement('span');s.innerHTML=`<i class="dot" style="background:${p[2]}"></i>${p[0]} ${p[1].toFixed(p[0]==='CO₂'?0:1)}${p[0]==='CO₂'?' (scaled)':'%'}`;leg.appendChild(s);});
  const lad=document.getElementById('ladder');lad.innerHTML='';
  for(let c=1;c<=10;c++){const r=document.createElement('div');r.className='rung'+(c<=G.maxClass?' reached':'')+(c===G.maxClass?' current':'');
    r.innerHTML=`<span class="rn">${c}</span><span>${CLASSES[c]}</span>`;lad.appendChild(r);}
  const cb=document.getElementById('civBox');
  if(!G.civ.on){cb.textContent=G.maxClass>=9?"Mammals abound — sentience may be near. Keep the climate steady.":"No sentient life has emerged yet.";}
  else{const c=G.civ,mood=c.mood>0.8?'<span class="good">thriving</span>':c.mood>0.4?'stable':'<span class="warn">in crisis</span>';
    cb.innerHTML=`Age: <b>${TECH_AGES[c.age]}</b> · Tech: <b>${(c.tech*100|0)}%</b><br>`+
      `Population: <b>${(c.pop*1.6).toFixed(1)} bn</b> · Cities: <b>${c.cities.length}</b><br>`+
      `Society is ${mood}. Pollution: <b class="${c.pollution>1?'warn':''}">${(c.pollution*100|0)}</b><br>`+
      (c.exodus?'<span class="good">★ Exodus achieved — they have left for the stars.</span>':(c.age>=3&&c.age<=4?'<span class="warn">⚠ Industrial carbon is heating the world.</span>':'Watch the carbon and the thermometer.'));}
}

let lastT=0,frameUI=0,simAcc=0;
const MAX_STEPS=10,ENERGY_PER_SEC=6;
/* Adaptive pace, like SimEarth: the lifeless GEOLOGIC era flies by ("millions of
   years in seconds"), then EVOLUTION and CIVILIZATION run slow & contemplative.
   Values are base ticks/second at speed ×1; the speed buttons multiply them. */
const TPS_GEOLOGIC=11, TPS_LIFE_EARLY=4.5, TPS_LIFE_LATE=2.4, TPS_CIV=4.5;
function simRate(){
  if(G.civ.on) return TPS_CIV;                  // years matter — slowest
  if(!G.abiogenesis) return TPS_GEOLOGIC;        // pre-life — fastest
  return lerp(TPS_LIFE_EARLY,TPS_LIFE_LATE,clamp(G.maxClass/10,0,1)); // life: slows as it grows complex
}
function loop(ts){requestAnimationFrame(loop);if(!G||!G.started){lastT=ts;return;}
  const real=Math.min(0.1,(ts-lastT)/1000||0);lastT=ts;
  if(!G.paused){
    G.energy=clamp(G.energy+real*ENERGY_PER_SEC,0,G.energyMax);  // real-time, independent of sim pace
    simAcc+=real*simRate()*G.speed;
    let steps=simAcc|0;
    if(steps>0){simAcc-=steps;if(steps>MAX_STEPS)steps=MAX_STEPS;
      for(let s=0;s<steps;s++)tick(1.0);render();}
  }
  frameUI+=real;if(frameUI>0.1){updateUI();frameUI=0;}}
requestAnimationFrame(loop);

const modal=document.getElementById('modal'),scenList=document.getElementById('scenList');
Object.entries(SCENARIOS).forEach(([key,s])=>{const b=document.createElement('button');b.className='sbtn';
  b.innerHTML=`<span class="se">${s.emoji}</span><span class="sx"><b>${s.name}</b><small>${s.desc}</small></span>`;
  b.addEventListener('click',()=>startGame(key));scenList.appendChild(b);});
function startGame(key){modal.classList.add('hidden');
  G=freshGlobal();G.scenario=key;lastClass=0;SCENARIOS[key].init();
  for(let i=0;i<6;i++)climateStep(2);
  G.biomass=sumBio();if(G.maxClass>0)lastClass=G.maxClass;if(G.maxClass>=10)maybeStartCiv();
  G.started=true;G.paused=false;playBtn.textContent='❚❚';playBtn.classList.remove('paused');
  buildFaunaBar();selectTool('inspect');fit();resetCam();render();updateUI();
  toast(SCENARIOS[key].name+" loaded — shape your world");}

G=freshGlobal();fit();
