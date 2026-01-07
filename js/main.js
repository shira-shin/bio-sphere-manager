  import {makeDraggable} from './ui/Draggable.js';
  import Vegetation from './Vegetation.js';

  // --- UTILITIES ---
  function createRng(seedStr){
    let h=1779033703^seedStr.length; for(let i=0;i<seedStr.length;i++){h=Math.imul(h^seedStr.charCodeAt(i),3432918353); h=h<<13|h>>>19;}
    return function(){h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909); const t=(h^h>>>16)>>>0; return (t>>>0)/4294967296;};
  }
  function createPerlin(rng){
    const grad=[]; for(let i=0;i<256;i++){const a=rng()*2*Math.PI; grad.push({x:Math.cos(a),y:Math.sin(a)});} const perm=new Uint8Array(512); const base=[...Array(256).keys()];
    for(let i=0;i<256;i++){const j=Math.floor(rng()*base.length); const v=base.splice(j,1)[0]; perm[i]=v; perm[i+256]=v;}
    const lerp=(a,b,t)=>a+(b-a)*t; const fade=t=>t*t*t*(t*(t*6-15)+10);
    function dot(ix,iy,x,y){const g=grad[perm[(ix+perm[iy&255])&255]]; return (x-ix)*g.x+(y-iy)*g.y;}
    function noise(x,y){const ix=Math.floor(x), iy=Math.floor(y); const fx=x-ix, fy=y-iy; const u=fade(fx), v=fade(fy);
      const n00=dot(ix,iy,x,y), n10=dot(ix+1,iy,x,y), n01=dot(ix,iy+1,x,y), n11=dot(ix+1,iy+1,x,y);
      return lerp(lerp(n00,n10,u), lerp(n01,n11,u), v)*0.5+0.5; }
    return {noise};
  }
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const MOVEMENT_SCALE=0.58; // 全体の移動速度をさらに抑えて広いマップでゆったり動くようにする
  const clampRange=(v,min,max)=>{ if(!Number.isFinite(v)) return (min+max)/2; return Math.max(min, Math.min(max, v)); };
  const lerp=(a,b,t)=>a+(b-a)*t;
  const wrap=(v,max)=>{ if(!Number.isFinite(v)) return 0; return ((v%max)+max)%max; };
  const torusDelta=(a,b,size)=>{ const d=((a-b+size/2)%size)-size/2; return Number.isFinite(d)?d:0; };
  const safeNorm=(x,y)=>{const d=Math.hypot(x,y); if(!Number.isFinite(d) || d<1e-9) return null; return d;};
  const OVERLAY_OPTIONS=['animals_all','animals_filter','density_heatmap','base','river','moisture','cover','vegetation_total','vegetation_grass','vegetation_poison','vegetation_tree'];
  const toId=str=>str.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||`sp_${Date.now()}`;
  const parseDiet=str=>{ const [g,p,s,t]=str.split(',').map(v=>parseFloat(v)||0); return {grass:clamp01(g||0), poison:clamp01(p||0), shrub:clamp01(s||0), tree:clamp01(t||0)}; };
  const BIOMES={
    wetland:{label:'湿原', color:'#2f5b4f', moveCost:1.05, vegBias:{grass:0.2, poison:0.1, shrub:0.18, thorn:0.08, tree:0.12}, growth:{grass:1.1, shrub:1.05, tree:0.95}, particles:'#5ec4b1'},
    marsh:{label:'沼地', color:'#31526c', moveCost:1.2, vegBias:{grass:0.16, poison:0.14, shrub:0.12, thorn:0.05, tree:0.16}, growth:{grass:1.15, shrub:0.9, tree:0.85}, particles:'#6eb7ff'},
    prairie:{label:'草原', color:'#436d3b', moveCost:0.95, vegBias:{grass:0.28, poison:0.04, shrub:0.14, thorn:0.06, tree:0.08}, growth:{grass:1.05, shrub:0.95, tree:0.85}, particles:'#aee084'},
    shrubland:{label:'低木地', color:'#4b5f3c', moveCost:1.0, vegBias:{grass:0.16, poison:0.08, shrub:0.22, thorn:0.16, tree:0.14}, growth:{grass:0.9, shrub:1.15, tree:1.05}, particles:'#87c46c'},
    forest:{label:'落葉林', color:'#35523f', moveCost:1.05, vegBias:{grass:0.12, poison:0.05, shrub:0.18, thorn:0.1, tree:0.24}, growth:{grass:0.85, shrub:1.05, tree:1.2}, particles:'#74ad78'},
    taiga:{label:'針葉林', color:'#2e4744', moveCost:1.1, vegBias:{grass:0.1, poison:0.06, shrub:0.16, thorn:0.12, tree:0.26}, growth:{grass:0.8, shrub:1.0, tree:1.25}, particles:'#8bd1c8'},
    highland:{label:'高原岩場', color:'#4b4f60', moveCost:1.25, vegBias:{grass:0.12, poison:0.05, shrub:0.18, thorn:0.18, tree:0.1}, growth:{grass:0.75, shrub:0.9, tree:0.55}, particles:'#bcc3d9'},
    snow:{label:'雪原', color:'#6e7c91', moveCost:1.35, vegBias:{grass:0.08, poison:0.04, shrub:0.12, thorn:0.08, tree:0.05}, growth:{grass:0.55, shrub:0.5, tree:0.35}, particles:'#dfe8f5'},
    desert:{label:'砂漠', color:'#8f7b3d', moveCost:1.3, vegBias:{grass:0.06, poison:0.02, shrub:0.08, thorn:0.2, tree:0.02}, growth:{grass:0.45, shrub:0.6, tree:0.2}, particles:'#e7d39c'},
    oasis:{label:'オアシス', color:'#2f6f58', moveCost:1.05, vegBias:{grass:0.18, poison:0.08, shrub:0.14, thorn:0.1, tree:0.2}, growth:{grass:1.1, shrub:1.0, tree:1.05}, particles:'#7fe0c5'},
  };
  const PATTERN_CONFIGS={
    meandering_river:{label:'蛇行河川', elevScale:0.07, wetScale:0.08, riverBias:0, coverBias:0.06, coverNoise:0.12, ruggedPush:0.08, waterOffset:0},
    delta_wetland:{label:'デルタ湿地', elevScale:0.06, wetScale:0.11, riverBias:-0.12, coverBias:0.16, coverNoise:0.1, ruggedPush:0.02, waterOffset:0.06},
    mountain_valley:{label:'山岳渓谷', elevScale:0.045, wetScale:0.065, riverBias:0.15, coverBias:0.12, coverNoise:0.14, ruggedPush:0.18, waterOffset:-0.02},
  };
  function ensureP5Globals(p){
    if(!p) return;
    window.width=p.width; window.height=p.height;
    window.TWO_PI=window.TWO_PI??Math.PI*2;
    if(typeof window.random!=='function') window.random=(min,max)=>{
      if(typeof max==='undefined'){ return typeof min==='undefined'?p.random():p.random(min); }
      return p.random(min,max);
    };
    if(typeof window.constrain!=='function') window.constrain=(n,low,high)=>Math.min(Math.max(n,low),high);
    if(typeof window.map!=='function') window.map=(n,a,b,c,d)=>c+(d-c)*((n-a)/(b-a));
    if(typeof window.cos!=='function') window.cos=Math.cos;
    if(typeof window.sin!=='function') window.sin=Math.sin;
    if(typeof window.createVector!=='function' && p.createVector) window.createVector=p.createVector.bind(p);
    if(typeof window.noStroke!=='function') window.noStroke=p.noStroke.bind(p);
    if(typeof window.fill!=='function') window.fill=p.fill.bind(p);
    if(typeof window.ellipse!=='function') window.ellipse=p.ellipse.bind(p);
    if(typeof window.push!=='function') window.push=p.push.bind(p);
    if(typeof window.pop!=='function') window.pop=p.pop.bind(p);
    if(typeof window.translate!=='function') window.translate=p.translate.bind(p);
    if(typeof window.rotate!=='function') window.rotate=p.rotate.bind(p);
    if(typeof window.triangle!=='function') window.triangle=p.triangle.bind(p);
    if(typeof window.text!=='function') window.text=p.text.bind(p);
    if(typeof window.textSize!=='function') window.textSize=p.textSize.bind(p);
    if(typeof window.textAlign!=='function') window.textAlign=p.textAlign.bind(p);
    if(typeof window.colorMode!=='function') window.colorMode=p.colorMode.bind(p);
  }
  const randomPositionWithinMargin=(rng, w, h)=>{
    const margin=Math.max(0.5, Math.min(w, h)*0.05);
    const usableW=Math.max(0, w-margin*2);
    const usableH=Math.max(0, h-margin*2);
    return {x:usableW>0?margin+rng()*usableW:rng()*w, y:usableH>0?margin+rng()*usableH:rng()*h};
  };
  const isInvalidSpawn=(x,y)=>!Number.isFinite(x)||!Number.isFinite(y)|| (Math.abs(x)<1e-6 && Math.abs(y)<1e-6);
  const createAnimalGrid=()=>Array.from({length:params.gridW*params.gridH},()=>[]);
  const gridIndex=(x,y,boundary)=>{ const w=params.gridW, h=params.gridH; const wrapX=boundary==='wrap'?wrap(x,w):clampRange(x,0,w-1e-3); const wrapY=boundary==='wrap'?wrap(y,h):clampRange(y,0,h-1e-3); return Math.floor(wrapY)*w+Math.floor(wrapX); };
  const registerAnimalToGrid=(animal, state)=>{ const idx=gridIndex(animal.x, animal.y, state.boundaryMode); animal.gridIdx=idx; state.animalGrid[idx].push(animal); };
  const moveAnimalInGrid=(animal, state)=>{ const newIdx=gridIndex(animal.x, animal.y, state.boundaryMode); if(animal.gridIdx===newIdx) return; const cell=state.animalGrid[animal.gridIdx]||[]; const pos=cell.indexOf(animal); if(pos>=0) cell.splice(pos,1); animal.gridIdx=newIdx; state.animalGrid[newIdx].push(animal); };
  const removeAnimalFromGrid=(animal, state)=>{ const cell=state.animalGrid[animal.gridIdx]; if(!cell) return; const idx=cell.indexOf(animal); if(idx>=0) cell.splice(idx,1); };
  const countVegNeighbors=(x,y,cells)=>{
    const w=params.gridW, h=params.gridH; let count=0, density=0;
    for(let dy=-1;dy<=1;dy++){
      for(let dx=-1;dx<=1;dx++){
        if(dx===0 && dy===0) continue;
        const nx=wrap(x+dx,w), ny=wrap(y+dy,h); const veg=cells[ny*w+nx].veg;
        const total=veg.grass+veg.poison+veg.shrub+veg.shrubThorn+veg.tree;
        if(total>0.08) count++; density+=total;
      }
    }
    return {count,density};
  };
  function getNeighbors(animal, state, radius){
    const w=params.gridW, h=params.gridH; const cellRange=Math.ceil(radius); const cx=Math.floor(animal.x), cy=Math.floor(animal.y); const res=[];
    for(let dy=-cellRange; dy<=cellRange; dy++){
      for(let dx=-cellRange; dx<=cellRange; dx++){
        let nx=cx+dx, ny=cy+dy;
        if(state.boundaryMode==='wrap'){ nx=wrap(nx,w); ny=wrap(ny,h);} else { if(nx<0||ny<0||nx>=w||ny>=h) continue; }
        const idx=ny*w+nx; const list=state.animalGrid[idx]; if(!list) continue; list.forEach(o=>{ if(o!==animal && o.alive) res.push(o); });
      }
    }
    return res;
  }
  const STORAGE_KEY='biosphere_custom_species';

  // --- PARTICLE SYSTEM ---
  class Particle{
    constructor({x,y,vx,vy,size=6,life=45,color='#fff',type='spark'}){
      this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.size=size; this.life=life; this.age=0; this.color=color; this.type=type;
    }
    update(){
      this.age++; this.x+=this.vx; this.y+=this.vy; if(this.type==='spark'){ this.vx*=0.96; this.vy*=0.96; this.vy+=0.01; }
      if(this.type==='ring'){ this.size+=0.25; this.vx*=0.9; this.vy*=0.9; }
      if(this.type==='trail'){ this.vx*=0.85; this.vy*=0.85; this.size*=0.98; }
      if(this.type==='dust'){ this.vx*=0.9; this.vy*=0.92; this.vy-=0.003; }
      return this.age<this.life;
    }
    draw(p, cellSize){
      const alpha=Math.max(0,1-this.age/this.life);
      p.push();
      const col=p.color(this.color);
      if(this.type==='ring'){
        p.noFill(); p.stroke(p.red(col), p.green(col), p.blue(col), alpha*180); p.strokeWeight(1.2);
        p.circle(this.x*cellSize, this.y*cellSize, this.size*cellSize*0.6);
      } else if(this.type==='trail'){
        p.noStroke(); p.fill(p.red(col), p.green(col), p.blue(col), alpha*65);
        p.ellipse(this.x*cellSize, this.y*cellSize, this.size*0.7, this.size*0.42);
      } else if(this.type==='dust'){
        p.noStroke(); p.fill(p.red(col), p.green(col), p.blue(col), alpha*120);
        p.circle(this.x*cellSize, this.y*cellSize, this.size*0.9);
      } else {
        p.noStroke(); p.fill(p.red(col), p.green(col), p.blue(col), alpha*200);
        p.circle(this.x*cellSize, this.y*cellSize, this.size);
      }
      p.pop();
    }
  }

  class ParticleSystem{
    constructor(){ this.particles=[]; }
    update(){ this.particles=this.particles.filter(pt=>pt.update()); }
    draw(p, cellSize){ this.particles.forEach(pt=>pt.draw(p, cellSize)); }
    clear(){ this.particles.length=0; }
    burst({x,y,count=10,color='#ff5252',speed=0.8,life=45}){
      for(let i=0;i<count;i++){
        const angle=Math.random()*Math.PI*2; const mag=speed*(0.5+Math.random());
        this.particles.push(new Particle({x,y,vx:Math.cos(angle)*mag, vy:Math.sin(angle)*mag, color, life:life*(0.6+Math.random()*0.6)}));
      }
    }
    ripple({x,y,color='#7ecbff',life=28}){
      this.particles.push(new Particle({x,y,vx:0,vy:0,size:1.4,life,color,type:'ring'}));
    }
    trail({x,y,color='#fff',count=6,spread=0.8,type='trail',life=36}){
      for(let i=0;i<count;i++){
        const ang=Math.random()*Math.PI*2; const mag=(0.15+Math.random()*0.4)*spread;
        this.particles.push(new Particle({x,y,vx:Math.cos(ang)*mag, vy:Math.sin(ang)*mag, size:5+Math.random()*5, life:life*(0.7+Math.random()*0.6), color, type}));
      }
    }
  }

  const particles=new ParticleSystem();

  // --- STATE ---
  const params={gridW:120, gridH:80, cellSize:7};
  const POPULATION_LIMIT=2000;
  const VEG_UPDATE_INTERVAL=30;
  let plants=[];
  const baseSpecies=[
    {id:'proto_herb', name:'草食プロトタイプ', trophic:'herb', color:'#5ac46b', shape:'ellipse', baseSpeed:0.95, vision:5.5, metabolism:0.82, waterNeed:0.75, fertility:0.62, reproThreshold:0.66, reproCost:0.3, socialMode:'herd', preyList:[],
      poisonTolerance:0.55, thornHandling:0.55, climbSkill:0.62, dietPreference:{grass:0.7,poison:0.08,shrub:0.18,tree:0.04}, baseGenes:{color:[90,180,120], aspect:0.95, spikes:0.1, habitat:{water:0.35, forest:0.55, plains:0.7}}},
    {id:'proto_carn', name:'肉食プロトタイプ', trophic:'carn', color:'#e0665c', shape:'arrow', baseSpeed:1.28, vision:6.6, metabolism:0.98, waterNeed:0.68, fertility:0.36, reproThreshold:0.9, reproCost:0.55, socialMode:'solo', preyList:['proto_herb','proto_omn'],
      poisonTolerance:0.32, thornHandling:0.42, climbSkill:0.72, dietPreference:{}, baseGenes:{color:[220,90,80], aspect:1.1, spikes:0.65, habitat:{water:0.65, forest:0.4, plains:0.45}}},
    {id:'proto_omn', name:'雑食プロトタイプ', trophic:'omn', color:'#c59373', shape:'tusk', baseSpeed:1.05, vision:5.6, metabolism:0.92, waterNeed:0.72, fertility:0.5, reproThreshold:0.76, reproCost:0.34, socialMode:'pair', preyList:['proto_herb'],
      poisonTolerance:0.65, thornHandling:0.7, climbSkill:0.78, dietPreference:{grass:0.42,poison:0.12,shrub:0.32,tree:0.14}, baseGenes:{color:[180,140,100], aspect:1.0, spikes:0.35, habitat:{water:0.55, forest:0.55, plains:0.55}}},
  ];
  const parseHexColor=hex=>{
    if(!hex) return null;
    const cleaned=hex.replace('#','');
    if(cleaned.length===3){
      const [r,g,b]=cleaned.split('').map(ch=>parseInt(ch+ch,16));
      return [r,g,b];
    }
    if(cleaned.length===6){
      return [parseInt(cleaned.slice(0,2),16), parseInt(cleaned.slice(2,4),16), parseInt(cleaned.slice(4,6),16)];
    }
    return null;
  };
  const baseGeneSeed=sp=>{
    if(sp?.baseGenes) return sp.baseGenes;
    const rgb=parseHexColor(sp?.color)||[150,170,150];
    return {color:rgb, aspect:1, spikes:sp?.trophic==='carn'?0.5:0.25, habitat:{water:0.5, forest:0.5, plains:0.5}};
  };
  const defaultGenes=(base)=>({
    g_speed:1,
    g_vision:1,
    g_metabolism:1,
    g_fertility:1,
    g_thirstTol:1,
    g_starveTol:1,
    g_colorR:(base?.color?.[0]??160)/255,
    g_colorG:(base?.color?.[1]??160)/255,
    g_colorB:(base?.color?.[2]??160)/255,
    g_aspect:base?.aspect??1,
    g_spikes:base?.spikes??0.3,
    g_habitatWater:base?.habitat?.water??0.5,
    g_habitatForest:base?.habitat?.forest??0.5,
    g_habitatPlains:base?.habitat?.plains??0.5,
  });
  const GENE_KEYS=['g_speed','g_vision','g_metabolism','g_fertility','g_thirstTol','g_starveTol','g_colorR','g_colorG','g_colorB','g_aspect','g_spikes','g_habitatWater','g_habitatForest','g_habitatPlains'];
  const initialUiParams={rainyLen:600,dryLen:400,shareRate:0.6,leaderBonus:1.2, miniMapPos:null, mapColWidth:'minmax(980px,1.15fr)'};
  const presets={
    temperate:{seed:'temperate', pattern:'meandering_river', species:JSON.parse(JSON.stringify(baseSpecies)), counts:{proto_herb:36,proto_carn:10,proto_omn:18}},
    herdFocus:{seed:'herd', pattern:'delta_wetland', species:JSON.parse(JSON.stringify(baseSpecies)).map(sp=>({...sp, fertility:sp.trophic==='herb'?0.78:sp.fertility})), counts:{proto_herb:48,proto_carn:8,proto_omn:22}},
    predatorHeavy:{seed:'predator', pattern:'mountain_valley', species:JSON.parse(JSON.stringify(baseSpecies)).map(sp=>({...sp, socialMode:sp.trophic==='carn'?'pack':sp.socialMode, baseSpeed:sp.trophic==='carn'?sp.baseSpeed*1.05:sp.baseSpeed})), counts:{proto_herb:22,proto_carn:18,proto_omn:14}},
    tutorial:{seed:'tutorial', pattern:'meandering_river', species:JSON.parse(JSON.stringify(baseSpecies)).map(sp=>({...sp, baseSpeed:lerp(0.9,1.1,0.52)})), counts:{proto_herb:28,proto_carn:8,proto_omn:16}},
  };
  function createState(seed){
    return {seed, rng:createRng(seed), perlin:null, cells:[], animals:[], species:JSON.parse(JSON.stringify(baseSpecies)), overlay:'animals_all', overlayAlpha:0.6, overlaySpecies:null, boundaryMode:'bounce',
      running:false, step:0, season:'雨季', seasonCounter:0, events:[], idCounter:0, lastError:null, renderSimple:false, logs:[], chartData:[], averages:[], births:0, deaths:0, kills:0, spawnBuffer:[], density:new Float32Array(params.gridW*params.gridH),
      movedAgents:0, nanAgents:0, zeroMoveStreak:0, vegMin:0, vegMax:0, vegMean:0, vegGrowth:0, vegConsumed:0,
      shannon:0, genetic:0, stability:0, extinction:0, stabilityWindow:[], prevCounts:{},
      animalGrid:[], needsBgRedraw:true, lastRiverCount:0, lastMoistAvg:0, lastVegAvg:0, aliveCount:0, waterLevel:0, showVegetation:true, lastDensity:null,
      layerSettings:{terrain:true, vegetation:true, animals:true, vegetationBoost:1, animalScale:1, animalOpacity:1}, renderEffects:true, hudVisible:true, mapExpanded:false,
      trailIntensity:0.35, currentHazard:null, geneOrigins:{} };
  }
  let state=createState('bs-demo');
  let uiParams={...initialUiParams};

  // --- TERRAIN ---
  function biomeFromCell(c,x,y,perlin){
    const heat=clamp01(0.45 + perlin.noise((x-80)*0.03,(y+60)*0.03)*0.35 + (y/params.gridH-0.5)*0.25);
    const dryness=clamp01(0.6 - c.moist*0.4 + perlin.noise((x+140)*0.05,(y-120)*0.05)*0.2 + Math.max(0,c.elev-0.55)*0.25);
    if(c.river && c.moist>0.6) return 'wetland';
    if(c.moist>0.78) return 'marsh';
    if(c.elev>0.85 && heat<0.45) return 'snow';
    if(c.elev>0.78) return 'highland';
    if(dryness>0.65 && c.moist<0.35) return 'desert';
    if(c.moist>0.65 && heat>0.55 && !c.river) return 'forest';
    if(c.moist>0.58 && heat<0.55) return 'taiga';
    if(c.moist>0.42 && c.moist<0.65) return 'shrubland';
    if(c.moist>0.3) return 'prairie';
    if(c.moist>0.2 && c.river) return 'oasis';
    return 'desert';
  }
  function initVegByBiome(biome,rng){
    const bias=BIOMES[biome]?.vegBias||{};
    return {
      grass:clamp01(0.16+(bias.grass||0)+rng()*0.12),
      poison:clamp01(0.04+(bias.poison||0)+rng()*0.08),
      shrub:clamp01(0.1+(bias.shrub||0)+rng()*0.1),
      shrubThorn:clamp01(0.06+(bias.thorn||0)+rng()*0.08),
      tree:clamp01(0.08+(bias.tree||0)+rng()*0.08),
    };
  }
  function generateTerrain(pattern){
    const waterSlider=document.getElementById('waterLevel'); if(waterSlider){ state.waterLevel=parseFloat(waterSlider.value)||0; }
    const rng=state.rng; const perlin=createPerlin(rng); state.perlin=perlin; const w=params.gridW, h=params.gridH; const arr=new Array(w*h);
    const patternCfg=PATTERN_CONFIGS[pattern]||PATTERN_CONFIGS.meandering_river;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){const idx=y*w+x; arr[idx]={elev:0, wet:0, moist:0.5, river:false, riverWidth:0,
      veg:{grass:0, poison:0, shrub:0, shrubThorn:0, tree:0}, terrain:'平地', biome:'prairie', rugged:0, cover:0};}
    const elevScale=patternCfg.elevScale??0.07; const wetScale=patternCfg.wetScale??0.08;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=y*w+x; const warp=pattern==='meandering_river'?Math.sin(y*0.05)*0.05:0; const elev=perlin.noise(x*elevScale+warp, y*elevScale);
        const wet=perlin.noise((x+100)*wetScale,(y+30)*wetScale);
        arr[idx].elev=clamp01(pattern==='mountain_valley'?Math.pow(elev,1.2):elev);
        arr[idx].wet=clamp01(pattern==='delta_wetland'?Math.min(1,wet*0.75+0.25):wet);
      }
    }
    state.cells=arr; updateRivers(pattern, patternCfg);
  }
  function updateRivers(pattern, patternCfg={}){
    const w=params.gridW, h=params.gridH; let riverFactor=parseFloat(document.getElementById('riverThresh').value)||1.2; const widthCtrl=parseFloat(document.getElementById('riverWidthCtrl').value)||1;
    const waterLevel=parseFloat(state.waterLevel||0) + (patternCfg.waterOffset||0);
    riverFactor+=patternCfg.riverBias||0;
    let riverCount=0;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=y*w+x; const c=state.cells[idx]; const noise=state.perlin.noise((x+200)*0.04,(y+200)*0.04);
        const riverNoise=state.perlin.noise((x+50)*0.07,(y-40)*0.07);
        const meander=Math.sin(y*0.07+x*0.05)*0.08;
        const riverScore=(1-c.elev)*0.9 + c.wet*0.4 + noise*0.4 + riverNoise*0.3 + meander;
        const active=riverScore>riverFactor-waterLevel;
        c.river=active; c.riverWidth=active?clamp01((riverScore-riverFactor)*widthCtrl):0;
        const moistBase=0.32 + c.wet*0.45 + (c.river?0.3:0);
        c.moist=clamp01(moistBase);
        c.terrain=c.elev>0.78?'丘陵':(c.elev<0.25?'低地':'平地');
        c.shore=false;
        if(active) riverCount++;
      }
    }
    // 岸をマーキング
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=y*w+x; const c=state.cells[idx]; if(c.river) continue;
        const nearRiver=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const nx=(x+dx+w)%w, ny=(y+dy+h)%h; return state.cells[ny*w+nx].river;});
        if(nearRiver) c.shore=true;
      }
    }
    // バイオーム付与と植生初期化
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=y*w+x; const c=state.cells[idx];
        const biomeKey=biomeFromCell(c,x,y,state.perlin);
        c.biome=biomeKey; c.terrain=BIOMES[biomeKey]?.label||c.terrain; c.veg=initVegByBiome(biomeKey,state.rng);
      }
    }
    computeRuggedness();
    computeCoverMap(patternCfg);
    if(pattern==='delta_wetland' && riverCount===0){ document.getElementById('riverThresh').value=Math.max(0.6, riverFactor-0.2).toFixed(2); updateRivers(pattern, patternCfg); return; }
    state.needsBgRedraw=true;
  }

  function computeRuggedness(){
    const w=params.gridW, h=params.gridH;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=y*w+x; const c=state.cells[idx];
        let maxDiff=0; let sum=0; let count=0;
        for(let dy=-1; dy<=1; dy++){
          for(let dx=-1; dx<=1; dx++){
            if(dx===0 && dy===0) continue;
            const nx=clampRange(x+dx,0,w-1), ny=clampRange(y+dy,0,h-1); const n=state.cells[ny*w+nx];
            if(!n) continue; const diff=Math.abs(n.elev-c.elev); maxDiff=Math.max(maxDiff,diff); sum+=diff; count++;
          }
        }
        const avgDiff=count?sum/count:0;
        c.rugged=clamp01(Math.max(maxDiff*1.8, avgDiff*2.4));
      }
    }
  }

  function computeCoverMap(patternCfg={}){
    const w=params.gridW, h=params.gridH; const coverNoise=patternCfg.coverNoise||0.12; const coverBias=patternCfg.coverBias||0;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=y*w+x; const c=state.cells[idx];
        const vegDensity=clamp01((c.veg.grass*0.35 + c.veg.shrub*0.55 + c.veg.shrubThorn*0.4 + c.veg.tree*0.75));
        const ruggedBonus=clamp01(c.rugged*0.6 + (c.terrain==='丘陵'?0.2:0) + (patternCfg.ruggedPush||0));
        const wetBonus=c.river?0.3:(c.shore?0.18:0);
        const noise=state.perlin?.noise((x+40)*coverNoise,(y-60)*coverNoise)||0.5;
        const raw=vegDensity + ruggedBonus + wetBonus + (noise-0.5)*0.4 + coverBias;
        c.cover=clamp01(raw);
      }
    }
    // 軽く平滑化して土壌の「隠れ家」帯を作る
    const smooth=new Float32Array(w*h);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        let sum=0, cnt=0;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
          const nx=clampRange(x+dx,0,w-1), ny=clampRange(y+dy,0,h-1); sum+=state.cells[ny*w+nx].cover||0; cnt++; }
        smooth[y*w+x]=sum/Math.max(1,cnt);
      }
    }
    for(let i=0;i<smooth.length;i++){ state.cells[i].cover=clamp01(smooth[i]); }
  }

  // --- SPECIES & ANIMALS ---
  const trophicLabel=t=>t==='herb'?'草食':t==='carn'?'肉食':t==='omn'?'雑食':t;
  function geneLine(label, value, desc){
    const pct=clampRange((value||1)/1.6*100, 8, 100);
    return `<div class="gene-line" title="${desc}"><div class="gene-label">${label}</div><div class="gene-meter"><span style="width:${pct}%"></span></div><div class="gene-value">${value.toFixed(2)}</div><div class="gene-desc">${desc}</div></div>`;
  }
  function resetSpeciesEditor(){
    const host=document.getElementById('speciesEditor'); host.innerHTML=''; const select=document.getElementById('overlaySpecies'); select.innerHTML='';
    state.species.forEach((sp,idx)=>{
      const card=document.createElement('article'); card.className='species-card';
      card.innerHTML=`<div class="species-card__header" style="--accent:${sp.color};"><div class="species-avatar" style="background:${sp.color}">${shapeSymbol(sp.shape)}</div><div class="species-card__title">${sp.name}</div><div class="species-card__meta">${sp.id} / ${trophicLabel(sp.trophic)}</div><div class="species-card__count"><label>個体数<input data-kind="count" data-id="${sp.id}" type="number" min="0" value="20"></label><button data-kind="respawn" data-id="${sp.id}">再スポーン</button></div></div>`;
      const genes=document.createElement('div'); genes.className='gene-lines';
      genes.innerHTML=`${geneLine('移動速度', sp.baseSpeed, '追跡・離脱のしやすさ')}${geneLine('索敵範囲', sp.vision, '食料/敵の検知距離')}${geneLine('代謝コスト', sp.metabolism, '行動ごとの消費倍率')}${geneLine('繁殖閾値', sp.fertility, '繁殖に必要なエネルギー')}${geneLine('水消費率', sp.waterNeed, '渇きやすさと補給頻度')}`;
      const details=document.createElement('details'); details.className='species-editor-detail'; details.innerHTML='<summary>細かいパラメータを編集</summary>';
      details.innerHTML+=`<div class="row" style="margin-top:8px;"><label>移動速度<input data-kind="param" data-field="baseSpeed" data-id="${sp.id}" type="number" step="0.1" value="${sp.baseSpeed}"></label><label>索敵範囲<input data-kind="param" data-field="vision" data-id="${sp.id}" type="number" step="0.1" value="${sp.vision}"></label></div>`;
      details.innerHTML+=`<div class="row" style="margin-top:8px;"><label>代謝コスト<input data-kind="param" data-field="metabolism" data-id="${sp.id}" type="number" step="0.1" value="${sp.metabolism}"></label><label>繁殖閾値<input data-kind="param" data-field="fertility" data-id="${sp.id}" type="number" step="0.05" value="${sp.fertility}"></label><label>水消費率<input data-kind="param" data-field="waterNeed" data-id="${sp.id}" type="number" step="0.05" value="${sp.waterNeed}"></label></div>`;
      card.appendChild(genes); card.appendChild(details); host.appendChild(card);
      const opt=document.createElement('option'); opt.value=sp.id; opt.textContent=sp.name; select.appendChild(opt);
    });
    state.overlaySpecies=select.value;
    renderSpeciesLegend();
  }

  function shapeSymbol(shape){
    switch(shape){
      case 'antler': return '🦌';
      case 'tusk': return '🐗';
      case 'arrow': return '➤';
      case 'round': return '●';
      case 'stripe': return '〰';
      default: return '⬭';
    }
  }

  function renderSpeciesLegend(){
    const list=document.getElementById('speciesLegend'); if(!list) return; list.innerHTML='';
    state.species.forEach(sp=>{
      const li=document.createElement('li'); li.className='legend-species-item';
      const shape=shapeSymbol(sp.shape);
      li.innerHTML=`<span class="legend-swatch" style="background:${sp.color}"></span><span class="legend-shape">${shape}</span><div><div style="font-weight:700; color:#fff;">${sp.name}</div><div style="font-size:11px; color:#9fb0c3;">${sp.id} / ${trophicLabel(sp.trophic)}</div></div>`;
      list.appendChild(li);
    });
  }

  function addCustomSpeciesFromForm(){
    const name=document.getElementById('newSpName').value.trim()||'新種';
    const id=document.getElementById('newSpId').value.trim()||toId(name);
    const trophic=document.getElementById('newSpTrophic').value;
    const color=document.getElementById('newSpColor').value||'#88c0ff';
    const shape=document.getElementById('newSpShape').value;
    const baseSpeed=parseFloat(document.getElementById('newSpSpeed').value)||1;
    const vision=parseFloat(document.getElementById('newSpVision').value)||5;
    const metabolism=parseFloat(document.getElementById('newSpMeta').value)||1;
    const fertility=parseFloat(document.getElementById('newSpFert').value)||0.5;
    const waterNeed=parseFloat(document.getElementById('newSpWater').value)||0.7;
    const poisonTolerance=parseFloat(document.getElementById('newSpPoison').value)||0.5;
    const thornHandling=parseFloat(document.getElementById('newSpThorn').value)||0.5;
    const socialMode=document.getElementById('newSpSocial').value;
    const preyList=document.getElementById('newSpPrey').value.split(',').map(s=>s.trim()).filter(Boolean);
    const diet=parseDiet(document.getElementById('newSpDiet').value||'0.5,0,0.3,0.2');
    const reproDefaults=trophic==='carn'?{threshold:0.88,cost:0.55}:trophic==='omn'?{threshold:0.74,cost:0.34}:{threshold:0.68,cost:0.28};
    const newSp={id,name,trophic,color,shape,baseSpeed,vision,metabolism,fertility,waterNeed,socialMode,preyList,poisonTolerance,thornHandling,climbSkill:0.6,reproThreshold:reproDefaults.threshold,reproCost:reproDefaults.cost,dietPreference:diet};
    state.species.push(newSp);
    resetSpeciesEditor(); spawnAnimals(); logMsg(`種を追加: ${name}`);
  }

  function saveSpeciesLocal(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.species)); logMsg('ローカル保存完了'); } catch(err){ logMsg('保存失敗:'+err.message); } }
  function loadSpeciesLocal(skipSpawn=false){ try{ const txt=localStorage.getItem(STORAGE_KEY); if(txt){ state.species=JSON.parse(txt); resetSpeciesEditor(); if(!skipSpawn) spawnAnimals(); logMsg('保存データ読込'); } else { if(!skipSpawn) logMsg('保存された種はありません'); } } catch(err){ logMsg('読込失敗:'+err.message); } }
  function exportSpeciesJSON(){ try{ const blob=new Blob([JSON.stringify(state.species,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='species.json'; a.click(); } catch(err){ logMsg('Export失敗:'+err.message);} }
  function importSpeciesJSON(){ const txt=prompt('JSONを貼り付け'); if(!txt) return; try{ const parsed=JSON.parse(txt); if(Array.isArray(parsed)){ state.species=parsed; resetSpeciesEditor(); spawnAnimals(); logMsg('JSONから読み込み'); } else { logMsg('配列形式ではありません'); } } catch(err){ logMsg('Import失敗:'+err.message);} }
  function spawnAnimals(){
    state.animals=[]; state.geneOrigins={};
    const counts={}; document.querySelectorAll('#speciesEditor input[data-kind="count"]').forEach(inp=>counts[inp.dataset.id]=parseInt(inp.value||'0'));
    const rng=state.rng; state.species.forEach(sp=>{
        const n=counts[sp.id]??20; const sums={};
        for(let i=0;i<n;i++){
          const seedGenes=createSeedGenes(rng, sp);
        GENE_KEYS.forEach(k=>{sums[k]=(sums[k]||0)+seedGenes[k];});
        state.animals.push(createAnimal(sp, rng, undefined, undefined, seedGenes));
      }
      if(n>0){
        const avg={}; GENE_KEYS.forEach(k=>avg[k]=(sums[k]||0)/n);
        state.geneOrigins[sp.id]=avg;
      }
    });
    state.idCounter=state.animals.length;
    state.animalGrid=createAnimalGrid();
    state.animals.forEach(a=>registerAnimalToGrid(a,state));
    state.aliveCount=state.animals.length;
  }
  function applyPreset(key){
    const preset=presets[key]; if(!preset) return;
    state.seed=preset.seed; state.rng=createRng(state.seed); state.species=JSON.parse(JSON.stringify(preset.species));
    resetSpeciesEditor(); Object.entries(preset.counts).forEach(([id,val])=>{const input=document.querySelector(`#speciesEditor input[data-kind="count"][data-id="${id}"]`); if(input) input.value=val;});
    document.getElementById('seedInput').value=preset.seed;
    const patternSelect=document.getElementById('patternSelect'); if(patternSelect && preset.pattern){ patternSelect.value=preset.pattern; }
    const pattern=patternSelect?.value || document.getElementById('patternSelect').value;
    generateTerrain(pattern); spawnAnimals(); applyLayerSettingsFromUI();
  }
  // FSM states for animal behavior
  const AnimalStates={WANDER:'WANDER', DRINK:'DRINK', EAT:'EAT', MATE:'MATE', AMBUSH:'AMBUSH'};

  class Animal{
    constructor(sp, rng, id, x, y){
      const w=params.gridW, h=params.gridH; this.id=`A${id}`; this.speciesId=sp.id;
      const spawnFallback=isInvalidSpawn(x,y);
      const fallbackPos=randomPositionWithinMargin(rng, w, h);
      const validX=spawnFallback?fallbackPos.x:x;
      const validY=spawnFallback?fallbackPos.y:y;
      if(spawnFallback){ console.warn('Invalid spawn detected. Relocating to safe random position.'); }
      this.x=wrap(validX,w); this.y=wrap(validY,h);
      this.energy=0.8+rng()*0.15; this.hydration=0.8+rng()*0.15; this.age=0; this.sex=rng()<0.5?'F':'M';
      this.behavior='wander'; this.state=AnimalStates.WANDER; this.stateTimer=0; this.lastEvent=spawnFallback?'spawn-relocate':'-';
      this.genes=defaultGenes(baseGeneSeed(sp)); this.history=[]; this.trail=this.history; this.alive=true; this.vx=0; this.vy=0; this.waterCooldown=0; this.target=null;
      this.lastSafeX=this.x; this.lastSafeY=this.y; this.headingX=1; this.headingY=0; this.wanderAngle=rng()*Math.PI*2; this.mateCooldown=0;
      this.reproCooldown=0; this.emote=''; this.emoteTimer=0; this.generation=1; this.lineageId=sp.id;
      this.timeline=[]; this.recordEvent('誕生', '初期配置');
      this.digestTimer=0; this.meatFocus=false;
    }

    getSpecies(){ return state.species.find(s=>s.id===this.speciesId); }

    getColor(){
      if(this.colorGeneCache){ return this.colorGeneCache; }
      const r=clampRange((this.genes?.g_colorR??0.5)*255,0,255);
      const g=clampRange((this.genes?.g_colorG??0.5)*255,0,255);
      const b=clampRange((this.genes?.g_colorB??0.5)*255,0,255);
      this.colorGeneCache=[r,g,b];
      return this.colorGeneCache;
    }

    update(state){
      if(!this.alive) return;
      if(this.digestTimer>0) this.digestTimer--;
      if(this.reproCooldown>0) this.reproCooldown--;
      this.decideState(state);
      this.applyForces(state);
      this.move(state);
      this.consumeAndMetabolize(state);
      this.handleReproduction(state);
      this.history.push({x:this.x,y:this.y}); if(this.history.length>12) this.history.shift();

      const w=params.gridW, h=params.gridH;
      const needsTeleport=()=>{
        if(!Number.isFinite(this.x)||!Number.isFinite(this.y)) return true;
        if(this.x<=0 && this.y<=0) return true;
        return this.x<0 || this.y<0 || this.x> w || this.y> h;
      };
      if(needsTeleport()){
        console.warn("Corner bug detected. Teleporting animal.");
        const rx=state.rng()*w, ry=state.rng()*h;
        this.x=rx; this.y=ry; this.vx=0; this.vy=0; this.lastSafeX=rx; this.lastSafeY=ry; this.lastEvent='corner-teleport';
      }
      if(this.emoteTimer>0) this.emoteTimer--;
    }

    recordEvent(label, detail=''){
      this.timeline=this.timeline||[];
      this.timeline.push({step:state?.step??0, label, detail});
      if(this.timeline.length>12) this.timeline.shift();
    }

    showEmote(icon, duration=60){ this.emote=icon; this.emoteTimer=duration; }

    decideState(state){
      const sp=this.getSpecies(); const genes=this.genes; const rng=state.rng;
      const speed=clampRange(sp.baseSpeed*lerp(0.7,1.3,genes.g_speed)*MOVEMENT_SCALE,0.2,2.2);
      const vision=clampRange(sp.vision*lerp(0.7,1.3,genes.g_vision),2,12);
      this.cached={speed,vision};

      const thirstPct=(1-this.hydration)*100; const hungerPct=(1-this.energy)*100;
      if(this.stateTimer>0) this.stateTimer--;
      if(this.state===AnimalStates.DRINK){
        this.behavior='water';
        if(thirstPct>5) return;
      }
      if(this.state===AnimalStates.AMBUSH && thirstPct>55){ this.state=AnimalStates.DRINK; }
      if(this.stateTimer>0) return;

      const mateThreshold=sp.reproThreshold??0.6;
      const mateReady=this.energy>mateThreshold && thirstPct<35 && this.mateCooldown<=0 && this.reproCooldown<=0;
      const drinkNeed=thirstPct>60 && this.waterCooldown<=0;
      const preyNearby=this.hasPreyNearby(state,vision);
      const plantNearby=this.hasPlantNearby(state);
      const preferPrey=sp.trophic==='carn' || (sp.trophic==='omn' && hungerPct>=70);
      this.meatFocus=preferPrey;
      const foodNearby=this.meatFocus?preyNearby:plantNearby;
      const ambushSpot=sp.trophic==='carn' && hungerPct>45 && thirstPct<55? this.findRiverAmbushSpot(state, vision):null;
      const coverSpot=this.findCoverSpot(state, vision);

      if(this.digestTimer>0 && !drinkNeed && hungerPct<70){
        this.state=AnimalStates.WANDER; this.behavior='digest';
        if(coverSpot){ this.target=coverSpot; this.state=AnimalStates.AMBUSH; this.stateTimer=45; }
        return;
      }

      const prevState=this.state;
      let next=AnimalStates.WANDER;
      if(drinkNeed) next=AnimalStates.DRINK;
      else if((this.meatFocus && preyNearby) || (hungerPct>40 && foodNearby)) next=AnimalStates.EAT;
      else if(ambushSpot) { next=AnimalStates.AMBUSH; this.target=ambushSpot; }
      else if(coverSpot && thirstPct<65){ next=AnimalStates.AMBUSH; this.target=coverSpot; this.behavior='hide'; }
      else if(mateReady) next=AnimalStates.MATE;

      if(next!==prevState){ this.state=next; this.stateTimer=30+Math.floor(rng()*20); this.target=null;
        if(next===AnimalStates.DRINK) this.recordEvent('水場を探す','渇き');
        else if(next===AnimalStates.EAT) this.recordEvent('採食モード','空腹');
        else if(next===AnimalStates.MATE) this.recordEvent('求愛','繁殖行動');
        else if(next===AnimalStates.AMBUSH) this.recordEvent('待ち伏せ','水辺の捕食');
      }
    }

    hasPreyNearby(state, vision){
      const sp=this.getSpecies(); const w=params.gridW, h=params.gridH;
      if(sp.preyList?.length===0) return false;
      const nearby=getNeighbors(this,state,vision);
      return nearby.some(o=>sp.preyList.includes(o.speciesId) && Math.hypot(torusDelta(o.x,this.x,w), torusDelta(o.y,this.y,h))<vision);
    }

    hasPlantNearby(state){
      const w=params.gridW, h=params.gridH; const cx=Math.floor(wrap(this.x,w)), cy=Math.floor(wrap(this.y,h));
      for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
        const nx=wrap(cx+dx,w), ny=wrap(cy+dy,h); const c=state.cells[ny*w+nx];
        const vegScore=(c.veg.grass+c.veg.poison+c.veg.shrub+c.veg.shrubThorn+c.veg.tree);
        if(vegScore>0.08) return true;
      }
      return false;
    }

    findRiverAmbushSpot(state, vision){
      const w=params.gridW, h=params.gridH; const cx=Math.floor(this.x), cy=Math.floor(this.y);
      let best=null; let bestScore=-Infinity;
      for(let dy=-Math.ceil(vision); dy<=Math.ceil(vision); dy++){
        for(let dx=-Math.ceil(vision); dx<=Math.ceil(vision); dx++){
          const nx=wrap(cx+dx,w), ny=wrap(cy+dy,h); const cell=state.cells[ny*w+nx];
          if(!cell) continue;
          if(!(cell.river||cell.shore)) continue;
          const dist=Math.hypot(dx,dy)+0.1;
          const moisture=cell.moist||0;
          const score=(cell.shore?1.2:1)+(moisture*0.6)-dist*0.15;
          if(score>bestScore){ bestScore=score; best={x:nx+0.5, y:ny+0.5, type:'river'}; }
        }
      }
      return best;
    }

    findCoverSpot(state, vision){
      const w=params.gridW, h=params.gridH; const cx=Math.floor(this.x), cy=Math.floor(this.y);
      let best=null, bestScore=-Infinity;
      for(let dy=-Math.ceil(vision); dy<=Math.ceil(vision); dy++){
        for(let dx=-Math.ceil(vision); dx<=Math.ceil(vision); dx++){
          const nx=wrap(cx+dx,w), ny=wrap(cy+dy,h); const cell=state.cells[ny*w+nx]; if(!cell) continue;
          const dist=Math.hypot(dx,dy)+0.1;
          const cover=cell.cover||0;
          const vegSum=cell.veg.grass+cell.veg.shrub+cell.veg.tree;
          const coverScore=cover*1.25 + vegSum*0.25 + (cell.rugged||0)*0.2 - dist*0.12 + (cell.shore?0.08:0);
          if(coverScore>bestScore){ bestScore=coverScore; best={x:nx+0.5,y:ny+0.5, type:'cover', score:cover}; }
        }
      }
      return bestScore>0.35?best:null;
    }

    applyForces(state){
      const sp=this.getSpecies(); let {speed,vision}=this.cached; const w=params.gridW, h=params.gridH; const rng=state.rng; const hazard=state.currentHazard;
      let steerX=0, steerY=0;

      const cx=Math.floor(wrap(this.x,w)), cy=Math.floor(wrap(this.y,h));
      const densityField=state.lastDensity||state.density;
      const localDensity=densityField?.length===w*h? (densityField[cy*w+cx]||0):0;
      const crowdPressure=clampRange(localDensity/6,0,1);

      const wanderJitter=0.35 + crowdPressure*0.25;
      this.wanderAngle+= (rng()-0.5)*wanderJitter; steerX+=Math.cos(this.wanderAngle)*0.35; steerY+=Math.sin(this.wanderAngle)*0.35;

        const cellNow=state.cells[cy*w+cx];
        const terrainCost=BIOMES[cellNow?.biome]?.moveCost||1;
        const rugged=cellNow?.rugged||0;
        const climbSkill=clampRange(sp.climbSkill||0.6,0.2,1.2);
        const ruggedPenalty=clampRange(rugged*1.1 - climbSkill*0.35,0,0.9);
        speed*=clampRange(1/terrainCost,0.55,1.2);
        speed*=clampRange(1 - ruggedPenalty*0.5,0.45,1);
        const habitatPref={water:this.genes.g_habitatWater||0.5, forest:this.genes.g_habitatForest||0.5, plains:this.genes.g_habitatPlains||0.5};
        let habitatBonus=1;
        if(cellNow?.river||cellNow?.shore) habitatBonus+= (habitatPref.water-0.5)*0.4;
        if(['forest','taiga','wetland','marsh'].includes(cellNow?.biome)) habitatBonus+= (habitatPref.forest-0.5)*0.35;
        if(['prairie','shrubland','desert','oasis','highland'].includes(cellNow?.biome)) habitatBonus+= (habitatPref.plains-0.5)*0.35;
        speed*=clampRange(1+habitatBonus*0.08,0.5,1.4);

      if(this.state===AnimalStates.AMBUSH){
        this.behavior=this.target?.type==='cover'?'hide':'ambush';
        speed*=0.55;
          if(this.target){ steerX+=torusDelta(this.target.x,this.x,w)*0.6; steerY+=torusDelta(this.target.y,this.y,h)*0.6; }
          const prey=getNeighbors(this,state,vision/2).find(o=>sp.preyList.includes(o.speciesId) && ((state.cells[Math.floor(o.y)*w+Math.floor(o.x)]?.river||state.cells[Math.floor(o.y)*w+Math.floor(o.x)]?.shore) || (state.cells[Math.floor(o.y)*w+Math.floor(o.x)]?.cover>0.55)));
          if(prey){
            const dx=torusDelta(prey.x,this.x,w), dy=torusDelta(prey.y,this.y,h); const d=safeNorm(dx,dy);
            if(d){ steerX=dx/d*2.1; steerY=dy/d*2.1; this.state=AnimalStates.EAT; this.target=prey; this.recordEvent('水辺ダッシュ','突撃'); this.emote='⚔️'; this.emoteTimer=35; }
          }
      } else if(this.state===AnimalStates.DRINK){
          let best={score:-Infinity,x:cx,y:cy};
          for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){
            const nx=wrap(cx+dx,w), ny=wrap(cy+dy,h); const c=state.cells[ny*w+nx];
            const nearRiver=c.river||c.shore; const score=(nearRiver?1.5:0)+(c.moist*0.8)-Math.hypot(dx,dy)*0.05;
            if(score>best.score){best={score,x:nx,y:ny};}
        }
        steerX+=torusDelta(best.x+0.5,this.x,w); steerY+=torusDelta(best.y+0.5,this.y,h); this.behavior='water'; this.target=best;
      } else if(this.state===AnimalStates.EAT){
        if(sp.trophic==='carn' || (sp.trophic==='omn' && this.meatFocus)){
          let targetPrey=null,minD=Infinity; const nearby=getNeighbors(this,state,vision);
          nearby.forEach(o=>{ if(!sp.preyList.includes(o.speciesId)) return; const dx=torusDelta(o.x,this.x,w), dy=torusDelta(o.y,this.y,h); const d=safeNorm(dx,dy); if(d && d<minD && d<vision){minD=d; targetPrey=o;} });
          if(targetPrey){const dx=torusDelta(targetPrey.x,this.x,w), dy=torusDelta(targetPrey.y,this.y,h); const d=safeNorm(dx,dy); if(d){steerX+=dx/d*1.6; steerY+=dy/d*1.6; this.target=targetPrey; this.behavior='chase';}}
        } else {
          let best={score:-Infinity,x:cx,y:cy};
          for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
            const nx=wrap(cx+dx,w), ny=wrap(cy+dy,h); const c=state.cells[ny*w+nx];
            const vegScore=(c.veg.grass*(sp.dietPreference.grass||0)+c.veg.poison*(sp.dietPreference.poison||0)*sp.poisonTolerance+(c.veg.shrub+c.veg.shrubThorn*0.8)*(sp.dietPreference.shrub||0)+c.veg.tree*(sp.dietPreference.tree||0));
            const score=vegScore - Math.hypot(dx,dy)*0.08 + c.moist*0.04;
            if(score>best.score){best={score,x:nx,y:ny};}
          }
          steerX+=torusDelta(best.x+0.5,this.x,w); steerY+=torusDelta(best.y+0.5,this.y,h); this.target=best; this.behavior='graze';
        }
      } else if(this.state===AnimalStates.MATE){
        const mate=getNeighbors(this,state,vision).find(o=>o.speciesId===this.speciesId && o.sex!==this.sex && Math.hypot(torusDelta(o.x,this.x,w), torusDelta(o.y,this.y,h))<vision);
        if(mate){ const dx=torusDelta(mate.x,this.x,w), dy=torusDelta(mate.y,this.y,h); const d=safeNorm(dx,dy); if(d){ steerX+=dx/d*1.2; steerY+=dy/d*1.2; this.target=mate; this.behavior='seek-mate'; }}
        else { this.behavior='wander'; }
      } else {
        this.behavior='wander';
      }

      const sepRadius=this.state===AnimalStates.DRINK?2.8:2.2; let sepX=0, sepY=0, sepCount=0; const sepBoost=this.state===AnimalStates.DRINK?2.2:1.5;
      getNeighbors(this,state,sepRadius).forEach(o=>{ const dx=torusDelta(o.x,this.x,w), dy=torusDelta(o.y,this.y,h); const d=safeNorm(dx,dy); if(d && d<sepRadius){ const weight=(sepRadius-d)/(d*d); sepX-=dx*weight*sepBoost; sepY-=dy*weight*sepBoost; sepCount++; }});
      if(sepCount>0){ const sN=safeNorm(sepX,sepY); if(sN){ steerX+=sepX/sN; steerY+=sepY/sN; }}

      if(sp.socialMode==='herd' || sp.socialMode==='pack'){
        const mates=getNeighbors(this,state,vision).filter(o=>o.speciesId===this.speciesId && Math.hypot(torusDelta(o.x,this.x,w), torusDelta(o.y,this.y,h))<vision);
        let alignX=0,alignY=0,cohX=0,cohY=0; mates.forEach(o=>{const dx=torusDelta(o.x,this.x,w), dy=torusDelta(o.y,this.y,h); const d=safeNorm(dx,dy); if(!d) return; alignX+=o.vx||0; alignY+=o.vy||0; cohX+=dx; cohY+=dy; });
        if(mates.length>0){ alignX/=mates.length; alignY/=mates.length; cohX/=mates.length; cohY/=mates.length; const aN=safeNorm(alignX,alignY); if(aN){steerX+=alignX/aN*0.2; steerY+=alignY/aN*0.2;} const cN=safeNorm(cohX,cohY); if(cN){steerX+=cohX/cN*0.12; steerY+=cohY/cN*0.12;} }
      }

      if(crowdPressure>0.15){
        let gradX=0, gradY=0, samples=0;
        for(let dy=-1;dy<=1;dy++){
          for(let dx=-1;dx<=1;dx++){
            if(dx===0 && dy===0) continue;
            const nx=state.boundaryMode==='wrap'? wrap(cx+dx,w) : clampRange(cx+dx,0,w-1);
            const ny=state.boundaryMode==='wrap'? wrap(cy+dy,h) : clampRange(cy+dy,0,h-1);
            const neighbor=densityField?.length===w*h? densityField[ny*w+nx]||0:0;
            gradX+=neighbor*dx; gradY+=neighbor*dy; samples++;
          }
        }
        if(samples>0){
          const gN=safeNorm(gradX,gradY);
          if(gN){
            const push=clampRange(crowdPressure*0.45,0,0.6);
            steerX-=gradX/gN*push;
            steerY-=gradY/gN*push;
          }
        }
        this.wanderAngle += (rng()-0.5)*crowdPressure*0.8;
      }

      if(this.state!==AnimalStates.DRINK && (cellNow.river||cellNow.shore)){ steerX-=0.25; steerY-=0.25; }

      const steerN=safeNorm(steerX,steerY); if(steerN){ steerX/=steerN; steerY/=steerN; this.headingX=steerX; this.headingY=steerY; }
      else { steerX=rng()-0.5; steerY=rng()-0.5; }

        const hazardSlow=hazard?.type==='storm'?0.8:(hazard?.type==='disease'?0.9:1);
        this.moveMul=(this.state===AnimalStates.WANDER?0.6:(this.state===AnimalStates.DRINK?0.48:(this.state===AnimalStates.MATE?0.65:(this.state===AnimalStates.AMBUSH?0.4:0.55))))*hazardSlow;
      if(this.digestTimer>0){ this.moveMul*=0.6; }
      const targetVx=steerX*speed*this.moveMul; const targetVy=steerY*speed*this.moveMul;
      const inertia=0.82; const accel=0.18;
      const prevVx=this.vx, prevVy=this.vy;
      this.vx=this.vx*inertia + targetVx*accel;
      this.vy=this.vy*inertia + targetVy*accel;

      const maxSpeed=Math.max(0.35, speed*1.45);
      const maxForce=Math.max(0.05, speed*0.6);
      const ax=this.vx-prevVx, ay=this.vy-prevVy; const aMag=safeNorm(ax,ay);
      if(aMag && aMag>maxForce){
        this.vx=prevVx+ax/aMag*maxForce;
        this.vy=prevVy+ay/aMag*maxForce;
      }
      const vMag=safeNorm(this.vx,this.vy);
      if(vMag && vMag>maxSpeed){ this.vx=this.vx/vMag*maxSpeed; this.vy=this.vy/vMag*maxSpeed; }
    }

    move(state){
      const w=params.gridW, h=params.gridH; const prevX=this.x, prevY=this.y; const nx=this.x + this.vx; const ny=this.y + this.vy;
      this.lastSafeX=prevX; this.lastSafeY=prevY;
      const rng=state.rng;
      const corrupted=()=>{
        console.warn('Coordinate corruption detected. Resetting position.');
        this.x=rng()*w; this.y=rng()*h; this.vx=0; this.vy=0; this.lastEvent='pos-teleport';
        state.nanAgents++; state.events.push({type:'nan', id:this.id, x:this.x,y:this.y});
      };
      if(!Number.isFinite(nx) || !Number.isFinite(ny) || Math.abs(nx)>w*5 || Math.abs(ny)>h*5){ corrupted(); return; }
      if(state.boundaryMode==='wrap'){ this.x=wrap(nx,w); this.y=wrap(ny,h);} else {
        this.x=clampRange(nx,0,w-0.01); this.y=clampRange(ny,0,h-0.01);
        if(nx<=0||nx>=w) this.vx*=-0.4; if(ny<=0||ny>=h) this.vy*=-0.4;
      }
      if(Number.isNaN(this.x) || Number.isNaN(this.y)){ corrupted(); return; }
      const movedDist=Math.hypot(this.x-prevX,this.y-prevY);
      const cell=state.cells[Math.floor(this.y)*w+Math.floor(this.x)];
      if(state.renderEffects && movedDist>0.05 && (cell?.river||cell?.shore)){ particles.ripple({x:this.x,y:this.y}); }
      if(cell?.rugged>clampRange((this.getSpecies()?.climbSkill||0.6)+0.25,0,1.4)){
        this.x=prevX; this.y=prevY; this.vx*=-0.25; this.vy*=-0.25; this.lastEvent='急斜面回避'; return;
      }
      const trailIntensity=state.trailIntensity ?? 1;
      if(state.renderEffects && movedDist>0.08 && trailIntensity>0){
        const biomeKey=cell?.biome; const particleColor=BIOMES[biomeKey]?.particles||'#cfe4ff';
        const type=(biomeKey==='desert'||biomeKey==='highland')?'dust':'trail';
        const particleLife=(18+Math.random()*16)*(0.6+trailIntensity);
        const count=Math.max(0, Math.round((1+Math.floor(movedDist*3))*trailIntensity));
        const spread=0.25+Math.random()*0.35*trailIntensity;
        if(count>0) particles.trail({x:this.x,y:this.y,color:particleColor,count,spread,type,life:particleLife});
      }
      moveAnimalInGrid(this,state);
      if(Math.hypot(this.x-prevX,this.y-prevY)>0.001) state.movedAgents++;
    }

    consumeAndMetabolize(state){
      const sp=this.getSpecies(); const genes=this.genes; const w=params.gridW; const rng=state.rng;
      const thirstTol=clampRange(lerp(0.7,1.3,genes.g_thirstTol),0.2,2.0); const waterNeed=clampRange(sp.waterNeed,0.2,2.0);
      const bodyMass=clampRange((sp.metabolism||1)*lerp(0.85,1.2,genes.g_starveTol||1),0.5,1.8);
      const runSpeed=clampRange(sp.baseSpeed*lerp(0.7,1.3,genes.g_speed),0.4,2.6);
      const metabolismGene=clampRange(genes.g_metabolism||1,0.5,1.6);
      const kleiberCost=0.00125*Math.pow(bodyMass,0.75)*metabolismGene;
      const locomotionCost=this.digestTimer>0?0:0.0007*Math.pow(runSpeed,2)*(this.moveMul||1);
      const baseMetabolicCost=kleiberCost+locomotionCost;
      this.age+=1; this.energy-=baseMetabolicCost; this.hydration-=0.002*waterNeed*thirstTol; if(this.waterCooldown>0) this.waterCooldown-=1; if(this.mateCooldown>0) this.mateCooldown-=1;
      const cell=state.cells[Math.floor(this.y)*w+Math.floor(this.x)];
      const prevHydration=this.hydration;

      if(sp.trophic==='herb' || sp.trophic==='omn'){
        const intake=Math.min(cell.veg.grass,0.1*(sp.dietPreference.grass||0)); cell.veg.grass-=intake; this.energy=Math.min(1,this.energy+intake*1.2); state.vegConsumed+=intake;
        const poisonEat=Math.min(cell.veg.poison,0.06*(sp.dietPreference.poison||0)); cell.veg.poison-=poisonEat; const poisonEff=sp.poisonTolerance||0.5; this.energy=clamp01(this.energy+poisonEat*(0.2+poisonEff)); state.vegConsumed+=poisonEat;
        const shrub=Math.min(cell.veg.shrub,0.05*(sp.dietPreference.shrub||0)); cell.veg.shrub-=shrub; this.energy=Math.min(1,this.energy+shrub*1.05); state.vegConsumed+=shrub;
        const thornEat=Math.min(cell.veg.shrubThorn,0.045*(sp.dietPreference.shrub||0.6)); cell.veg.shrubThorn-=thornEat; const thornEff=(sp.thornHandling||0.5); this.energy=clamp01(this.energy+thornEat*(0.3+thornEff)); this.energy-=Math.max(0,0.1-thornEff)*thornEat*0.5; state.vegConsumed+=thornEat;
        const treeEat=Math.min(cell.veg.tree,0.03*(sp.dietPreference.tree||0)); cell.veg.tree-=treeEat; this.energy=Math.min(1,this.energy+treeEat); state.vegConsumed+=treeEat;
        const totalIntake=intake+poisonEat+shrub+thornEat+treeEat;
        if(totalIntake>0.05) this.recordEvent('採食', `植物を${totalIntake.toFixed(2)}摂取`);
      }

      if(this.state===AnimalStates.DRINK && (cell.shore||cell.river||cell.moist>0.45)) {this.hydration=Math.min(1,this.hydration+0.08*cell.moist+0.05); this.waterCooldown=40+Math.floor(rng()*80); if(this.hydration>prevHydration+0.03) this.recordEvent('水分補給', '水場で回復');}

      if(sp.trophic==='carn' || (sp.trophic==='omn' && this.meatFocus)){
        const nearbyPrey=getNeighbors(this,state,1.2).filter(o=>sp.preyList.includes(o.speciesId));
        const preyDensity=nearbyPrey.length;
        const attackRate=0.65;
        const handlingTime=0.85;
        const successChance=clamp01((attackRate*preyDensity)/(1+attackRate*handlingTime*preyDensity));
        const victim=nearbyPrey.find(o=>Math.hypot(torusDelta(o.x,this.x,params.gridW), torusDelta(o.y,this.y,params.gridH))<0.6 && rng()<successChance);
        if(victim){victim.alive=false; removeAnimalFromGrid(victim,state); state.kills++; const pack=getNeighbors(this,state,3).filter(o=>o.speciesId===this.speciesId);
          const preySpec=victim.getSpecies?victim.getSpecies():null; const preySize=clampRange((preySpec?.metabolism||1)*0.6 + (preySpec?.baseSpeed||1)*0.2,0.5,2.2);
          const meatValue=clampRange(preySize*(sp.trophic==='omn'?0.28:0.34),0.12,0.65)*(0.7+0.6*successChance);
          const shareBase=meatValue/Math.max(1,pack.length||1);
          const digestTime=90+Math.floor(rng()*50);
          pack.forEach(o=>{o.energy=Math.min(1,o.energy+shareBase); o.hydration=Math.min(1,o.hydration+0.12); o.digestTimer=Math.max(o.digestTimer||0,digestTime);});
          this.energy=Math.min(1,this.energy+shareBase*1.2); this.hydration=Math.min(1,this.hydration+0.08); this.digestTimer=Math.max(this.digestTimer,digestTime);
          this.behavior='hunt'; state.events.push({type:'hunt', predator:sp.id, prey:victim.speciesId}); this.recordEvent('捕食', `${victim.speciesId}を捕食`); if(victim.recordEvent) victim.recordEvent('捕食された', `捕食者:${this.id}`);
          if(state.renderEffects) particles.burst({x:this.x,y:this.y,color:'#ff5c5c',count:14,speed:1.1,life:50});
        }
      }

      if(state.currentHazard){
        if(state.currentHazard.type==='disease'){
          this.energy-=0.0015*state.currentHazard.severity; this.hydration-=0.0008*state.currentHazard.severity; this.lastEvent='疫病の影響';
        }
        if(state.currentHazard.type==='toxin' && (sp.trophic==='herb' || sp.trophic==='omn')){
          this.energy-=0.0012*state.currentHazard.severity; this.lastEvent='毒性の拡散';
        }
        if(state.currentHazard.type==='storm'){
          this.hydration-=0.0009*state.currentHazard.severity; this.lastEvent='砂嵐で消耗';
        }
      }

      if(!Number.isFinite(this.x)||!Number.isFinite(this.y)||!Number.isFinite(this.energy)||!Number.isFinite(this.hydration)){
        this.x=this.lastSafeX; this.y=this.lastSafeY; this.vx=0; this.vy=0; state.nanAgents++; this.lastEvent='NaN rollback'; state.events.push({type:'nan', id:this.id, x:this.x,y:this.y});
      }

      if(this.energy<=0||this.hydration<=0){this.alive=false; state.deaths++; state.aliveCount=Math.max(0,state.aliveCount-1); removeAnimalFromGrid(this,state); state.events.push({type:'death', id:this.id}); this.lastEvent='死亡'; this.recordEvent('死亡', this.energy<=0?'餓死':'渇死'); return;}
    }

    handleReproduction(state){
      if(!this.alive || this.state!==AnimalStates.MATE) return;
      const sp=this.getSpecies(); const rng=state.rng; const fert=clampRange(sp.fertility*lerp(0.7,1.3,this.genes.g_fertility),0,1);
      const partner=getNeighbors(this,state,1).find(o=>o.speciesId===this.speciesId && o.sex!==this.sex && o.state===AnimalStates.MATE && Math.hypot(torusDelta(o.x,this.x,params.gridW), torusDelta(o.y,this.y,params.gridH))<0.9 && o.reproCooldown<=0);
      if(!partner) return;
      if(this.reproCooldown>0 || this.mateCooldown>0 || partner.mateCooldown>0) return;
      const minEnergy=clamp01(sp.reproThreshold??0.6); const energyCost=clampRange(sp.reproCost??0.3,0,1);
      if(this.energy<minEnergy || partner.energy<minEnergy) return;
      const projectedPop=state.aliveCount + state.spawnBuffer.length;
      if(projectedPop>=POPULATION_LIMIT) return;
        if(rng()<0.12*fert){
          this.energy=Math.max(0,this.energy-energyCost); partner.energy=Math.max(0,partner.energy-energyCost);
          this.mateCooldown=300; partner.mateCooldown=300; this.reproCooldown=300; partner.reproCooldown=300; this.stateTimer=Math.max(this.stateTimer,40); partner.stateTimer=Math.max(partner.stateTimer,40);
          const child=createAnimal(sp,rng,this.x,this.y); const angle=rng()*Math.PI*2; const dist=1.2+rng()*1.5; child.x=wrap(this.x+Math.cos(angle)*dist,params.gridW); child.y=wrap(this.y+Math.sin(angle)*dist,params.gridH);
          child.lastSafeX=child.x; child.lastSafeY=child.y;
          child.genes=combineGenes(this.genes,partner.genes);
          child.generation=(this.generation||1)+1; child.colorGeneCache=null;
          child.lineageId=this.lineageId||partner.lineageId||sp.id;
          const divergence=geneDivergence(this.genes, child.genes);
          if(divergence>0.2){ child.lineageId=`${sp.id}_lineage_${state.idCounter}`; logMsg(`新種誕生！ ${sp.name} 系統分化 (第${child.generation}世代)`); }
          state.spawnBuffer.push(child); state.births++; state.events.push({type:'birth', species:sp.id});
          this.lastEvent='繁殖'; partner.lastEvent='繁殖'; child.lastEvent='誕生'; this.behavior='seek-mate'; partner.behavior='seek-mate';
          this.recordEvent('繁殖', `相手:${partner.id}`); partner.recordEvent('繁殖', `相手:${this.id}`); child.recordEvent('誕生', `親:${this.id}+${partner.id}`);
        }
      }
  }

  function createSeedGenes(rng, sp){
    const base=defaultGenes(baseGeneSeed(sp));
    Object.keys(base).forEach(k=>{
      const span=k.startsWith('g_color')?0.3:0.8;
      const limit=k.startsWith('g_color')?1.2:(k==='g_aspect'?2:(k==='g_spikes'?1.5:1.8));
      const jittered=base[k] + (rng()-0.5)*span;
      base[k]=clampRange(jittered,0,limit);
    });
    return base;
  }

  function createAnimal(sp, rng, x, y, genes){
    const animal=new Animal(sp, rng, state.idCounter++, x, y);
    if(genes){ animal.genes={...genes}; animal.colorGeneCache=null; }
    return animal;
  }

  // --- VEGETATION ENTITIES ---
  function seedPlants(count=80){
    plants=[];
    const w=width||params.gridW*params.cellSize; const h=height||params.gridH*params.cellSize;
    for(let i=0;i<count;i++){
      const x=random(w), y=random(h);
      const cx=Math.floor(x/params.cellSize), cy=Math.floor(y/params.cellSize);
      const cell=state.cells[cy*params.gridW+cx];
      if(cell?.river && cell.riverWidth>0.05) continue;
      plants.push(new Vegetation(x, y));
    }
  }

  function updatePlants(){
    const newborns=[];
    const weather=getWeatherSnapshot();
    const heat=state.lastDensity || state.density;
    plants.forEach(plant=>{
      const cx=Math.floor(plant.pos.x/params.cellSize);
      const cy=Math.floor(plant.pos.y/params.cellSize);
      const valid=cx>=0 && cy>=0 && cx<params.gridW && cy<params.gridH;
      const cell=valid? state.cells[cy*params.gridW+cx]:null;
      const flooded=cell? (cell.river && (cell.riverWidth>0.05 || state.waterLevel>0.05)):false;
      const moisture=cell? clamp01(cell.moist - (flooded?0.18:0) + (weather?.humidity??0.5)*0.08):0.35;
      const soil=cell? clamp01(0.45 + cell.wet*0.4 - cell.elev*0.2 + (cell.terrain==='丘陵'?0.05:0)) : 0.5;
      const herbPressure=valid && heat? clamp01((heat[cy*params.gridW+cx]||0)/6):0;
      plant.update({moisture, temperature:weather?.temperature??24, humidity:weather?.humidity??0.5, soil, herbivorePressure:herbPressure, flooded});
      const child=plant.reproduce({moisture, soil, herbivorePressure:herbPressure, flooded, bounds:{w:params.gridW*params.cellSize,h:params.gridH*params.cellSize}});
      if(child){
        const ccx=Math.floor(child.pos.x/params.cellSize), ccy=Math.floor(child.pos.y/params.cellSize);
        const cCell=ccx>=0&&ccy>=0&&ccx<params.gridW&&ccy<params.gridH? state.cells[ccy*params.gridW+ccx]:null;
        if(!cCell || (cCell.river && cCell.riverWidth>0.05)) { child.energy=0; }
        else newborns.push(child);
      }
    });
    plants=plants.filter(p=>p.energy>0);
    plants.push(...newborns);
  }

  function drawPlants(p){
    const boost=state.layerSettings?.vegetationBoost||1;
    const cs=params.cellSize;
    const lightweight=document.getElementById('performanceMode')?.checked;
    const cellStep=lightweight?2:1;
    const typeInfo=cell=>{
      const entries=[
        ['grass',cell.veg.grass],
        ['poison',cell.veg.poison],
        ['shrub',cell.veg.shrub],
        ['thorn',cell.veg.shrubThorn],
        ['tree',cell.veg.tree],
      ];
      return entries.reduce((best,[k,v])=> v>best.value?{type:k,value:v}:best,{type:'grass',value:0});
    };
    const palette={
      grass:{col:[96,200,130]},
      poison:{col:[214,98,158]},
      shrub:{col:[160,210,120]},
      thorn:{col:[198,164,90]},
      tree:{col:[70,150,98]},
    };
    p.push();
    p.drawingContext.save();
    p.drawingContext.globalAlpha=lightweight?0.52:0.68;
    p.blendMode(p.NORMAL);
    // セルごとの植生アイコンを描画し、存在位置を把握しやすくする
    for(let y=0;y<params.gridH;y+=cellStep){
      for(let x=0;x<params.gridW;x+=cellStep){
        const cell=state.cells[y*params.gridW+x];
        const total=cell.veg.grass+cell.veg.poison+cell.veg.shrub+cell.veg.shrubThorn+cell.veg.tree;
        if(total<0.05) continue;
        const {type,value}=typeInfo(cell);
        const density=clamp01(Math.pow(total,0.8));
        const size=clampRange(cs*0.24 + density*cs*0.32, cs*0.2, cs*0.62) * clampRange(boost,0.75,1.45);
        const alpha=clampRange((45+value*190)*Math.min(boost,1.4),40,180);
        const [r,g,b]=palette[type]?.col||palette.grass.col;
        const biomeTint=BIOMES[cell.biome]?.color ?? null;
        const tintColor=biomeTint? bgLayer.color(biomeTint):null;
        const tintMix=tintColor? [r*0.6+tintColor.levels[0]*0.4, g*0.6+tintColor.levels[1]*0.4, b*0.6+tintColor.levels[2]*0.4] : [r,g,b];
        p.noStroke();
        p.fill(tintMix[0], tintMix[1], tintMix[2], alpha);
        const cx=x*cs+cs*0.5, cy=y*cs+cs*0.5;
        if(type==='poison'){
          p.push(); p.translate(cx,cy); p.rotate(Math.PI/4); p.rectMode(p.CENTER); p.rect(0,0,size*0.9,size*0.9); p.pop();
          p.fill(tintMix[0], tintMix[1], tintMix[2], alpha*0.6); p.ellipse(cx+2, cy+2, size*0.4, size*0.35);
        } else if(type==='thorn'){
          p.push(); p.translate(cx,cy); p.stroke(r,g,b,alpha+10); p.strokeWeight(1.4); p.line(-size*0.5,0,size*0.5,0); p.line(0,-size*0.5,0,size*0.5); p.pop();
          p.fill(tintMix[0], tintMix[1], tintMix[2], alpha*0.45); p.circle(cx, cy, size*0.45);
        } else if(type==='tree'){
          p.rect(cx-size*0.2, cy-size*0.45, size*0.4, size*0.9, 2);
          p.ellipse(cx, cy-size*0.1, size*0.85, size*0.7);
          p.fill(50,30,10,alpha*0.8); p.rect(cx-size*0.12, cy, size*0.24, size*0.35, 1);
        } else {
          p.ellipse(cx, cy, size, size*0.7);
          if(density>0.42){
            p.ellipse(cx+cs*0.15, cy-cs*0.15, size*0.6, size*0.4);
            p.ellipse(cx-cs*0.12, cy+cs*0.1, size*0.4, size*0.3);
          }
        }
      }
    }
    // 実体の植生はセル情報に応じた色で上書き
    plants.forEach((plant,plantIdx)=>{
      if(lightweight && plantIdx%2===1) return;
      const cx=Math.floor(plant.pos.x/params.cellSize); const cy=Math.floor(plant.pos.y/params.cellSize);
      const idx=cy*params.gridW+cx; const cell=state.cells[idx];
      if(cell){ const info=typeInfo(cell); plant.lastType=info.type; plant.lastDensity=info.value; }
      plant.draw(boost);
    });
    p.drawingContext.restore();
    p.pop();
  }

  // --- ENGINE ---
  
  function stepSimulation(){
    let births=0; let deaths=0;
    const rng=state.rng; const w=params.gridW, h=params.gridH; state.events=[]; state.step++; state.seasonCounter++;
    state.movedAgents=0; state.nanAgents=0; state.vegGrowth=0; state.vegConsumed=0;
    maybeTriggerHazard();
    updatePlants();
    state.animalGrid=createAnimalGrid(); state.aliveCount=0; state.animals.forEach(a=>{ if(a.alive){ registerAnimalToGrid(a,state); state.aliveCount++; } });
    const seasonLen=state.season==='雨季'?uiParams.rainyLen:uiParams.dryLen; if(state.seasonCounter>seasonLen){state.season=state.season==='雨季'?'乾季':'雨季'; state.seasonCounter=0; logMsg(`季節が${state.season}に切替`);} 
    const moistGain=state.season==='雨季'?0.05:0.015; const moistLoss=state.season==='雨季'?0.008:0.03;
    let riverCount=0, moistSum=0, vegSum=0;
    const updateVeg=state.step%VEG_UPDATE_INTERVAL===0;
    state.density.fill(0);
    if(updateVeg){
      const w=params.gridW, h=params.gridH;
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          const idx=y*w+x; const c=state.cells[idx];
          const beforeVeg=c.veg.grass+c.veg.shrub+c.veg.tree;
          c.moist=clamp01(c.moist + moistGain*(0.5+c.wet*0.6) - moistLoss + (c.river?0.06:0));
          const {count:neighborPlants}=countVegNeighbors(x,y,state.cells);
          const seasonFactor=state.season==='雨季'?1:0.65; const tempFactor=c.elev>0.75?0.7:1;
          const crowdPenalty=neighborPlants>5? (neighborPlants-5)*0.04:0;
          const facilitation=neighborPlants>=1 && neighborPlants<=4? neighborPlants*0.012:0;
          const densityFactor=clampRange(1 - crowdPenalty + facilitation,0.65,1.25);
          const biome=BIOMES[c.biome]||{};
          const growBase=0.06*seasonFactor*tempFactor*densityFactor*(biome.growth?.grass??1);
          const shrubBase=(biome.growth?.shrub??1);
          const treeBase=(biome.growth?.tree??1);
          c.veg.grass=clamp01(c.veg.grass + growBase*c.moist*(1-c.veg.grass) - 0.015*(1-c.moist));
          c.veg.poison=clamp01(c.veg.poison + 0.04*c.moist*(1-c.veg.poison) - 0.01*(0.5-c.moist) + (biome.vegBias?.poison||0)*0.01);
          c.veg.shrub=clamp01(c.veg.shrub + 0.04*c.moist*(1-c.veg.shrub)*shrubBase - 0.01*(0.4-c.moist));
          c.veg.shrubThorn=clamp01(c.veg.shrubThorn + 0.035*c.moist*(1-c.veg.shrubThorn)*(1+ (biome.vegBias?.thorn||0)) - 0.012*(0.45-c.moist));
          c.veg.tree=clamp01(c.veg.tree + 0.02*c.moist*(1-c.veg.tree)*treeBase - 0.008*(0.35-c.moist));
          if(state.currentHazard?.type==='toxin'){
            c.veg.poison=clamp01(c.veg.poison + 0.008*state.currentHazard.severity);
          }
          if(neighborPlants>6){
            const choke=0.01*(neighborPlants-6);
            ['grass','poison','shrub','shrubThorn','tree'].forEach(k=>{ c.veg[k]=clamp01(c.veg[k]-choke*Math.max(0.35,c.veg[k]*0.5)); });
          }
          const afterVeg=c.veg.grass+c.veg.poison+c.veg.shrub+c.veg.shrubThorn+c.veg.tree; state.vegGrowth+=Math.max(0, afterVeg-beforeVeg);
          if(c.river) riverCount++; moistSum+=c.moist; vegSum+=afterVeg;
        }
      }
      state.lastRiverCount=riverCount; state.lastMoistAvg=moistSum/state.cells.length; state.lastVegAvg=vegSum/state.cells.length; state.needsBgRedraw=true;
    } else {
      riverCount=state.lastRiverCount||0; moistSum=(state.lastMoistAvg||0)*state.cells.length; vegSum=(state.lastVegAvg||0)*state.cells.length;
    }
    state.spawnBuffer=[]; const animalsAlive=[]; state.births=0; state.deaths=0; state.kills=0;
    for(const a of state.animals){ if(!a.alive) continue; a.update(state); if(a.alive){ animalsAlive.push(a); state.density[Math.floor(a.y)*w+Math.floor(a.x)]++; } }
    state.spawnBuffer.forEach(child=>{ animalsAlive.push(child); state.density[Math.floor(child.y)*w+Math.floor(child.x)]++; });
    births=state.births; deaths=state.deaths;
    vegSum=Math.max(0,vegSum);
    if(updateVeg){
      let vegMin=Infinity, vegMax=0; state.cells.forEach(c=>{const t=c.veg.grass+c.veg.poison+c.veg.shrub+c.veg.shrubThorn+c.veg.tree; vegMin=Math.min(vegMin,t); vegMax=Math.max(vegMax,t);});
      state.vegMin=vegMin; state.vegMax=vegMax;
    }
    state.vegMean=vegSum/state.cells.length; state.zeroMoveStreak=state.movedAgents===0?state.zeroMoveStreak+1:0;
    state.animals=animalsAlive;
    const kills=state.kills;
    const counts=speciesCounts();
    const totalPop=Object.values(counts).reduce((s,v)=>s+v,0);
    if(births>0 || deaths>0 || kills>0){
      logMsg(`出生:${births} 死亡:${deaths} 捕食:${kills} 生存総数:${totalPop}`);
    }
    const shannon=computeShannon(counts);
    const genetic=computeGeneticDiversity();
    updateStabilityMetric(totalPop);
    Object.entries(counts).forEach(([id,v])=>{
      const prev=state.prevCounts[id]||0; const spName=state.species.find(s=>s.id===id)?.name||id;
      if(prev>0 && v===0){ state.extinction++; logMsg(`${spName} が絶滅しました`); }
      else if(prev===0 && v>0){ logMsg(`${spName} が復活 (${v}体)`); }
    });
    state.prevCounts=counts;
    state.shannon=shannon; state.genetic=genetic;
    state.lastDensity=Float32Array.from(state.density);
    state.logs.push({step:state.step, season:state.season, river:riverCount, moist:moistSum/state.cells.length, veg:vegSum/state.cells.length, births,deaths,kills, counts, genesAvg:averageGenes(), vegMin:state.vegMin, vegMax:state.vegMax, vegGrowth:state.vegGrowth, vegConsumed:state.vegConsumed, moved:state.movedAgents, nan:state.nanAgents, shannon, genetic, stability:state.stability, extinction:state.extinction});
    if(state.logs.length>600) state.logs.shift();
  }

  function combineGenes(g1,g2){
    const mutate=(parseFloat(document.getElementById('mutRate').value||'0.05')||0)*2.5; const evo=document.getElementById('evoToggle').checked; const rng=state.rng; const res={};
    const clampGene=(k,v)=>{
      if(k.startsWith('g_color')) return clampRange(v,0,1.2);
      if(k==='g_aspect') return clampRange(v,0.4,2);
      if(k==='g_spikes') return clampRange(v,0,1.5);
      if(k.startsWith('g_habitat')) return clampRange(v,0,1.5);
      return clamp01(v*1.1);
    };
    GENE_KEYS.forEach(k=>{ let v=(g1[k]+g2[k])/2; if(evo) v+= (rng()-0.5)*mutate*(k.startsWith('g_color')?0.6:1); res[k]=clampGene(k,v);});
    return res;
  }
  function geneDivergence(base, next){
    let total=0, count=0;
    GENE_KEYS.forEach(k=>{ const b=base?.[k]??1; const n=next?.[k]??1; const denom=Math.max(Math.abs(b),0.3); total+=Math.abs(n-b)/denom; count++; });
    return count? total/count:0;
  }
  function averageGenes(){
    const sums={}; const keys=[...GENE_KEYS]; keys.forEach(k=>sums[k]=0);
    const list=state.animals.filter(a=>a.alive); if(list.length===0) return sums; list.forEach(a=>keys.forEach(k=>sums[k]+=a.genes[k]||1)); keys.forEach(k=>sums[k]/=Math.max(1,list.length)); return sums;
  }
  function speciesCounts(){ const counts={}; state.species.forEach(sp=>counts[sp.id]=0); state.animals.forEach(a=>{if(a.alive) counts[a.speciesId]++;}); return counts; }
  function computeShannon(counts){ const total=Object.values(counts).reduce((s,v)=>s+v,0); if(total===0) return 0; let h=0; Object.values(counts).forEach(v=>{ if(v>0){ const p=v/total; h-=p*Math.log(p); } }); return h/Math.log(state.species.length||1); }
  function computeGeneticDiversity(){
    const keys=['g_speed','g_vision','g_metabolism','g_fertility','g_thirstTol','g_starveTol'];
    let totalStd=0, speciesUsed=0;
    const calcStd=vals=>{ if(vals.length<2) return 0; const mean=vals.reduce((s,v)=>s+v,0)/vals.length; const variance=vals.reduce((s,v)=>s+(v-mean)*(v-mean),0)/(vals.length-1); return Math.sqrt(variance); };
    state.species.forEach(sp=>{
      const list=state.animals.filter(a=>a.alive && a.speciesId===sp.id);
      if(list.length<2) return;
      let speciesStd=0;
      keys.forEach(k=>{
        const vals=list.map(a=>clampRange(a.genes[k]||1,0,2));
        speciesStd+=calcStd(vals);
      });
      totalStd+=speciesStd/keys.length;
      speciesUsed++;
    });
    return speciesUsed?totalStd/speciesUsed:0;
  }
  function computeTrophicDiversity(){
    const keys=['g_speed','g_metabolism','g_thirstTol','g_starveTol'];
    const calcStd=vals=>{ if(vals.length<2) return 0; const mean=vals.reduce((s,v)=>s+v,0)/vals.length; const variance=vals.reduce((s,v)=>s+(v-mean)*(v-mean),0)/(vals.length-1); return Math.sqrt(variance); };
    const groups={herb:[], carn:[], omn:[]};
    state.animals.forEach(a=>{ if(!a.alive) return; const sp=state.species.find(s=>s.id===a.speciesId); if(sp) groups[sp.trophic]?.push(a); });
    const result={};
    Object.entries(groups).forEach(([k,list])=>{
      const diversities=[];
      keys.forEach(gk=>{ const vals=list.map(a=>clampRange(a.genes[gk]||1,0.2,2)); diversities.push(calcStd(vals)); });
      const avg=diversities.length?diversities.reduce((s,v)=>s+v,0)/diversities.length:0;
      result[k]={count:list.length, diversity:avg};
    });
    return result;
  }
  function computeTraitSpread(){
    const living=state.animals.filter(a=>a.alive);
    if(living.length===0) return {speed:0, vision:0, metabolism:0};
    const calcStd=fn=>{const vals=living.map(fn); const mean=vals.reduce((s,v)=>s+v,0)/vals.length; const variance=vals.reduce((s,v)=>s+(v-mean)*(v-mean),0)/vals.length; return Math.sqrt(variance);};
    return {
      speed:calcStd(a=>{const sp=state.species.find(s=>s.id===a.speciesId); return (sp?.baseSpeed||0)*lerp(0.7,1.3,a.genes.g_speed);} ),
      vision:calcStd(a=>{const sp=state.species.find(s=>s.id===a.speciesId); return (sp?.vision||0)*lerp(0.7,1.3,a.genes.g_vision);} ),
      metabolism:calcStd(a=>{const sp=state.species.find(s=>s.id===a.speciesId); return (sp?.metabolism||0)*clampRange(a.genes.g_metabolism,0.2,2);} ),
    };
  }
  function updateStabilityMetric(totalPop){ const window=state.stabilityWindow; window.push(totalPop); if(window.length>180) window.shift(); if(window.length>3){ const avg=window.reduce((s,v)=>s+v,0)/window.length; const variance=window.reduce((s,v)=>s+(v-avg)*(v-avg),0)/window.length; state.stability=1/(1+Math.sqrt(variance)); } else { state.stability=0; } }

  // --- RENDER ---
  let p5inst=null; let canvasW=0, canvasH=0; let selectedAnimal=null; let overlayLayer=null; let bgLayer=null; let currentWeather=null; let lastMutationMapStep=-1;
  let bgm=null; let audioUnlocked=false;
  let terrainEditMode=false; let camera={x:0,y:0,zoom:1};
  let miniMapRect=null; let miniMapDragging=false; let miniMapDragOffset={x:0,y:0};
  function resizeCanvasToHost(){
    const host=document.getElementById('canvasHost'); if(!host || !p5inst) return;
    const w=Math.max(200, host.clientWidth); const h=Math.max(200, host.clientHeight);
    canvasW=w; canvasH=h;
    if(p5inst.resizeCanvas) p5inst.resizeCanvas(w,h);
    if(overlayLayer){ overlayLayer.resizeCanvas(w,h); overlayLayer.noStroke(); }
    if(bgLayer){ bgLayer.resizeCanvas(w,h); bgLayer.noStroke(); state.needsBgRedraw=true; }
  }
  function unlockAudio(){
    if(audioUnlocked) return;
    if(typeof userStartAudio==='function') userStartAudio();
    const ctx=typeof getAudioContext==='function'?getAudioContext():null;
    if(ctx && ctx.state==='suspended'){ ctx.resume(); }
    audioUnlocked=true;
  }
  function startBgmLoop(){
    unlockAudio();
    if(!bgm || !bgm.isLoaded()) return;
    if(!bgm.isPlaying()) bgm.loop();
  }
  function stopBgm(){ if(bgm){ bgm.stop(); } }
  function startP5(){
    p5inst=new p5(p=>{
      p.preload=()=>{ bgm=p.loadSound('assets/audio/biological-signal.mp3'); };
      p.setup=()=>{const host=document.getElementById('canvasHost'); const w=host.clientWidth, h=host.clientHeight; canvasW=w; canvasH=h; p.createCanvas(w,h); overlayLayer=p.createGraphics(w,h); bgLayer=p.createGraphics(w,h); overlayLayer.noStroke(); bgLayer.noStroke(); state.needsBgRedraw=true; ensureP5Globals(p); if(plants.length===0) seedPlants();};
      p.windowResized=()=>{resizeCanvasToHost(); ensureP5Globals(p);};
      p.draw=()=>{try{ensureP5Globals(p); if(state.running){for(let i=0;i<parseInt(document.getElementById('speedSelect').value);i++) stepSimulation();} render(p);}catch(err){state.lastError=err; document.getElementById('renderAlert').style.display='block'; console.error(err);} };
      p.mouseMoved=()=>{handleHover(p);};
      p.mousePressed=()=>{ if(startMiniMapDrag(p)) return; if(handleBrush(p)) return; handleSelect(p); };
      p.mouseDragged=()=>{ if(updateMiniMapDrag(p)) return; handleBrush(p); };
      p.mouseReleased=()=>{ stopMiniMapDrag(); };
      p.keyPressed=()=>{ if(p.key==='e' || p.key==='E'){ state.animals.forEach(a=>{ if(a.alive && typeof a.showEmote==='function') a.showEmote('❤️',90); }); } };
    },'canvasHost');
  }

  function redrawBackground(){
    if(!bgLayer) return; const cellSize=params.cellSize; bgLayer.clear();
    for(let y=0;y<params.gridH;y++){
      for(let x=0;x<params.gridW;x++){
        const c=state.cells[y*params.gridW+x];
        const biomeColor=BIOMES[c.biome]?.color||'#2e3d3a';
        const baseCol=bgLayer.color(biomeColor);
        const elevShade=bgLayer.lerpColor(baseCol, bgLayer.color('#ffffff'), c.elev*0.08);
        const ruggedShade=bgLayer.lerpColor(elevShade, bgLayer.color('#0f0f14'), c.rugged*0.35);
        bgLayer.noStroke(); bgLayer.fill(ruggedShade); bgLayer.rect(x*cellSize,y*cellSize,cellSize,cellSize);
        const vegLevel=c.veg.grass+c.veg.shrub+c.veg.tree;
        if(vegLevel>0.18){
          const grassAlpha=clamp01(c.veg.grass*0.9);
          const dense=vegLevel>0.38;
          bgLayer.fill(110,200,120,grassAlpha*140);
          bgLayer.circle(x*cellSize+cellSize*0.3,y*cellSize+cellSize*0.25,1.5);
          if(dense){ bgLayer.circle(x*cellSize+cellSize*0.65,y*cellSize+cellSize*0.65,1.8); bgLayer.circle(x*cellSize+cellSize*0.4,y*cellSize+cellSize*0.7,1.2); }
        }
        if((c.cover||0)>0.55){
          const shade=clampRange((c.cover-0.4)*160,30,160);
          bgLayer.fill(28,56,38,shade);
          bgLayer.rect(x*cellSize, y*cellSize, cellSize, cellSize);
          bgLayer.fill(12,28,18,shade*0.35); bgLayer.circle(x*cellSize+cellSize*0.25,y*cellSize+cellSize*0.3,1.8);
        }
        if(c.river){bgLayer.fill(70,160,255,200); bgLayer.rect(x*cellSize,y*cellSize,cellSize,cellSize);} else if(c.shore){bgLayer.fill(90,140,200,60); bgLayer.rect(x*cellSize,y*cellSize,cellSize,cellSize);}
      }
    }
    bgLayer.stroke(255,30); bgLayer.strokeWeight(1); const spacing=8*cellSize; for(let gx=0; gx<=params.gridW*cellSize; gx+=spacing){ bgLayer.line(gx,0,gx,params.gridH*cellSize);} for(let gy=0; gy<=params.gridH*cellSize; gy+=spacing){ bgLayer.line(0,gy,params.gridW*cellSize,gy);} bgLayer.noStroke();
    state.needsBgRedraw=false;
  }
  function handleHover(p){
    const cellTooltip=document.getElementById('cellTooltip'); const x=Math.floor(p.mouseX/params.cellSize), y=Math.floor(p.mouseY/params.cellSize);
    if(x<0||y<0||x>=params.gridW||y>=params.gridH){cellTooltip.classList.add('hidden'); return;}
    const c=state.cells[y*params.gridW+x]; cellTooltip.textContent=`(${x},${y}) elev:${c.elev.toFixed(2)} rugged:${(c.rugged||0).toFixed(2)} cover:${(c.cover||0).toFixed(2)}\n地形:${c.terrain} (${c.biome}) river:${c.river?'yes':'no'}\nmoist:${c.moist.toFixed(2)}\n草:${c.veg.grass.toFixed(2)} 毒:${c.veg.poison.toFixed(2)}\n低木:${c.veg.shrub.toFixed(2)} トゲ:${c.veg.shrubThorn.toFixed(2)} 樹木:${c.veg.tree.toFixed(2)}`;
    cellTooltip.style.left=(p.mouseX+16)+'px'; cellTooltip.style.top=(p.mouseY+16)+'px'; cellTooltip.classList.remove('hidden');
  }
  function handleSelect(p){
    const mx=p.mouseX/params.cellSize, my=p.mouseY/params.cellSize; const found=state.animals.find(a=>a.alive && Math.hypot(a.x*params.cellSize-mx*params.cellSize,a.y*params.cellSize-my*params.cellSize)<8);
    if(found){selectedAnimal=found; updateInspector(currentWeather);}
  }

  function applyBrush(cx,cy,isWater){
    const size=parseInt(document.getElementById('brushSize').value||'1'); const half=size-1;
    for(let dy=-half; dy<=half; dy++){
      for(let dx=-half; dx<=half; dx++){
        const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=params.gridW||ny>=params.gridH) continue; const idx=ny*params.gridW+nx; const c=state.cells[idx]; if(!c) continue;
        if(isWater){
          c.river=true; c.shore=false; c.moist=1; c.wet=1; c.terrain='水域'; c.biome='wetland'; c.veg={grass:0,poison:0,shrub:0,shrubThorn:0,tree:0};
          c.cover=0;
        } else {
          c.river=false; c.shore=false; c.moist=Math.max(0.2,c.moist*0.6); c.wet=Math.max(0.15,c.wet*0.5); c.terrain='陸地';
          c.biome='prairie'; c.veg=initVegByBiome('prairie', state.rng); c.cover=clamp01((c.cover||0)*0.5 + 0.2);
        }
      }
    }
    computeRuggedness();
    const pat=document.getElementById('patternSelect')?.value; computeCoverMap(PATTERN_CONFIGS[pat]||{});
    state.needsBgRedraw=true;
  }

  function handleBrush(p){
    if(!terrainEditMode) return false; if(p.mouseX<0||p.mouseY<0||p.mouseX>canvasW||p.mouseY>canvasH) return false;
    const isWater=p.mouseButton===p.RIGHT || p.keyIsDown(16);
    const cx=Math.floor(p.mouseX/params.cellSize); const cy=Math.floor(p.mouseY/params.cellSize);
    applyBrush(cx,cy,isWater);
    return true;
  }

  function updateTerrainEditButton(){
    const btn=document.getElementById('terrainModeToggle'); if(!btn) return;
    btn.textContent=terrainEditMode?'地形編集 ON':'地形編集 OFF';
    btn.classList.toggle('active', terrainEditMode);
  }
  function overlayLabelText(mode){
    const map={base:'地形+植生', river:'河川(流路)', moisture:'水分', cover:'隠れ家', vegetation_total:'植生合計', vegetation_grass:'草(密度ヒート)', vegetation_poison:'毒草', vegetation_tree:'樹木', animals_all:'動物(全)', animals_filter:'動物(種別)', density_heatmap:'密度ヒート'}; return map[mode]||mode;
  }
  const normalizeOverlay=mode=> OVERLAY_OPTIONS.includes(mode)?mode:'animals_all';

  function ensureVegetationLayersVisible(){
    const vegToggle=document.getElementById('showVegetation');
    if(vegToggle && !vegToggle.checked){ vegToggle.checked=true; state.showVegetation=true; }
    const vegLayer=document.getElementById('toggleVegetationLayer');
    if(vegLayer && !vegLayer.checked){ vegLayer.checked=true; state.layerSettings.vegetation=true; }
    const animalLayer=document.getElementById('toggleAnimals');
    if(animalLayer && !animalLayer.checked){ animalLayer.checked=true; state.layerSettings.animals=true; }
  }
  function drawColorbar(p,mode){
    const x=12,y=12,w=18,h=140; p.push(); p.translate(12,60); const grad=p.drawingContext.createLinearGradient(0,0,0,h); const colors={moisture:['#1b2d6b','#6fa4ff'], cover:['#1a2018','#6bc58a'], vegetation_total:['#17351f','#68e38f'], vegetation_grass:['#16361c','#5acb72'], vegetation_poison:['#30202e','#e64f86'], vegetation_tree:['#18261a','#5fa173'], density_heatmap:['#1d1b4f','#ffcc66'], river:['#0c2238','#59c6ff'], animals_all:['#222','#fff']};
      const cs=colors[mode]||['#111','#888']; grad.addColorStop(0,cs[0]); grad.addColorStop(1,cs[1]); p.drawingContext.fillStyle=grad; p.rect(0,0,w,h); p.fill('#dce8ff'); p.noStroke(); p.textSize(10); p.text('low',2,h+12); p.text('high',2,-4); p.pop();
  }
  function drawOverlay(p, overlay, alpha){
    if(!overlayLayer) return; overlayLayer.clear(); overlayLayer.noStroke();
    if(overlay==='base'){ p.image(overlayLayer,0,0); return; }
    for(let y=0;y<params.gridH;y++){
      for(let x=0;x<params.gridW;x++){
        const c=state.cells[y*params.gridW+x]; let col=null; switch(overlay){
          case 'river': col=overlayLayer.color(70,160,255,alpha*255*(0.4+c.riverWidth)); break;
          case 'moisture': col=overlayLayer.lerpColor(overlayLayer.color('#1b2d6b'), overlayLayer.color('#6fa4ff'), c.moist); break;
          case 'cover': col=overlayLayer.lerpColor(overlayLayer.color('#1a2018'), overlayLayer.color('#6bc58a'), clamp01((c.cover||0))); break;
          case 'vegetation_total': col=overlayLayer.lerpColor(overlayLayer.color('#14301e'), overlayLayer.color('#68e38f'), clamp01((c.veg.grass+c.veg.shrub+c.veg.tree)/2)); break;
          case 'vegetation_grass': col=overlayLayer.lerpColor(overlayLayer.color('#16361c'), overlayLayer.color('#5acb72'), clamp01(c.veg.grass*1.2)); break;
          case 'vegetation_poison': col=overlayLayer.lerpColor(overlayLayer.color('#30202e'), overlayLayer.color('#e64f86'), clamp01(c.veg.poison*1.4)); break;
          case 'vegetation_tree': col=overlayLayer.lerpColor(overlayLayer.color('#18261a'), overlayLayer.color('#5fa173'), clamp01(c.veg.tree*1.2)); break;
          case 'animals_all': {
            const density=clamp01(state.density[y*params.gridW+x]/5); col=overlayLayer.lerpColor(overlayLayer.color('#222222'), overlayLayer.color('#ffffff'),density); break; }
          case 'animals_filter': {
            const density=clamp01(state.animals.filter(a=>a.alive && a.speciesId===state.overlaySpecies && Math.floor(a.x)===x && Math.floor(a.y)===y).length/3);
            col=overlayLayer.lerpColor(overlayLayer.color('#332233'), overlayLayer.color('#ff99dd'), density); break; }
          case 'density_heatmap': col=overlayLayer.lerpColor(overlayLayer.color('#1d1b4f'), overlayLayer.color('#ffcc66'), clamp01(state.density[y*params.gridW+x]/5)); break;
          default: break;
        }
        if(col){ col.setAlpha(alpha*255); overlayLayer.fill(col); overlayLayer.rect(x*params.cellSize,y*params.cellSize,params.cellSize,params.cellSize); }
      }
    }
    p.image(overlayLayer,0,0);
  }

  function updateLegendFilterPanel(){
    const list=document.getElementById('legendFilters');
    if(!list) return;
    const overlay=overlayLabelText(state.overlay);
    const overlaySuffix=state.overlay==='animals_filter' && state.overlaySpecies?` (${state.overlaySpecies})`:'';
    const ls=state.layerSettings||{};
    const filters=[
      {label:'オーバーレイ', value:`${overlay}${overlaySuffix}`, active:true},
      {label:'地形/背景', value:ls.terrain?'表示中':'非表示', active:!!ls.terrain},
      {label:'植生', value: ls.vegetation && state.showVegetation?`彩度 x${(ls.vegetationBoost||1).toFixed(2)}`:'非表示', active:!!ls.vegetation && state.showVegetation},
      {label:'動物', value: ls.animals?`サイズ x${(ls.animalScale||1).toFixed(2)} / 透明度 ${(Math.round((ls.animalOpacity??1)*100))}%`:'非表示', active:!!ls.animals},
    ];
    list.innerHTML='';
    filters.forEach(f=>{
      const li=document.createElement('li');
      li.className='filter-pill'+(f.active?' active':'');
      li.innerHTML=`<span>${f.label}</span><strong>${f.value}</strong>`;
      list.appendChild(li);
    });
  }
  function updateLegendPopulation(){
    const stats=computeTrophicDiversity();
    const diversityLabel=val=>{
      if(!Number.isFinite(val)) return '-';
      if(val<0.06) return '多様性:低';
      if(val<0.14) return '多様性:中';
      return '多様性:高';
    };
    const setText=(id,text)=>{ const el=document.getElementById(id); if(el) el.textContent=text; };
    setText('legendHerbCount', stats.herb?.count??0);
    setText('legendCarnCount', stats.carn?.count??0);
    setText('legendOmnCount', stats.omn?.count??0);
    setText('legendHerbDiversity', diversityLabel(stats.herb?.diversity));
    setText('legendCarnDiversity', diversityLabel(stats.carn?.diversity));
    setText('legendOmnDiversity', diversityLabel(stats.omn?.diversity));
  }

  function applyLayerSettingsFromUI(){
    if(!state.layerSettings){ state.layerSettings={terrain:true, vegetation:true, animals:true, vegetationBoost:1, animalScale:1, animalOpacity:1}; }
    const terrain=document.getElementById('toggleTerrain');
    const vegetation=document.getElementById('toggleVegetationLayer');
    const animals=document.getElementById('toggleAnimals');
    const vegBoost=document.getElementById('vegBoost');
    const animalScale=document.getElementById('animalScale');
    const animalOpacity=document.getElementById('animalOpacity');
    const overlayInput=document.querySelector('input[name="overlay"]:checked');
    const overlayAlpha=document.getElementById('overlayAlpha');
    const overlaySpecies=document.getElementById('overlaySpecies');
    const showVeg=document.getElementById('showVegetation');
    if(terrain) state.layerSettings.terrain=terrain.checked;
    if(vegetation) state.layerSettings.vegetation=vegetation.checked;
    if(animals) state.layerSettings.animals=animals.checked;
    if(vegBoost) state.layerSettings.vegetationBoost=parseFloat(vegBoost.value)||1;
    if(animalScale) state.layerSettings.animalScale=parseFloat(animalScale.value)||1;
    if(animalOpacity) state.layerSettings.animalOpacity=parseFloat(animalOpacity.value)||1;
    if(overlayInput) state.overlay=normalizeOverlay(overlayInput.value);
    if(overlayAlpha) state.overlayAlpha=parseFloat(overlayAlpha.value)||0.6;
    if(overlaySpecies) state.overlaySpecies=overlaySpecies.value;
    if(showVeg) state.showVegetation=showVeg.checked;
    if(state.overlay?.startsWith('vegetation')) ensureVegetationLayersVisible();
    state.needsBgRedraw=true;
    updateLegendFilterPanel();
  }

  function getWeatherSnapshot(){
    const weather=state.season==='雨季'?'RAINY':'DRY';
    const tempBase=weather==='RAINY'?23:31;
    const temp=tempBase + Math.sin(state.step*0.01)*1.8;
    const moistureLog=state.logs[state.logs.length-1];
    const humidity=clamp01(moistureLog?.moist ?? 0.5);
    return {weather, temperature:temp, humidity};
  }

  function maybeTriggerHazard(){
    const rng=state.rng;
    if(state.currentHazard && state.currentHazard.until<=state.step){
      logMsg(`脅威収束: ${state.currentHazard.label}`);
      state.currentHazard=null;
    }
    if(state.currentHazard || state.step<200) return;
    if(rng()<0.0015){
      const options=[
        {type:'disease', label:'疫病', detail:'一部の個体が衰弱', severity:lerp(0.8,1.4,rng()), duration:320+Math.floor(rng()*240)},
        {type:'toxin', label:'毒性繁茂', detail:'胞子で草食が消耗', severity:lerp(0.7,1.2,rng()), duration:260+Math.floor(rng()*200)},
        {type:'storm', label:'砂嵐', detail:'視界と水分を奪う強風', severity:lerp(0.7,1.3,rng()), duration:220+Math.floor(rng()*200)},
      ];
      const pick=options[Math.floor(rng()*options.length)];
      state.currentHazard={...pick, until:state.step+pick.duration};
      logMsg(`環境脅威発生: ${pick.label} (${pick.detail})`);
    }
  }

  function drawWeatherOverlay(p, weather){
    if(!weather) return;
    const w=canvasW||p.width; const h=canvasH||p.height;
    p.push();
    if(weather.weather==='RAINY'){
      p.noStroke();
      p.fill(0,0,100,25);
      p.rect(0,0,w,h);
      p.stroke(120,170,255,180);
      p.strokeWeight(1);
      for(let i=0;i<50;i++){
        const x=p.random(w); const y=p.random(h); const len=p.random(8,16);
        p.line(x,y,x,y+len);
      }
    } else if(weather.weather==='DRY'){
      p.noStroke();
      p.fill(255,100,0,13);
      p.rect(0,0,w,h);
    }

    const hazard=state.currentHazard;
    if(hazard){
      const pulse=0.5+0.5*Math.sin((p.frameCount||0)*0.08);
      let tint='#5ad17f', fx='soft';
      if(hazard.type==='disease'){ tint='#b05dcc'; fx='veins'; }
      else if(hazard.type==='storm'){ tint='#c7903e'; fx='dust'; }
      else if(hazard.type==='toxin'){ tint='#7fd89f'; fx='spores'; }
      const col=p.color(tint);
      p.noStroke();
      p.fill(p.red(col), p.green(col), p.blue(col), 28+30*pulse);
      p.rect(0,0,w,h);
      if(fx==='dust'){
        p.stroke(p.red(col), p.green(col), p.blue(col), 40+60*pulse);
        p.strokeWeight(2);
        for(let i=0;i<22;i++){
          const y=(p.noise((p.frameCount+i)*0.02)*h+h*0.1)%h; const x=p.random(w);
          p.line(x,y, x+30+Math.random()*20, y-6-Math.random()*8);
        }
      } else if(fx==='veins'){
        p.noFill(); p.stroke(p.red(col), p.green(col), p.blue(col), 55+45*pulse); p.strokeWeight(1.4);
        for(let i=0;i<7;i++){
          const offset=(i/6)*w; p.beginShape();
          for(let y=0;y<=h;y+=32){ const sway=Math.sin((y*0.03)+(p.frameCount*0.05)+i)*24; p.vertex(offset+sway,y); }
          p.endShape();
        }
      } else if(fx==='spores'){
        p.noStroke();
        for(let i=0;i<32;i++){
          const x=p.random(w), y=p.random(h); const sz=6+p.random(10); const alpha=70+40*pulse;
          p.fill(p.red(col), p.green(col), p.blue(col), alpha);
          p.circle(x,y,sz);
        }
      }
    }

    const icon=weather.weather==='RAINY'?'🌧️':'☀️';
    p.textAlign(p.RIGHT,p.TOP);
    p.textSize(26);
    p.noStroke();
    p.fill(255,255,255,230);
    p.text(`${icon} ${weather.temperature.toFixed(1)}°C`, w-12, 12);
    if(state.currentHazard){
      p.textSize(16);
      p.fill(255,200,160,230);
      p.text(`⚠️ ${state.currentHazard.label}`, w-12, 42);
    }
    p.pop();
  }
  function updateCamera(p){
    const cellSize=params.cellSize;
    const targetX=selectedAnimal? selectedAnimal.x*cellSize+cellSize/2 : canvasW/2;
    const targetY=selectedAnimal? selectedAnimal.y*cellSize+cellSize/2 : canvasH/2;
    camera.x=lerp(camera.x||targetX, targetX, 0.08);
    camera.y=lerp(camera.y||targetY, targetY, 0.08);
    let targetZoom=1;
    if(selectedAnimal){
      const neighborCount=getNeighbors(selectedAnimal,state,3).length;
      const crowd=clampRange(neighborCount/10,0,1);
      targetZoom=lerp(1.05,0.8,crowd);
    } else {
      targetZoom=0.9;
    }
    camera.zoom=lerp(camera.zoom||1, targetZoom, 0.05);
  }
  function render(p){
    const cellSize=params.cellSize; p.background('#050910');
    const dimTerrain=document.getElementById('dimTerrain').checked;
    const activeOverlay=normalizeOverlay(state.overlay);
    state.overlay=activeOverlay;
    const layerSettings=state.layerSettings||{};
    const vegetationVisible=state.showVegetation && layerSettings.vegetation && (document.getElementById('showVegetation')?.checked ?? true);
    state.showVegetation=vegetationVisible;
    updateCamera(p);
    if(state.needsBgRedraw) redrawBackground();
    p.push();
    p.translate(canvasW/2, canvasH/2); p.scale(camera.zoom); p.translate(-camera.x, -camera.y);
    if(bgLayer && layerSettings.terrain) p.image(bgLayer,0,0);
    if(vegetationVisible){ drawPlants(p); }
    if(dimTerrain && activeOverlay.startsWith('vegetation')){ p.fill(5,9,16,90); p.noStroke(); p.rect(0,0,canvasW,canvasH); }
    drawOverlay(p, state.overlay, parseFloat(document.getElementById('overlayAlpha').value||'0.6'));
    if(state.renderEffects){ particles.update(); particles.draw(p, cellSize); }
    else { particles.clear(); }
    // animals
    if(layerSettings.animals){
      const opacity=clampRange(layerSettings.animalOpacity??1,0,1);
      p.push();
      p.drawingContext.globalAlpha=opacity;
      for(const a of state.animals){ if(!a.alive) continue; drawAnimal(p,a); }
      p.pop();
    }
    // trails
    if(document.getElementById('trailToggle').checked && selectedAnimal){ p.stroke(255,255,255,120); p.noFill(); p.beginShape(); selectedAnimal.trail.forEach(pt=>p.vertex(pt.x*cellSize+cellSize/2, pt.y*cellSize+cellSize/2)); p.endShape(); }
    if(selectedAnimal){ p.noFill(); p.stroke('#ffea8a'); p.rect(Math.floor(selectedAnimal.x)*cellSize, Math.floor(selectedAnimal.y)*cellSize, cellSize, cellSize); }
    p.pop();
    currentWeather=getWeatherSnapshot();
    drawWeatherOverlay(p,currentWeather);
    drawMiniMap(p);
    // overlay label
    const overlay=state.overlay;
    const label=document.getElementById('layerLabel'); label.textContent=`レイヤー: ${overlayLabelText(overlay)}`; label.innerHTML=`レイヤー: ${overlayLabelText(overlay)}<small>表示中: ${overlayLabelText(overlay)} / マップ ${params.gridW}x${params.gridH} (バイオーム・粒子演出強化版)</small>`;
    drawColorbar(p, overlay);
    updateLegendFilterPanel();
    updateLegendPopulation();
    updateHud(); updateTrophicPanel(); updateInspector(currentWeather); updateChart();
    if(lastMutationMapStep!==state.step){ renderMutationMap(); lastMutationMapStep=state.step; }
  }

  function drawMiniMap(p){
    const mapW=150, mapH=100; const margin=16;
    const defaultPos={x:canvasW-mapW-margin, y:canvasH-mapH-margin};
    const pos=uiParams.miniMapPos||defaultPos;
    miniMapRect={x:clampRange(pos.x,0,Math.max(0,canvasW-mapW)), y:clampRange(pos.y,0,Math.max(0,canvasH-mapH)), w:mapW, h:mapH};
    p.push(); p.translate(miniMapRect.x, miniMapRect.y);
    p.noStroke(); p.fill(0,160); p.rect(0,0,mapW,mapH,10);
    const scaleX=mapW/params.gridW, scaleY=mapH/params.gridH;
    for(const a of state.animals){ if(!a.alive) continue; const sp=state.species.find(s=>s.id===a.speciesId); const px=clampRange(a.x,0,params.gridW); const py=clampRange(a.y,0,params.gridH); const dotX=px*scaleX; const dotY=py*scaleY; const col=p.color(sp.color||'#8ec7ff'); p.noStroke(); p.fill(p.red(col),p.green(col),p.blue(col),220); p.circle(dotX,dotY,3); }
    p.noFill(); p.stroke(255); const viewW=Math.min(mapW, canvasW/params.cellSize*scaleX); const viewH=Math.min(mapH, canvasH/params.cellSize*scaleY); p.rect(0,0,viewW,viewH);
    p.pop();
  }
  function isWithinMiniMap(x,y){ return miniMapRect && x>=miniMapRect.x && y>=miniMapRect.y && x<=miniMapRect.x+miniMapRect.w && y<=miniMapRect.y+miniMapRect.h; }
  function startMiniMapDrag(p){ if(!isWithinMiniMap(p.mouseX,p.mouseY)) return false; miniMapDragging=true; miniMapDragOffset={x:p.mouseX-miniMapRect.x,y:p.mouseY-miniMapRect.y}; return true; }
  function updateMiniMapDrag(p){ if(!miniMapDragging) return false; const mapW=miniMapRect?.w||150; const mapH=miniMapRect?.h||100; const nx=clampRange(p.mouseX-miniMapDragOffset.x,0,Math.max(0,canvasW-mapW)); const ny=clampRange(p.mouseY-miniMapDragOffset.y,0,Math.max(0,canvasH-mapH)); uiParams.miniMapPos={x:nx,y:ny}; return true; }
  function stopMiniMapDrag(){ miniMapDragging=false; }
  function drawAnimalShape(p, shape, size, strokeColor, trophic, aspect=1, spikes=0){
    p.stroke(strokeColor);
    const lenScale=clampRange(aspect,0.5,1.6);
    const heightScale=clampRange(1/lenScale,0.6,1.5);
    switch(shape){
      case 'antler':{
        const bodyL=size*1.25*lenScale, bodyH=size*0.55*heightScale;
        p.beginShape();
        p.vertex(-bodyL*0.6, bodyH*0.6); p.vertex(bodyL*0.35, bodyH*0.55); p.vertex(bodyL*0.55,0); p.vertex(bodyL*0.3,-bodyH*0.65); p.vertex(-bodyL*0.55,-bodyH*0.5);
        p.endShape(p.CLOSE);
        p.line(bodyL*0.15,-bodyH*0.55, bodyL*0.35,-bodyH*0.85); p.line(bodyL*0.2,-bodyH*0.3, bodyL*0.5,-bodyH*0.55);
        break;
      }
      case 'tusk':{
        const bodyL=size*1.1*lenScale, bodyH=size*0.65*heightScale;
        p.beginShape();
        p.vertex(-bodyL*0.55, bodyH*0.65); p.vertex(bodyL*0.45, bodyH*0.4); p.vertex(bodyL*0.55,0); p.vertex(bodyL*0.35,-bodyH*0.55); p.vertex(-bodyL*0.5,-bodyH*0.45);
        p.endShape(p.CLOSE);
        p.fill(255,255,255,200); p.triangle(bodyL*0.35,-bodyH*0.2, bodyL*0.6,0, bodyL*0.35,bodyH*0.2);
        p.fill(255,255,255,140); p.triangle(-bodyL*0.1,-bodyH*0.45, -bodyL*0.25,-bodyH*0.75, -bodyL*0.15,-bodyH*0.55);
        break;
      }
      case 'arrow':{
        const bodyL=size*1.2*lenScale, bodyH=size*0.55*heightScale;
        p.beginShape();
        p.vertex(-bodyL*0.6, bodyH*0.7); p.vertex(bodyL*0.05, bodyH*0.45); p.vertex(bodyL*0.6,0); p.vertex(bodyL*0.05,-bodyH*0.7); p.vertex(-bodyL*0.6,-bodyH*0.5);
        p.endShape(p.CLOSE);
        p.fill(255,255,255,160); p.triangle(bodyL*0.2,-bodyH*0.15, bodyL*0.62,0, bodyL*0.2,bodyH*0.15);
        break;
      }
      case 'round':{
        p.ellipse(0,0,size*1.15,size*0.9); p.fill(255,255,255,130); p.circle(size*0.12,-size*0.12,size*0.45);
        break;
      }
      case 'stripe':{
        const bodyL=size*1.3*lenScale, bodyH=size*0.7*heightScale;
        p.beginShape();
        p.vertex(-bodyL*0.6, bodyH*0.6); p.vertex(bodyL*0.35, bodyH*0.55); p.vertex(bodyL*0.55,0); p.vertex(bodyL*0.3,-bodyH*0.65); p.vertex(-bodyL*0.55,-bodyH*0.5);
        p.endShape(p.CLOSE);
        p.strokeWeight(1.5); p.stroke(255,255,255,180);
        for(let i=-2;i<=2;i++){
          p.line(-bodyL*0.4+i*bodyL*0.2,-bodyH*0.5, -bodyL*0.2+i*bodyL*0.2, bodyH*0.55);
        }
        break;
      }
      default:{
        const bodyL=size*1.15*lenScale, bodyH=size*0.65*heightScale;
        p.beginShape();
        p.vertex(-bodyL*0.55, bodyH*0.6); p.vertex(bodyL*0.3, bodyH*0.55); p.vertex(bodyL*0.55,0); p.vertex(bodyL*0.28,-bodyH*0.65); p.vertex(-bodyL*0.5,-bodyH*0.5);
        p.endShape(p.CLOSE);
      }
    }
    if(trophic==='carn'){
      p.strokeWeight(1.2); p.noFill(); p.arc(size*0.25,0,size*0.9,size*0.9,-0.7,0.7);
    }
    if(spikes>0.15){
      const spikeCount=Math.max(2,Math.round(3+spikes*3));
      for(let i=0;i<spikeCount;i++){
        const t=-0.4+(i/(spikeCount-1))*0.8;
        const bx=size*lenScale*t;
        const spikeH=size*0.35*spikes;
        p.triangle(bx, -size*0.2, bx+size*0.12, -size*0.2-spikeH, bx+size*0.24, -size*0.2);
      }
    }
  }
  function drawAnimal(p,a){
    const sp=state.species.find(s=>s.id===a.speciesId); const baseSize=sp.trophic==='carn'?9:8; const pulse=map(Math.sin(p.frameCount*0.1 + (parseInt(a.id?.slice(1))||0)*0.2),-1,1,0.9,1.1);
    const size=baseSize*pulse*(state.layerSettings?.animalScale||1); const screenX=a.x*params.cellSize+params.cellSize/2; const screenY=a.y*params.cellSize+params.cellSize/2;
    if(a.x<0||a.x>params.gridW||a.y<0||a.y>params.gridH) return;
    if(screenX<-16||screenX>canvasW+16||screenY<-16||screenY>canvasH+16) return;
    const overlayIsVegetation=state.overlay?.startsWith('vegetation');
    const [r,g,b]=a.getColor();
    let color=p.color(r,g,b);
    const origin=state.geneOrigins?.[a.speciesId];
    const divergence=origin? geneDivergence(origin, a.genes):0;
    if(divergence>0.08){
      const speciationHue=p.color(120+((a.genes.g_speed||1)*60)%120, 180, 220);
      color=p.lerpColor(color, speciationHue, clamp01((divergence-0.05)*1.2));
    }
    const speedTrait=clamp01(((a.genes?.g_speed??1)-0.8)/0.7);
    const speedHue=p.lerpColor(p.color('#4fa3ff'), p.color('#ff6b6b'), speedTrait);
    color=p.lerpColor(color, speedHue, 0.45);
    if(a.state===AnimalStates.DRINK){ color=p.lerpColor(color,p.color('#6fa4ff'),0.45); }
    else if(a.state===AnimalStates.EAT){ color=p.lerpColor(color,p.color('#68e38f'),0.3); }
    else if(a.state===AnimalStates.MATE){ color=p.lerpColor(color,p.color('#ffc1e3'),0.35); }
    const angle=Math.atan2(a.headingY||0,a.headingX||1);
    // trail
    if(a.history && a.history.length>1){
      for(let i=a.history.length-1;i>0;i--){
        const curr=a.history[i]; const prev=a.history[i-1]; const t=i/(a.history.length-1); const alpha=80*t;
        p.stroke(p.red(color), p.green(color), p.blue(color), alpha);
        p.strokeWeight(3*t);
        p.line(curr.x*params.cellSize+params.cellSize/2, curr.y*params.cellSize+params.cellSize/2, prev.x*params.cellSize+params.cellSize/2, prev.y*params.cellSize+params.cellSize/2);
      }
    }
    if(overlayIsVegetation){
      p.noStroke();
      p.fill(0,0,0,150);
      p.circle(screenX, screenY, size+10);
      p.fill(255,255,255,90);
      p.circle(screenX, screenY, size+4);
    }
    p.push(); p.translate(screenX,screenY); p.rotate(angle); const stroke=p.brightness(color)>50?'#000':'#fff'; p.strokeWeight(a.state===AnimalStates.DRINK?2:1.1); p.stroke(a.state===AnimalStates.DRINK?'#6fa4ff':stroke); p.fill(color);
    const ctx=p.drawingContext; const glowCol=`rgba(${p.red(color)},${p.green(color)},${p.blue(color)},0.6)`; ctx.shadowBlur=24; ctx.shadowColor=glowCol;
    if(state.overlay==='animals_filter' && document.getElementById('speciesDim').checked && state.overlaySpecies && state.overlaySpecies!==a.speciesId){ p.tint(255,60); p.stroke(255,80);}
    drawAnimalShape(p, sp.shape, size, a.state===AnimalStates.DRINK?'#6fa4ff':stroke, sp.trophic, a.genes.g_aspect||1, a.genes.g_spikes||0);
    ctx.shadowBlur=0; ctx.shadowColor='transparent';
    if(document.getElementById('haloToggle').checked){
      const envTemp=currentWeather?.temperature??24;
      const preferredTemp=lerp(18,32, clamp01((a.genes.g_habitatPlains??0.5)*0.4 + (a.genes.g_habitatForest??0.5)*0.35 + (a.genes.g_habitatWater??0.5)*0.25));
      const tempDiff=Math.abs(envTemp-preferredTemp);
      const stressLevel=clamp01(tempDiff/10);
      const stressColor=p.lerpColor(p.color('#68e38f'), p.color('#ff7b5f'), stressLevel);
      if(a.behavior==='graze') {p.noFill(); p.stroke(p.red(stressColor),p.green(stressColor),p.blue(stressColor),160); p.circle(0,0,size+6);} else if(a.behavior==='chase'){p.noFill(); p.stroke(p.red(stressColor),p.green(stressColor),p.blue(stressColor),200); p.circle(0,0,size+6);} else if(a.behavior==='water'){p.noFill(); p.stroke(p.lerpColor(stressColor,p.color('#6fa4ff'),0.5)); p.circle(0,0,size+7);} else if(a.behavior==='seek-mate'){p.noStroke(); p.fill(p.red(stressColor),p.green(stressColor),p.blue(stressColor),200); p.text('♡',-4,4);} else { p.noFill(); p.stroke(p.red(stressColor),p.green(stressColor),p.blue(stressColor),140); p.circle(0,0,size+5);} }
    if(a.emoteTimer>0 && a.emote){ p.textAlign(p.CENTER,p.BOTTOM); p.textSize(18); p.stroke(0); p.strokeWeight(2); p.fill(255); p.text(a.emote,0,-size-4); }
    if(selectedAnimal && selectedAnimal.id===a.id){ p.noFill(); p.stroke(255); p.strokeWeight(2); p.circle(0,0,size+8); }
    p.pop();
  }

  // --- UI ---
  function updateHud(){
    const log=state.logs[state.logs.length-1]; if(!log) return; document.getElementById('hudStep').textContent=state.step;
    document.getElementById('hudSeason').textContent=state.season; document.getElementById('hudMoist').textContent=log.moist.toFixed(2);
    document.getElementById('hudRiver').textContent=log.river; document.getElementById('hudVeg').textContent=log.veg.toFixed(2);
    document.getElementById('hudBirthDeath').textContent=`${state.births}/${state.deaths}`;
    document.getElementById('hudVegStats').textContent=`${(log.vegMin||0).toFixed(2)}/${state.vegMean.toFixed(2)}/${(log.vegMax||0).toFixed(2)}`;
    document.getElementById('hudVegFlux').textContent=`${state.vegGrowth.toFixed(2)}/${state.vegConsumed.toFixed(2)}`;
    document.getElementById('hudMoveNan').textContent=`${state.movedAgents}/${state.nanAgents}`;
    const totalPop=Object.values(log.counts).reduce((s,v)=>s+v,0);
    document.getElementById('hudSpecies').textContent=Object.values(log.counts).filter(v=>v>0).length;
    document.getElementById('hudTotalPop').textContent=totalPop;
    document.getElementById('hudShannon').textContent=(log.shannon||0).toFixed(2);
    document.getElementById('hudGenetic').textContent=(log.genetic||0).toFixed(2);
    const spread=computeTraitSpread();
    document.getElementById('hudTraits').textContent=`${spread.speed.toFixed(2)} / ${spread.vision.toFixed(2)} / ${spread.metabolism.toFixed(2)}`;
    document.getElementById('hudStability').textContent=(log.stability||0).toFixed(2);
    document.getElementById('hudExtinct').textContent=state.extinction;
    const warn=document.getElementById('movementWarning'); if(state.zeroMoveStreak>=2){warn.classList.remove('hidden');} else {warn.classList.add('hidden');}
    updateHazardUi();
  }

  function updateHazardUi(){
    const badge=document.getElementById('hazardBadge');
    const desc=document.getElementById('hazardDesc');
    if(!badge||!desc) return;
    const hazard=state.currentHazard;
    if(!hazard){
      badge.textContent='平穏';
      badge.classList.remove('active');
      desc.textContent='天候以外の脅威は発生していません。';
      return;
    }
    badge.textContent=hazard.label;
    badge.classList.add('active');
    const remain=Math.max(0,(hazard.until||state.step)-state.step);
    desc.textContent=`残り${remain}ステップ / ${hazard.detail} (強度${hazard.severity?.toFixed(2)??'-'})`;
  }
  function updateTrophicPanel(){
    const log=state.logs[state.logs.length-1]; if(!log) return;
    let herb=0, carn=0, omn=0; const counts=log.counts||{};
    Object.entries(counts).forEach(([id,val])=>{ const sp=state.species.find(s=>s.id===id); if(!sp) return; if(sp.trophic==='herb') herb+=val; else if(sp.trophic==='carn') carn+=val; else omn+=val; });
    const total=Math.max(herb+carn+omn,1);
    const setBar=(id,val)=>{ const bar=document.getElementById(id); if(bar) bar.style.width=`${Math.min(100,(val/total)*100)}%`; };
    const setVal=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
    setBar('herbFill',herb); setBar('carnFill',carn); setBar('omnFill',omn);
    setVal('herbValue',herb); setVal('carnValue',carn); setVal('omnValue',omn);
    const diversityLabel=(val)=>{ if(!Number.isFinite(val)) return '-'; if(val<0.06) return '多様性:低'; if(val<0.14) return '多様性:中'; return '多様性:高'; };
    const diversityText=diversityLabel(log.shannon);
    const plantBiomass=Math.max(0,(state.vegMean||0)*state.cells.length);
    const animalBiomass=state.animals.filter(a=>a.alive).reduce((sum,a)=>{ const sp=state.species.find(s=>s.id===a.speciesId); const body=(sp?.baseSpeed??1)*(sp?.metabolism??1); return sum + body*(a.energy??1); },0);
    const ratio=plantBiomass>0? (animalBiomass/plantBiomass):0;
    const biomassText=`植物 ${plantBiomass.toFixed(1)} / 動物 ${animalBiomass.toFixed(1)} (A/P ${ratio.toFixed(2)})`;
    setVal('miniDiversity', diversityText);
    setVal('miniBiomass', biomassText);
  }
  function updateInspector(weather=currentWeather){
    const box=document.getElementById('selectedInfo');
    const inspector=document.getElementById('inspector');
    if(!selectedAnimal||!selectedAnimal.alive){
      box.textContent='クリックで個体情報を表示';
      if(inspector){ inspector.innerHTML='<div class="inspector-empty">個体をクリックするとDNAと状態を表示します</div>'; }
      return;
    }
    const sp=state.species.find(s=>s.id===selectedAnimal.speciesId); const hunger=(1-selectedAnimal.energy), thirst=(1-selectedAnimal.hydration);
    box.textContent=`種: ${sp.name}\n性別: ${selectedAnimal.sex}\n年齢: ${selectedAnimal.age}\n状態: ${selectedAnimal.state} / 行動:${selectedAnimal.behavior}\n飢え:${hunger.toFixed(2)} 渇き:${thirst.toFixed(2)}\nE:${selectedAnimal.energy.toFixed(2)} H:${selectedAnimal.hydration.toFixed(2)}\n直近イベント:${selectedAnimal.lastEvent}\ngenes:${Object.entries(selectedAnimal.genes).map(([k,v])=>`${k}:${v.toFixed(2)}`).join(' ')}`;
    if(!inspector) return;

    const speed=clampRange(sp.baseSpeed*lerp(0.7,1.3,selectedAnimal.genes.g_speed),0.2,2.5);
    const vision=clampRange(sp.vision*lerp(0.7,1.3,selectedAnimal.genes.g_vision),2,12);
    const metabolism=clampRange(sp.metabolism*selectedAnimal.genes.g_metabolism,0.2,3);
    const mutationRate=parseFloat(document.getElementById('mutRate').value)||0;
    const statusIcon=selectedAnimal.state===AnimalStates.MATE?'❤️':(selectedAnimal.state===AnimalStates.DRINK?'💧':(selectedAnimal.state===AnimalStates.EAT?'🍃':'🚶'));
    const weatherIcon=weather?.weather==='RAINY'?'🌧️':'☀️';
    const temperature=weather?.temperature ?? 0;
    const timeline=(selectedAnimal.timeline||[]).slice(-8);
    const timelineHtml=timeline.length? timeline.map(ev=>`<div class="inspector-row timeline"><span>Step ${ev.step}</span><span>${ev.label}${ev.detail?` / ${ev.detail}`:''}</span></div>`).join('') : '<div class="inspector-empty">行動記録はまだありません</div>';
      inspector.innerHTML=`
      <div class="inspector-heading">${sp.name} <small>(${sp.id})</small></div>
      <div class="inspector-row"><span>状態</span><span>${selectedAnimal.state} ${statusIcon} / ${selectedAnimal.behavior}</span></div>
      <div class="inspector-row"><span>世代</span><span>${selectedAnimal.generation||1} / 系統 ${selectedAnimal.lineageId||'-'}</span></div>
      <div class="inspector-row"><span>年齢</span><span>${selectedAnimal.age}</span></div>
      <div class="inspector-row"><span>エネルギー</span><span>${(selectedAnimal.energy*100).toFixed(0)}% / 水分 ${(selectedAnimal.hydration*100).toFixed(0)}%</span></div>
      <div class="inspector-row"><span>突然変異</span><span>${(1+mutationRate).toFixed(2)}x</span></div>
      <div class="inspector-row"><span>気候</span><span>${weatherIcon} ${temperature.toFixed(1)}°C</span></div>
      <div class="inspector-row genetics"><span>DNA</span><span>速度:${speed.toFixed(2)}  視野:${vision.toFixed(2)}  代謝:${metabolism.toFixed(2)}  渇き耐性:${selectedAnimal.genes.g_thirstTol.toFixed(2)}  空腹耐性:${selectedAnimal.genes.g_starveTol.toFixed(2)}</span></div>
      <div class="inspector-subhead">ライフログ</div>
      ${timelineHtml}
    `;
  }
  const mutationGeneList=[
    {key:'g_speed', label:'速度'},
    {key:'g_vision', label:'視野'},
    {key:'g_metabolism', label:'代謝'},
    {key:'g_fertility', label:'繁殖'},
    {key:'g_thirstTol', label:'渇き耐性'},
    {key:'g_starveTol', label:'飢餓耐性'},
  ];
  function summarizeMutations(){
    const baseline=defaultGenes();
    const alive=state.animals.filter(a=>a.alive);
    const map=new Map();
    alive.forEach(a=>{
      const entry=map.get(a.speciesId) || {count:0, sums:{}};
      entry.count++;
      mutationGeneList.forEach(g=>{ entry.sums[g.key]=(entry.sums[g.key]||0)+(a.genes[g.key]??baseline[g.key]??1); });
      map.set(a.speciesId, entry);
    });
    const origins=state.geneOrigins||{};
    return state.species.map(sp=>{
      const entry=map.get(sp.id); if(!entry||entry.count===0) return {species:sp, count:0, averages:null};
      const averages={}; mutationGeneList.forEach(g=>{ averages[g.key]=(entry.sums[g.key]||0)/entry.count; });
      return {species:sp, count:entry.count, averages, origin:origins[sp.id]||baseline};
    });
  }
  function mutationColor(delta){
    if(delta>0.35) return '#f6b26b';
    if(delta>0.15) return '#d6e96b';
    if(delta<-0.2) return '#6ca7ff';
    if(delta<-0.08) return '#8bc4ff';
    return '#68e38f';
  }
  function renderMutationMap(){
    const host=document.getElementById('mutationMap'); if(!host) return;
    const summary=summarizeMutations();
    if(!summary.length){ host.textContent='データなし'; return; }
    const hasLiving=summary.some(s=>s.count>0);
    if(!hasLiving){ host.textContent='生存個体がいません'; return; }
    host.innerHTML='';
    summary.forEach(item=>{
      if(!item.averages) return;
      const row=document.createElement('div'); row.className='mutation-row';
      const head=document.createElement('div'); head.className='mutation-head';
      head.innerHTML=`<span>${item.species.name}</span><span>${item.count} 個体</span>`;
      const bars=document.createElement('div'); bars.className='gene-bars';
      mutationGeneList.forEach(g=>{
        const val=item.averages[g.key]; if(!Number.isFinite(val)) return;
        const origin=item.origin?.[g.key] ?? 1;
        const delta=val-origin; const pct=Math.round(delta/origin*100);
        const bar=document.createElement('div'); bar.className='gene-bar';
        bar.style.setProperty('--bar-color', mutationColor(delta));
        bar.innerHTML=`<strong>${g.label}</strong><span>${origin.toFixed(2)} → ${val.toFixed(2)} (${pct>=0?'+':''}${pct}%)</span>`;
        bars.appendChild(bar);
      });
      row.appendChild(head); row.appendChild(bars); host.appendChild(row);
    });
  }
  function logMsg(msg){ const logBox=document.getElementById('logBox'); const t=`[${state.step}] ${msg}`; state.events.push({type:'log', msg}); logBox.textContent += t+'\n'; logBox.scrollTop=logBox.scrollHeight; }
  function updateChart(){
    if(!window.popChartInstance){ const ctx=document.getElementById('popChart'); window.popChartInstance=new Chart(ctx,{type:'line',data:{labels:[],datasets:[]},options:{animation:false, plugins:{legend:{labels:{color:'#dce8ff'}}}, scales:{x:{ticks:{color:'#9fb0c3'}}, pop:{type:'linear', position:'left', ticks:{color:'#9fb0c3'}}, score:{type:'linear', position:'right', ticks:{color:'#9fb0c3'}}}}}); }
    if(state.step%5!==0) return; const chart=window.popChartInstance; const log=state.logs[state.logs.length-1]; if(!log) return; const labels=state.logs.map(l=>l.step);
    const totalData=state.logs.map(l=>Object.values(l.counts).reduce((s,v)=>s+v,0));
    chart.data.labels=labels; chart.data.datasets=[{label:'総個体数', data:totalData, borderColor:'#ffffff', tension:0.25, yAxisID:'pop'},
      ...state.species.map(sp=>({label:sp.name, data:state.logs.map(l=>l.counts[sp.id]||0), borderColor:sp.color, tension:0.2, spanGaps:true, fill:false, yAxisID:'pop'})),
      {label:'Shannon', data:state.logs.map(l=>l.shannon||0), borderColor:'#7fe8ff', borderDash:[6,4], tension:0.25, yAxisID:'score'},
      {label:'遺伝多様度', data:state.logs.map(l=>l.genetic||0), borderColor:'#ffb347', borderDash:[3,3], tension:0.25, yAxisID:'score'},
      {label:'植生合計', data:state.logs.map(l=>l.veg), borderColor:'#68e38f', borderDash:[4,4], tension:0.2, yAxisID:'score'}];
    chart.update('none');
  }
  function downloadCsv(){
    const rows=['step,season,moist,veg_total,herb_total,carn_total,births,deaths,hunts,nan,shannon,genetic,stability,extinction,'+state.species.map(s=>s.id).join(',')];
    state.logs.forEach(l=>{const herb=Object.entries(l.counts).filter(([id])=>state.species.find(s=>s.id===id)?.trophic==='herb').reduce((s,[,v])=>s+v,0); const carn=Object.entries(l.counts).filter(([id])=>state.species.find(s=>s.id===id)?.trophic==='carn').reduce((s,[,v])=>s+v,0); rows.push([l.step,l.season,l.moist.toFixed(3),l.veg.toFixed(3),herb,carn,l.births,l.deaths,l.kills,l.nan,(l.shannon||0).toFixed(3),(l.genetic||0).toFixed(3),(l.stability||0).toFixed(3),l.extinction,...state.species.map(s=>l.counts[s.id])].join(','));});
    try{const blob=new Blob([rows.join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='biosphere-log.csv'; a.click();}
    catch(err){logMsg('CSV保存失敗:'+err.message);} }

  // --- TEST ---
  let lastChecksum=null; function runTest(){ const oldState=state; state=createState('test-seed'); uiParams={...initialUiParams}; generateTerrain(document.getElementById('patternSelect').value); spawnAnimals(); for(let i=0;i<100;i++) stepSimulation(); const counts=speciesCounts(); const hash=Object.values(counts).join('-')+'-'+state.logs[state.logs.length-1].veg.toFixed(3); const status=document.getElementById('testStatus'); if(lastChecksum===hash){console.log('前回と一致',hash); status.textContent='前回と一致';} else {console.log('checksum',hash); status.textContent='checksum:'+hash; lastChecksum=hash;} state=oldState; }
  function runSelfTest(){
    const status=document.getElementById('selfTestStatus'); const oldState=state; const oldUi={...uiParams};
    state=createState('selftest'); uiParams={...initialUiParams}; generateTerrain('meandering_river'); spawnAnimals();
    let movedTotal=0, growthTotal=0, consumedTotal=0;
    for(let i=0;i<200;i++){ stepSimulation(); movedTotal+=state.movedAgents; growthTotal+=state.vegGrowth; consumedTotal+=state.vegConsumed; }
    const counts=speciesCounts(); const log=state.logs[state.logs.length-1];
    const nanOK=log.nan===0; const moveAvg=movedTotal/200/Math.max(1,state.animals.length); const moveOK=moveAvg>0.2;
    const vegEnd=state.cells.reduce((s,c)=>s+c.veg.grass+c.veg.shrub+c.veg.tree,0); const vegOK=growthTotal>0 && consumedTotal>0;
    const herbAlive=Object.entries(counts).some(([id,v])=> (state.species.find(s=>s.id===id)?.trophic==='herb') && v>0);
    const carnAlive=Object.entries(counts).some(([id,v])=> (state.species.find(s=>s.id===id)?.trophic==='carn') && v>0);
    const passed=nanOK && moveOK && vegOK && herbAlive && carnAlive;
    status.textContent=passed?'PASS':'FAIL'; status.style.background=passed?'#123b2a':'#3b1222';
    status.title=`NaN:${log.nan} 移動平均:${moveAvg.toFixed(2)} 成長:${growthTotal.toFixed(2)} 摂食:${consumedTotal.toFixed(2)} herb:${herbAlive} carn:${carnAlive}`;
    if(!passed){ logMsg(`SelfTest失敗 nan:${log.nan} move:${moveAvg.toFixed(2)} vegG:${growthTotal.toFixed(2)} vegC:${consumedTotal.toFixed(2)}`); }
    state=oldState; uiParams=oldUi; resetSpeciesEditor();
  }

  function runHeadless3000(){
    const status=document.getElementById('headlessStatus');
    const oldState=state; const oldUi={...uiParams};
    state=createState('headless'); uiParams={...initialUiParams}; generateTerrain('meandering_river'); spawnAnimals();
    let movedTotal=0; for(let i=0;i<3000;i++){ stepSimulation(); movedTotal+=state.movedAgents; }
    const log=state.logs[state.logs.length-1]; const avgMove=movedTotal/3000/Math.max(1,state.animals.length);
    const leftDensity=state.density.slice(0,params.gridH*4).reduce((s,v)=>s+v,0);
    const riverDensity=state.cells.reduce((s,c,idx)=>s+(c.river?state.density[idx]:0),0);
    const tests=[
      {name:'NaN極小', pass:log.nan<=1},
      {name:'移動停滞なし', pass:avgMove>0.05},
      {name:'左端偏りなし', pass:leftDensity<state.animals.length*0.35},
      {name:'水辺渋滞回避', pass:riverDensity<state.animals.length*0.5},
      {name:'草成長バランス', pass:log.veg>0.05 && log.veg<2.5},
    ];
    const passed=tests.every(t=>t.pass);
    status.textContent=passed?'PASS':'FAIL'; status.style.background=passed?'#123b2a':'#3b1222';
    status.title=tests.map(t=>`${t.name}:${t.pass?'OK':'NG'}`).join(' / ')+` 移動平均:${avgMove.toFixed(3)} NaN:${log.nan}`;
    state=oldState; uiParams=oldUi; resetSpeciesEditor();
  }

  // --- INIT ---
  function clampPanelToOverlay(id){
    const panel=document.getElementById(id);
    const overlay=document.getElementById('mapOverlay');
    if(!panel || !overlay) return;
    const left=parseFloat(panel.style.left)||panel.offsetLeft||0;
    const top=parseFloat(panel.style.top)||panel.offsetTop||0;
    const maxLeft=Math.max(8, overlay.clientWidth - panel.offsetWidth - 8);
    const maxTop=Math.max(8, overlay.clientHeight - panel.offsetHeight - 8);
    panel.style.left=`${Math.min(Math.max(8,left), maxLeft)}px`;
    panel.style.top=`${Math.min(Math.max(8,top), maxTop)}px`;
  }
  function resetFloatingPanels(){
    const legend=document.getElementById('legendPanel'); if(legend){ legend.style.left='20px'; legend.style.top='20px'; legend.style.width=''; legend.style.height=''; }
    const trophic=document.getElementById('trophicPanel'); if(trophic){ trophic.style.left='20px'; trophic.style.top='320px'; trophic.style.width=''; trophic.style.height=''; }
    uiParams.miniMapPos=null; resizeCanvasToHost();
    uiParams.mapColWidth='minmax(980px,1.15fr)';
    document.documentElement.style.setProperty('--map-col-width',uiParams.mapColWidth);
    const main=document.querySelector('main'); if(main){ main.classList.remove('map-expanded'); }
    state.mapExpanded=false; updateExpandButton();
    clampPanelToOverlay('legendPanel');
    clampPanelToOverlay('trophicPanel');
  }
  function updateExpandButton(){ const btn=document.getElementById('toggleExpand'); const main=document.querySelector('main'); if(!btn||!main) return; const expanded=main.classList.contains('map-expanded'); btn.textContent=expanded?'サイドパネル表示':'マップを最大化'; btn.setAttribute('aria-pressed', expanded?'true':'false'); }
  function toggleExpandMap(){
    const main=document.querySelector('main'); if(!main) return;
    const expanded=main.classList.toggle('map-expanded');
    if(expanded){
      uiParams.mapColWidth=getComputedStyle(document.documentElement).getPropertyValue('--map-col-width')||uiParams.mapColWidth;
      document.documentElement.style.setProperty('--map-col-width','minmax(1480px,1.6fr)');
      state.mapExpanded=true;
    } else {
      document.documentElement.style.setProperty('--map-col-width', uiParams.mapColWidth||'minmax(980px,1.15fr)');
      state.mapExpanded=false;
    }
    resizeCanvasToHost(); updateExpandButton();
    clampPanelToOverlay('legendPanel');
    clampPanelToOverlay('trophicPanel');
  }
  function setPerformanceMode(lightweight){ state.renderEffects=!lightweight; if(lightweight){ particles.clear(); document.body.classList.add('effects-off'); } else { document.body.classList.remove('effects-off'); } const cb=document.getElementById('performanceMode'); if(cb) cb.checked=!!lightweight; }
  function setHudVisible(show){ state.hudVisible=show; document.body.classList.toggle('hud-hidden', !show); const cb=document.getElementById('hudMode'); if(cb) cb.checked=!!show; }
  function setupLayoutHandle(){
    const handle=document.getElementById('layoutHandle'); const main=document.querySelector('main'); const mapStage=document.getElementById('mapStage');
    if(!handle || !main || !mapStage) return;
    handle.addEventListener('mousedown',e=>{
      e.preventDefault(); if(main.classList.contains('map-expanded')) return; main.classList.add('resizing');
      const startX=e.clientX; const startW=mapStage.getBoundingClientRect().width;
      const onMove=ev=>{ const delta=ev.clientX-startX; const newW=Math.max(720, startW+delta); uiParams.mapColWidth=`${newW}px`; document.documentElement.style.setProperty('--map-col-width', uiParams.mapColWidth); resizeCanvasToHost(); };
      const onUp=()=>{ main.classList.remove('resizing'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    });
    handle.addEventListener('dblclick',()=>{ uiParams.mapColWidth='minmax(980px,1.15fr)'; document.documentElement.style.setProperty('--map-col-width',uiParams.mapColWidth); resizeCanvasToHost(); updateExpandButton(); });
  }
  function init(){
    resetSpeciesEditor();
    if(localStorage.getItem(STORAGE_KEY)){ loadSpeciesLocal(true); }
    generateTerrain(document.getElementById('patternSelect').value);
    spawnAnimals();
    const canvasHost=document.getElementById('canvasHost'); if(canvasHost){ canvasHost.addEventListener('contextmenu',e=>{ if(terrainEditMode) e.preventDefault(); }); }
    setupLayoutHandle();
    startP5();
    bindUI();
    setPerformanceMode(document.getElementById('performanceMode')?.checked||false);
    setHudVisible(document.getElementById('hudMode')?.checked??true);
    updateExpandButton();
    makeDraggable('legendPanel');
    makeDraggable('trophicPanel');
    resetFloatingPanels();
    window.addEventListener('resize',()=>{ clampPanelToOverlay('legendPanel'); clampPanelToOverlay('trophicPanel'); });
  }
  function bindUI(){
    const resetBtn=document.getElementById('resetFloating'); if(resetBtn) resetBtn.addEventListener('click',resetFloatingPanels);
    const centerBtn=document.getElementById('centerLegend'); if(centerBtn) centerBtn.addEventListener('click',()=>{ const legend=document.getElementById('legendPanel'); if(legend){ legend.style.left='20px'; legend.style.top='20px'; } });
    const trophicPanel=document.getElementById('trophicPanel'); if(trophicPanel) trophicPanel.addEventListener('dblclick', resetFloatingPanels);
    document.querySelectorAll('button[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
      const act=btn.dataset.action; if(act==='start'){ state.running=true; startBgmLoop(); } else if(act==='stop'){ state.running=false; stopBgm(); } else if(act==='reset'){ state.running=false; state=createState(document.getElementById('seedInput').value); generateTerrain(document.getElementById('patternSelect').value); spawnAnimals(); selectedAnimal=null; seedPlants(); applyLayerSettingsFromUI(); stopBgm(); }
      else if(act==='regen'){ state.seed=document.getElementById('seedInput').value; state.rng=createRng(state.seed); generateTerrain(document.getElementById('patternSelect').value); seedPlants(); applyLayerSettingsFromUI(); }
      else if(act==='download-csv') downloadCsv(); else if(act==='run-test') runTest(); else if(act==='self-test') runSelfTest(); else if(act==='headless-3000') runHeadless3000();
      else if(act==='add-species') addCustomSpeciesFromForm(); else if(act==='export-species') exportSpeciesJSON(); else if(act==='import-species') importSpeciesJSON(); else if(act==='save-species') saveSpeciesLocal(); else if(act==='load-species') loadSpeciesLocal();
    }));
    document.querySelectorAll('button[data-preset]').forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.preset)));
    document.querySelectorAll('input[name="overlay"]').forEach(r=>r.addEventListener('change',e=>{state.overlay=e.target.value; if(state.overlay.startsWith('vegetation')) ensureVegetationLayersVisible(); state.needsBgRedraw=true; updateLegendFilterPanel();}));
    document.getElementById('overlaySpecies').addEventListener('change',e=>{state.overlaySpecies=e.target.value; updateLegendFilterPanel();});
    document.getElementById('boundaryMode').addEventListener('change',e=>{state.boundaryMode=e.target.value;});
    const expandBtn=document.getElementById('toggleExpand'); if(expandBtn){ expandBtn.addEventListener('click', toggleExpandMap); updateExpandButton(); }
    const perfMode=document.getElementById('performanceMode'); if(perfMode){ perfMode.addEventListener('change',e=>setPerformanceMode(e.target.checked)); }
    const hudMode=document.getElementById('hudMode'); if(hudMode){ hudMode.addEventListener('change',e=>setHudVisible(e.target.checked)); }
    const terrainToggle=document.getElementById('toggleTerrain');
    if(terrainToggle){ terrainToggle.addEventListener('change',e=>{ state.layerSettings.terrain=e.target.checked; state.needsBgRedraw=true; updateLegendFilterPanel(); }); }
    const vegetationLayerToggle=document.getElementById('toggleVegetationLayer');
    if(vegetationLayerToggle){ vegetationLayerToggle.addEventListener('change',e=>{ state.layerSettings.vegetation=e.target.checked; state.needsBgRedraw=true; updateLegendFilterPanel(); }); }
    const animalToggle=document.getElementById('toggleAnimals');
    if(animalToggle){ animalToggle.addEventListener('change',e=>{ state.layerSettings.animals=e.target.checked; updateLegendFilterPanel(); }); }
    const vegBoost=document.getElementById('vegBoost');
    if(vegBoost){ const sync=()=>{ state.layerSettings.vegetationBoost=parseFloat(vegBoost.value)||1; updateLegendFilterPanel(); }; vegBoost.addEventListener('input',sync); sync(); }
    const animalScale=document.getElementById('animalScale');
    if(animalScale){ const sync=()=>{ state.layerSettings.animalScale=parseFloat(animalScale.value)||1; updateLegendFilterPanel(); }; animalScale.addEventListener('input',sync); sync(); }
    const animalOpacity=document.getElementById('animalOpacity');
    if(animalOpacity){ const sync=()=>{ state.layerSettings.animalOpacity=parseFloat(animalOpacity.value)||1; updateLegendFilterPanel(); }; animalOpacity.addEventListener('input',sync); sync(); }
    applyLayerSettingsFromUI();
    document.getElementById('riverThresh').addEventListener('change',()=>{ const pat=document.getElementById('patternSelect').value; updateRivers(pat, PATTERN_CONFIGS[pat]); });
    document.getElementById('riverWidthCtrl').addEventListener('input',()=>{ const pat=document.getElementById('patternSelect').value; updateRivers(pat, PATTERN_CONFIGS[pat]); });
    const waterSlider=document.getElementById('waterLevel');
    if(waterSlider){ waterSlider.addEventListener('input',()=>{ state.waterLevel=parseFloat(waterSlider.value)||0; const pat=document.getElementById('patternSelect').value; updateRivers(pat, PATTERN_CONFIGS[pat]); }); state.waterLevel=parseFloat(waterSlider.value)||0; }
    const brushSlider=document.getElementById('brushSize'); const brushLabel=document.getElementById('brushSizeValue');
    if(brushSlider && brushLabel){ const sync=()=>brushLabel.textContent=brushSlider.value; brushSlider.addEventListener('input',sync); sync(); }
    const terrainBtn=document.getElementById('terrainModeToggle'); if(terrainBtn){ terrainBtn.addEventListener('click',()=>{ terrainEditMode=!terrainEditMode; updateTerrainEditButton(); }); updateTerrainEditButton(); }
    const vegetationToggle=document.getElementById('showVegetation');
    if(vegetationToggle){
      const syncVeg=()=>{ state.showVegetation=vegetationToggle.checked; state.needsBgRedraw=true; if(overlayLayer){ overlayLayer.clear(); } updateLegendFilterPanel(); };
      vegetationToggle.addEventListener('change',syncVeg);
      syncVeg();
    }
    const trailMute=document.getElementById('trailEffectMute');
    if(trailMute){ const syncTrail=()=>{ state.trailIntensity=trailMute.checked?0.35:0.9; }; trailMute.addEventListener('change',syncTrail); syncTrail(); }
    document.getElementById('speciesEditor').addEventListener('input',e=>{
      const kind=e.target.dataset.kind; const id=e.target.dataset.id; if(kind==='param'){ const sp=state.species.find(s=>s.id===id); sp[e.target.dataset.field]=parseFloat(e.target.value); }
    });
    document.getElementById('speciesEditor').addEventListener('change',e=>{const kind=e.target.dataset.kind; const id=e.target.dataset.id; if(kind==='mode'){ const sp=state.species.find(s=>s.id===id); sp.behaviorMode=e.target.value; }});
    document.getElementById('speciesEditor').addEventListener('click',e=>{const kind=e.target.dataset.kind; const id=e.target.dataset.id; if(kind==='respawn'){ spawnAnimals(); }});
  }
  window.addEventListener('load',init);
