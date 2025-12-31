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
  const clampRange=(v,min,max)=>{ if(!Number.isFinite(v)) return (min+max)/2; return Math.max(min, Math.min(max, v)); };
  const lerp=(a,b,t)=>a+(b-a)*t;
  const wrap=(v,max)=>{ if(!Number.isFinite(v)) return 0; return ((v%max)+max)%max; };
  const torusDelta=(a,b,size)=>{ const d=((a-b+size/2)%size)-size/2; return Number.isFinite(d)?d:0; };
  const safeNorm=(x,y)=>{const d=Math.hypot(x,y); if(!Number.isFinite(d) || d<1e-9) return null; return d;};
  const toId=str=>str.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||`sp_${Date.now()}`;
  const parseDiet=str=>{ const [g,p,s,t]=str.split(',').map(v=>parseFloat(v)||0); return {grass:clamp01(g||0), poison:clamp01(p||0), shrub:clamp01(s||0), tree:clamp01(t||0)}; };
  const createAnimalGrid=()=>Array.from({length:params.gridW*params.gridH},()=>[]);
  const gridIndex=(x,y,boundary)=>{ const w=params.gridW, h=params.gridH; const wrapX=boundary==='wrap'?wrap(x,w):clampRange(x,0,w-1e-3); const wrapY=boundary==='wrap'?wrap(y,h):clampRange(y,0,h-1e-3); return Math.floor(wrapY)*w+Math.floor(wrapX); };
  const registerAnimalToGrid=(animal, state)=>{ const idx=gridIndex(animal.x, animal.y, state.boundaryMode); animal.gridIdx=idx; state.animalGrid[idx].push(animal); };
  const moveAnimalInGrid=(animal, state)=>{ const newIdx=gridIndex(animal.x, animal.y, state.boundaryMode); if(animal.gridIdx===newIdx) return; const cell=state.animalGrid[animal.gridIdx]||[]; const pos=cell.indexOf(animal); if(pos>=0) cell.splice(pos,1); animal.gridIdx=newIdx; state.animalGrid[newIdx].push(animal); };
  const removeAnimalFromGrid=(animal, state)=>{ const cell=state.animalGrid[animal.gridIdx]; if(!cell) return; const idx=cell.indexOf(animal); if(idx>=0) cell.splice(idx,1); };
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

  // --- STATE ---
  const params={gridW:96, gridH:64, cellSize:8};
  const VEG_UPDATE_INTERVAL=30;
  const baseSpecies=[
    {id:'hare', name:'ウサギ', trophic:'herb', color:'#a7f18c', shape:'ellipse', baseSpeed:1.25, vision:5, metabolism:0.8, waterNeed:0.6, fertility:0.7, socialMode:'herd', preyList:[],
      poisonTolerance:0.4, thornHandling:0.4, dietPreference:{grass:0.72,poison:0.1,shrub:0.13,tree:0.05}},
    {id:'deer', name:'シカ', trophic:'herb', color:'#c5d16f', shape:'antler', baseSpeed:1.0, vision:6.5, metabolism:0.9, waterNeed:0.8, fertility:0.48, socialMode:'herd', preyList:[],
      poisonTolerance:0.5, thornHandling:0.55, dietPreference:{grass:0.55,poison:0.1,shrub:0.3,tree:0.15}},
    {id:'boar', name:'イノシシ', trophic:'omn', color:'#d3aa7c', shape:'tusk', baseSpeed:1.05, vision:5.5, metabolism:1.05, waterNeed:0.75, fertility:0.5, socialMode:'pair', preyList:['hare'],
      poisonTolerance:0.7, thornHandling:0.7, dietPreference:{grass:0.4,poison:0.12,shrub:0.35,tree:0.13}},
    {id:'wolf', name:'オオカミ', trophic:'carn', color:'#ffad7d', shape:'arrow', baseSpeed:1.3, vision:7.2, metabolism:1.1, waterNeed:0.7, fertility:0.4, socialMode:'pack', preyList:['hare','deer','boar','zebra'],
      poisonTolerance:0.3, thornHandling:0.4, dietPreference:{}},
    {id:'bear', name:'クマ', trophic:'carn', color:'#f7c173', shape:'round', baseSpeed:0.95, vision:6, metabolism:1.3, waterNeed:0.85, fertility:0.27, socialMode:'solo', preyList:['hare','deer','boar'],
      poisonTolerance:0.65, thornHandling:0.75, dietPreference:{grass:0.2,poison:0.05,shrub:0.2,tree:0.55}},
    {id:'zebra', name:'シマウマ', trophic:'herb', color:'#b5c7ff', shape:'stripe', baseSpeed:1.15, vision:6.2, metabolism:0.95, waterNeed:0.7, fertility:0.52, socialMode:'herd', preyList:[],
      poisonTolerance:0.45, thornHandling:0.6, dietPreference:{grass:0.68,poison:0.08,shrub:0.18,tree:0.06}},
  ];
  const defaultGenes=()=>({g_speed:1,g_vision:1,g_metabolism:1,g_fertility:1,g_thirstTol:1,g_starveTol:1});
  const initialUiParams={rainyLen:600,dryLen:400,shareRate:0.6,leaderBonus:1.2};
  const presets={
    temperate:{seed:'temperate', species:JSON.parse(JSON.stringify(baseSpecies)), counts:{hare:28,deer:18,boar:12,wolf:8,bear:4,zebra:16}},
    herdFocus:{seed:'herd', species:JSON.parse(JSON.stringify(baseSpecies)).map(sp=>({...sp, fertility:sp.id==='hare'?0.8:sp.id==='deer'?0.55:sp.fertility})), counts:{hare:36,deer:28,boar:10,wolf:8,bear:3,zebra:20}},
    predatorHeavy:{seed:'predator', species:JSON.parse(JSON.stringify(baseSpecies)).map(sp=>({...sp, socialMode:sp.id==='wolf'?'pack':sp.socialMode})), counts:{hare:18,deer:14,boar:10,wolf:14,bear:6,zebra:12}},
    tutorial:{seed:'tutorial', species:JSON.parse(JSON.stringify(baseSpecies)).map(sp=>({...sp, baseSpeed:lerp(0.9,1.1,0.5)})), counts:{hare:24,deer:18,boar:10,wolf:6,bear:2,zebra:14}},
  };
  function createState(seed){
    return {seed, rng:createRng(seed), perlin:null, cells:[], animals:[], species:JSON.parse(JSON.stringify(baseSpecies)), overlay:'animals_all', overlayAlpha:0.6, overlaySpecies:null, boundaryMode:'bounce',
      running:false, step:0, season:'雨季', seasonCounter:0, events:[], idCounter:0, lastError:null, renderSimple:false, logs:[], chartData:[], averages:[], births:0, deaths:0, kills:0, spawnBuffer:[], density:new Float32Array(params.gridW*params.gridH),
      movedAgents:0, nanAgents:0, zeroMoveStreak:0, vegMin:0, vegMax:0, vegMean:0, vegGrowth:0, vegConsumed:0,
      shannon:0, genetic:0, stability:0, extinction:0, stabilityWindow:[], prevCounts:{},
      animalGrid:[], needsBgRedraw:true, lastRiverCount:0, lastMoistAvg:0, lastVegAvg:0};
  }
  let state=createState('bs-demo');
  let uiParams={...initialUiParams};

  // --- TERRAIN ---
  function generateTerrain(pattern){
    const rng=state.rng; const perlin=createPerlin(rng); state.perlin=perlin; const w=params.gridW, h=params.gridH; const arr=new Array(w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){const idx=y*w+x; arr[idx]={elev:0, wet:0, moist:0.5, river:false, riverWidth:0,
      veg:{grass:0.28+rng()*0.18, poison:0.05+rng()*0.08, shrub:0.15+rng()*0.1, shrubThorn:0.08+rng()*0.08, tree:0.1+rng()*0.05}, terrain:'平地'};}
    const elevScale=pattern==='mountain_valley'?0.045:0.07; const wetScale=pattern==='delta_wetland'?0.06:0.08;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=y*w+x; const warp=pattern==='meandering_river'?Math.sin(y*0.05)*0.05:0; const elev=perlin.noise(x*elevScale+warp, y*elevScale);
        const wet=perlin.noise((x+100)*wetScale,(y+30)*wetScale);
        arr[idx].elev=clamp01(pattern==='mountain_valley'?Math.pow(elev,1.2):elev);
        arr[idx].wet=clamp01(pattern==='delta_wetland'?Math.min(1,wet*0.75+0.25):wet);
      }
    }
    state.cells=arr; updateRivers(pattern);
  }
  function updateRivers(pattern){
    const w=params.gridW, h=params.gridH; const riverFactor=parseFloat(document.getElementById('riverThresh').value)||1.2; const widthCtrl=parseFloat(document.getElementById('riverWidthCtrl').value)||1;
    let riverCount=0;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx=y*w+x; const c=state.cells[idx]; const noise=state.perlin.noise((x+200)*0.04,(y+200)*0.04);
        const riverNoise=state.perlin.noise((x+50)*0.07,(y-40)*0.07);
        const meander=Math.sin(y*0.07+x*0.05)*0.08;
        const riverScore=(1-c.elev)*0.9 + c.wet*0.4 + noise*0.4 + riverNoise*0.3 + meander;
        const active=riverScore>riverFactor;
        c.river=active; c.riverWidth=active?clamp01((riverScore-riverFactor)*widthCtrl):0;
        const moistBase=0.35 + c.wet*0.4 + (c.river?0.25:0);
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
    if(pattern==='delta_wetland' && riverCount===0){ document.getElementById('riverThresh').value=Math.max(0.6, riverFactor-0.2).toFixed(2); updateRivers(pattern); return; }
    state.needsBgRedraw=true;
  }

  // --- SPECIES & ANIMALS ---
  function resetSpeciesEditor(){
    const host=document.getElementById('speciesEditor'); host.innerHTML=''; const select=document.getElementById('overlaySpecies'); select.innerHTML='';
    state.species.forEach((sp,idx)=>{
      const wrap=document.createElement('details'); wrap.open=true; wrap.innerHTML=`<summary>${sp.name} (${sp.trophic})</summary>`;
      wrap.innerHTML+=`<div class="row" style="margin-top:6px;"><label>個体数<input data-kind="count" data-id="${sp.id}" type="number" min="0" value="20"></label><button data-kind="respawn" data-id="${sp.id}">再スポーン</button></div>`;
      const details=document.createElement('details'); details.innerHTML='<summary>詳細設定</summary>';
      details.innerHTML+=`<div class="row" style="margin-top:6px;"><label>移動速度<input data-kind="param" data-field="baseSpeed" data-id="${sp.id}" type="number" step="0.1" value="${sp.baseSpeed}"></label><label>索敵範囲<input data-kind="param" data-field="vision" data-id="${sp.id}" type="number" step="0.1" value="${sp.vision}"></label></div>`;
      details.innerHTML+=`<div class="row" style="margin-top:6px;"><label>代謝コスト<input data-kind="param" data-field="metabolism" data-id="${sp.id}" type="number" step="0.1" value="${sp.metabolism}"></label><label>繁殖閾値<input data-kind="param" data-field="fertility" data-id="${sp.id}" type="number" step="0.05" value="${sp.fertility}"></label><label>水消費率<input data-kind="param" data-field="waterNeed" data-id="${sp.id}" type="number" step="0.05" value="${sp.waterNeed}"></label></div>`;
      wrap.appendChild(details);
      host.appendChild(wrap);
      const opt=document.createElement('option'); opt.value=sp.id; opt.textContent=sp.name; select.appendChild(opt);
    });
    state.overlaySpecies=select.value;
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
    const newSp={id,name,trophic,color,shape,baseSpeed,vision,metabolism,fertility,waterNeed,socialMode,preyList,poisonTolerance,thornHandling,dietPreference:diet};
    state.species.push(newSp);
    resetSpeciesEditor(); spawnAnimals(); logMsg(`種を追加: ${name}`);
  }

  function saveSpeciesLocal(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.species)); logMsg('ローカル保存完了'); } catch(err){ logMsg('保存失敗:'+err.message); } }
  function loadSpeciesLocal(skipSpawn=false){ try{ const txt=localStorage.getItem(STORAGE_KEY); if(txt){ state.species=JSON.parse(txt); resetSpeciesEditor(); if(!skipSpawn) spawnAnimals(); logMsg('保存データ読込'); } else { if(!skipSpawn) logMsg('保存された種はありません'); } } catch(err){ logMsg('読込失敗:'+err.message); } }
  function exportSpeciesJSON(){ try{ const blob=new Blob([JSON.stringify(state.species,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='species.json'; a.click(); } catch(err){ logMsg('Export失敗:'+err.message);} }
  function importSpeciesJSON(){ const txt=prompt('JSONを貼り付け'); if(!txt) return; try{ const parsed=JSON.parse(txt); if(Array.isArray(parsed)){ state.species=parsed; resetSpeciesEditor(); spawnAnimals(); logMsg('JSONから読み込み'); } else { logMsg('配列形式ではありません'); } } catch(err){ logMsg('Import失敗:'+err.message);} }
  function spawnAnimals(){
    state.animals=[]; const counts={}; document.querySelectorAll('#speciesEditor input[data-kind="count"]').forEach(inp=>counts[inp.dataset.id]=parseInt(inp.value||'0'));
    const rng=state.rng; state.species.forEach(sp=>{
      const n=counts[sp.id]??20; for(let i=0;i<n;i++){state.animals.push(createAnimal(sp, rng));}
    });
    state.idCounter=state.animals.length;
    state.animalGrid=createAnimalGrid();
    state.animals.forEach(a=>registerAnimalToGrid(a,state));
  }
  function applyPreset(key){
    const preset=presets[key]; if(!preset) return;
    state.seed=preset.seed; state.rng=createRng(state.seed); state.species=JSON.parse(JSON.stringify(preset.species));
    resetSpeciesEditor(); Object.entries(preset.counts).forEach(([id,val])=>{const input=document.querySelector(`#speciesEditor input[data-kind="count"][data-id="${id}"]`); if(input) input.value=val;});
    document.getElementById('seedInput').value=preset.seed; generateTerrain(document.getElementById('patternSelect').value); spawnAnimals();
  }
  // FSM states for animal behavior
  const AnimalStates={WANDER:'WANDER', DRINK:'DRINK', EAT:'EAT', MATE:'MATE'};

  class Animal{
    constructor(sp, rng, id, x, y){
      const w=params.gridW, h=params.gridH; this.id=`A${id}`; this.speciesId=sp.id;
      const randX=()=>rng()*w; const randY=()=>rng()*h;
      const initialX=Number.isFinite(x)?x:randX();
      const initialY=Number.isFinite(y)?y:randY();
      if(Math.abs(initialX)<1e-6 && Math.abs(initialY)<1e-6){ this.x=randX(); this.y=randY(); }
      else { this.x=wrap(initialX,w); this.y=wrap(initialY,h); }
      this.energy=0.8+rng()*0.15; this.hydration=0.8+rng()*0.15; this.age=0; this.sex=rng()<0.5?'F':'M';
      this.behavior='wander'; this.state=AnimalStates.WANDER; this.stateTimer=0; this.lastEvent='-';
      this.genes=defaultGenes(); this.trail=[]; this.alive=true; this.vx=0; this.vy=0; this.waterCooldown=0; this.target=null;
      this.lastSafeX=this.x; this.lastSafeY=this.y; this.headingX=1; this.headingY=0; this.wanderAngle=rng()*Math.PI*2; this.mateCooldown=0;
    }

    getSpecies(){ return state.species.find(s=>s.id===this.speciesId); }

    update(state){
      if(!this.alive) return;
      this.decideState(state);
      this.applyForces(state);
      this.move(state);
      this.consumeAndMetabolize(state);
      this.handleReproduction(state);
      this.trail.push({x:this.x,y:this.y}); if(this.trail.length>40) this.trail.shift();

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
    }

    decideState(state){
      const sp=this.getSpecies(); const genes=this.genes; const rng=state.rng;
      const speed=clampRange(sp.baseSpeed*lerp(0.7,1.3,genes.g_speed),0.2,2.5); const vision=clampRange(sp.vision*lerp(0.7,1.3,genes.g_vision),2,12);
      this.cached={speed,vision};

      const thirstPct=(1-this.hydration)*100; const hungerPct=(1-this.energy)*100;
      if(this.stateTimer>0) this.stateTimer--;
      if(this.state===AnimalStates.DRINK){
        this.behavior='water';
        if(thirstPct>5) return;
      }
      if(this.stateTimer>0) return;

      const mateReady=this.energy>0.7 && thirstPct<35 && this.mateCooldown<=0;
      const drinkNeed=thirstPct>60 && this.waterCooldown<=0;
      const foodNearby=this.hasFoodNearby(state,vision);

      let next=AnimalStates.WANDER;
      if(drinkNeed) next=AnimalStates.DRINK;
      else if(hungerPct>40 && foodNearby) next=AnimalStates.EAT;
      else if(mateReady) next=AnimalStates.MATE;

      if(next!==this.state){ this.state=next; this.stateTimer=30+Math.floor(rng()*20); this.target=null; }
    }

    hasFoodNearby(state, vision){
      const sp=this.getSpecies(); const w=params.gridW, h=params.gridH;
      if(sp.trophic==='carn'){
        const nearby=getNeighbors(this,state,vision);
        return nearby.some(o=>sp.preyList.includes(o.speciesId) && Math.hypot(torusDelta(o.x,this.x,w), torusDelta(o.y,this.y,h))<vision);
      }
      const cx=Math.floor(wrap(this.x,w)), cy=Math.floor(wrap(this.y,h));
      for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
        const nx=wrap(cx+dx,w), ny=wrap(cy+dy,h); const c=state.cells[ny*w+nx];
        const vegScore=(c.veg.grass+c.veg.poison+c.veg.shrub+c.veg.shrubThorn+c.veg.tree);
        if(vegScore>0.08) return true;
      }
      return false;
    }

    applyForces(state){
      const sp=this.getSpecies(); const {speed,vision}=this.cached; const w=params.gridW, h=params.gridH; const rng=state.rng;
      let steerX=0, steerY=0;
      this.wanderAngle+= (rng()-0.5)*0.35; steerX+=Math.cos(this.wanderAngle)*0.35; steerY+=Math.sin(this.wanderAngle)*0.35;

      const cx=Math.floor(wrap(this.x,w)), cy=Math.floor(wrap(this.y,h));
      const cellNow=state.cells[cy*w+cx];

      if(this.state===AnimalStates.DRINK){
        let best={score:-Infinity,x:cx,y:cy};
        for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){
          const nx=wrap(cx+dx,w), ny=wrap(cy+dy,h); const c=state.cells[ny*w+nx];
          const nearRiver=c.river||c.shore; const score=(nearRiver?1.5:0)+(c.moist*0.8)-Math.hypot(dx,dy)*0.05;
          if(score>best.score){best={score,x:nx,y:ny};}
        }
        steerX+=torusDelta(best.x+0.5,this.x,w); steerY+=torusDelta(best.y+0.5,this.y,h); this.behavior='water'; this.target=best;
      } else if(this.state===AnimalStates.EAT){
        if(sp.trophic==='carn'){
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

      if(this.state!==AnimalStates.DRINK && (cellNow.river||cellNow.shore)){ steerX-=0.25; steerY-=0.25; }

      const steerN=safeNorm(steerX,steerY); if(steerN){ steerX/=steerN; steerY/=steerN; this.headingX=steerX; this.headingY=steerY; }
      else { steerX=rng()-0.5; steerY=rng()-0.5; }

      this.moveMul=this.state===AnimalStates.WANDER?0.65:(this.state===AnimalStates.DRINK?0.5:(this.state===AnimalStates.MATE?0.7:0.6));
      const targetVx=steerX*speed*this.moveMul; const targetVy=steerY*speed*this.moveMul;
      const inertia=0.82; const accel=0.18;
      const prevVx=this.vx, prevVy=this.vy;
      this.vx=this.vx*inertia + targetVx*accel;
      this.vy=this.vy*inertia + targetVy*accel;

      const maxSpeed=Math.max(0.4, speed*1.6);
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
      moveAnimalInGrid(this,state);
      if(Math.hypot(this.x-prevX,this.y-prevY)>0.001) state.movedAgents++;
    }

    consumeAndMetabolize(state){
      const sp=this.getSpecies(); const genes=this.genes; const w=params.gridW; const rng=state.rng;
      const metabolism=clampRange(sp.metabolism*genes.g_metabolism,0.2,2); const thirstTol=clampRange(lerp(0.7,1.3,genes.g_thirstTol),0.2,2.0); const waterNeed=clampRange(sp.waterNeed,0.2,2.0);
      this.age+=1; this.energy-=0.002*metabolism; this.hydration-=0.002*waterNeed*thirstTol; if(this.waterCooldown>0) this.waterCooldown-=1; if(this.mateCooldown>0) this.mateCooldown-=1;
      const cell=state.cells[Math.floor(this.y)*w+Math.floor(this.x)];

      if(sp.trophic==='herb' || sp.trophic==='omn'){
        const intake=Math.min(cell.veg.grass,0.1*(sp.dietPreference.grass||0)); cell.veg.grass-=intake; this.energy=Math.min(1,this.energy+intake*1.2); state.vegConsumed+=intake;
        const poisonEat=Math.min(cell.veg.poison,0.06*(sp.dietPreference.poison||0)); cell.veg.poison-=poisonEat; const poisonEff=sp.poisonTolerance||0.5; this.energy=clamp01(this.energy+poisonEat*(0.2+poisonEff)); state.vegConsumed+=poisonEat;
        const shrub=Math.min(cell.veg.shrub,0.05*(sp.dietPreference.shrub||0)); cell.veg.shrub-=shrub; this.energy=Math.min(1,this.energy+shrub*1.05); state.vegConsumed+=shrub;
        const thornEat=Math.min(cell.veg.shrubThorn,0.045*(sp.dietPreference.shrub||0.6)); cell.veg.shrubThorn-=thornEat; const thornEff=(sp.thornHandling||0.5); this.energy=clamp01(this.energy+thornEat*(0.3+thornEff)); this.energy-=Math.max(0,0.1-thornEff)*thornEat*0.5; state.vegConsumed+=thornEat;
        const treeEat=Math.min(cell.veg.tree,0.03*(sp.dietPreference.tree||0)); cell.veg.tree-=treeEat; this.energy=Math.min(1,this.energy+treeEat); state.vegConsumed+=treeEat;
      }

      if(this.state===AnimalStates.DRINK && (cell.shore||cell.river||cell.moist>0.45)) {this.hydration=Math.min(1,this.hydration+0.08*cell.moist+0.05); this.waterCooldown=40+Math.floor(rng()*80);}

      if(sp.trophic==='carn'){
        const victim=getNeighbors(this,state,0.8).find(o=>sp.preyList.includes(o.speciesId) && Math.hypot(torusDelta(o.x,this.x,params.gridW), torusDelta(o.y,this.y,params.gridH))<0.6);
        if(victim){victim.alive=false; removeAnimalFromGrid(victim,state); state.kills++; const pack=getNeighbors(this,state,3).filter(o=>o.speciesId===this.speciesId); const shareBase=0.55/Math.max(1,pack.length);
          pack.forEach(o=>{o.energy=Math.min(1,o.energy+shareBase); o.hydration=Math.min(1,o.hydration+0.12);});
          this.energy=Math.min(1,this.energy+0.15); this.hydration=Math.min(1,this.hydration+0.05);
          this.behavior='hunt'; state.events.push({type:'hunt', predator:sp.id, prey:victim.speciesId});
        }
      }

      if(!Number.isFinite(this.x)||!Number.isFinite(this.y)||!Number.isFinite(this.energy)||!Number.isFinite(this.hydration)){
        this.x=this.lastSafeX; this.y=this.lastSafeY; this.vx=0; this.vy=0; state.nanAgents++; this.lastEvent='NaN rollback'; state.events.push({type:'nan', id:this.id, x:this.x,y:this.y});
      }

      if(this.energy<=0||this.hydration<=0){this.alive=false; state.deaths++; removeAnimalFromGrid(this,state); state.events.push({type:'death', id:this.id}); this.lastEvent='死亡'; return;}
    }

    handleReproduction(state){
      if(!this.alive || this.state!==AnimalStates.MATE) return;
      const sp=this.getSpecies(); const rng=state.rng; const fert=clampRange(sp.fertility*lerp(0.7,1.3,this.genes.g_fertility),0,1);
      const partner=getNeighbors(this,state,1).find(o=>o.speciesId===this.speciesId && o.sex!==this.sex && o.state===AnimalStates.MATE && Math.hypot(torusDelta(o.x,this.x,params.gridW), torusDelta(o.y,this.y,params.gridH))<0.9);
      if(!partner) return;
      if(rng()<0.12*fert){
        this.energy*=0.7; partner.energy*=0.7; this.mateCooldown=180; partner.mateCooldown=180; this.stateTimer=Math.max(this.stateTimer,40); partner.stateTimer=Math.max(partner.stateTimer,40);
        const child=createAnimal(sp,rng,this.x,this.y); const angle=rng()*Math.PI*2; const dist=1.2+rng()*1.5; child.x=wrap(this.x+Math.cos(angle)*dist,params.gridW); child.y=wrap(this.y+Math.sin(angle)*dist,params.gridH);
        child.lastSafeX=child.x; child.lastSafeY=child.y;
        child.genes=combineGenes(this.genes,partner.genes);
        state.spawnBuffer.push(child); state.births++; state.events.push({type:'birth', species:sp.id});
        this.lastEvent='繁殖'; partner.lastEvent='繁殖'; child.lastEvent='誕生'; this.behavior='seek-mate'; partner.behavior='seek-mate';
      }
    }
  }

  function createAnimal(sp, rng, x, y){
    return new Animal(sp, rng, state.idCounter++, x, y);
  }

  // --- ENGINE ---
  
  function stepSimulation(){
    let births=0; let deaths=0;
    const rng=state.rng; const w=params.gridW, h=params.gridH; state.events=[]; state.step++; state.seasonCounter++;
    state.movedAgents=0; state.nanAgents=0; state.vegGrowth=0; state.vegConsumed=0;
    state.animalGrid=createAnimalGrid(); state.animals.forEach(a=>{ if(a.alive) registerAnimalToGrid(a,state); });
    const seasonLen=state.season==='雨季'?uiParams.rainyLen:uiParams.dryLen; if(state.seasonCounter>seasonLen){state.season=state.season==='雨季'?'乾季':'雨季'; state.seasonCounter=0; logMsg(`季節が${state.season}に切替`);} 
    const moistGain=state.season==='雨季'?0.05:0.015; const moistLoss=state.season==='雨季'?0.008:0.03;
    let riverCount=0, moistSum=0, vegSum=0;
    const updateVeg=state.step%VEG_UPDATE_INTERVAL===0;
    state.density.fill(0);
    if(updateVeg){
      state.cells.forEach((c)=>{
        const beforeVeg=c.veg.grass+c.veg.shrub+c.veg.tree;
        c.moist=clamp01(c.moist + moistGain*(0.5+c.wet*0.6) - moistLoss + (c.river?0.06:0));
        const seasonFactor=state.season==='雨季'?1:0.65; const tempFactor=c.elev>0.75?0.7:1;
        const growBase=0.06*seasonFactor*tempFactor;
        c.veg.grass=clamp01(c.veg.grass + growBase*c.moist*(1-c.veg.grass) - 0.015*(1-c.moist));
        c.veg.poison=clamp01(c.veg.poison + 0.04*c.moist*(1-c.veg.poison) - 0.01*(0.5-c.moist));
        c.veg.shrub=clamp01(c.veg.shrub + 0.04*c.moist*(1-c.veg.shrub) - 0.01*(0.4-c.moist));
        c.veg.shrubThorn=clamp01(c.veg.shrubThorn + 0.035*c.moist*(1-c.veg.shrubThorn) - 0.012*(0.45-c.moist));
        c.veg.tree=clamp01(c.veg.tree + 0.02*c.moist*(1-c.veg.tree) - 0.008*(0.35-c.moist));
        const afterVeg=c.veg.grass+c.veg.poison+c.veg.shrub+c.veg.shrubThorn+c.veg.tree; state.vegGrowth+=Math.max(0, afterVeg-beforeVeg);
        if(c.river) riverCount++; moistSum+=c.moist; vegSum+=afterVeg;
      });
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
    const shannon=computeShannon(counts);
    const genetic=computeGeneticDiversity();
    updateStabilityMetric(totalPop);
    Object.entries(counts).forEach(([id,v])=>{ if((state.prevCounts[id]||0)>0 && v===0) state.extinction++; });
    state.prevCounts=counts;
    state.shannon=shannon; state.genetic=genetic;
    state.logs.push({step:state.step, season:state.season, river:riverCount, moist:moistSum/state.cells.length, veg:vegSum/state.cells.length, births,deaths,kills, counts, genesAvg:averageGenes(), vegMin:state.vegMin, vegMax:state.vegMax, vegGrowth:state.vegGrowth, vegConsumed:state.vegConsumed, moved:state.movedAgents, nan:state.nanAgents, shannon, genetic, stability:state.stability, extinction:state.extinction});
    if(state.logs.length>600) state.logs.shift();
  }

  function combineGenes(g1,g2){
    const mutate=parseFloat(document.getElementById('mutRate').value||'0.05'); const evo=document.getElementById('evoToggle').checked; const rng=state.rng; const res={};
    const clampGene=v=>{ if(!Number.isFinite(v)) return 1; return clamp01(v); };
    ['g_speed','g_vision','g_metabolism','g_fertility','g_thirstTol','g_starveTol'].forEach(k=>{ let v=(g1[k]+g2[k])/2; if(evo) v+= (rng()-0.5)*mutate; res[k]=clampGene(v*1.1);});
    return res;
  }
  function averageGenes(){
    const sums={}; const keys=['g_speed','g_vision','g_metabolism','g_fertility','g_thirstTol','g_starveTol']; keys.forEach(k=>sums[k]=0);
    const list=state.animals.filter(a=>a.alive); if(list.length===0) return sums; list.forEach(a=>keys.forEach(k=>sums[k]+=a.genes[k]||1)); keys.forEach(k=>sums[k]/=list.length); return sums;
  }
  function speciesCounts(){ const counts={}; state.species.forEach(sp=>counts[sp.id]=0); state.animals.forEach(a=>{if(a.alive) counts[a.speciesId]++;}); return counts; }
  function computeShannon(counts){ const total=Object.values(counts).reduce((s,v)=>s+v,0); if(total===0) return 0; let h=0; Object.values(counts).forEach(v=>{ if(v>0){ const p=v/total; h-=p*Math.log(p); } }); return h/Math.log(state.species.length||1); }
  function computeGeneticDiversity(){ const keys=['g_speed','g_vision','g_metabolism','g_fertility','g_thirstTol','g_starveTol']; let totalVar=0, speciesUsed=0; state.species.forEach(sp=>{ const list=state.animals.filter(a=>a.alive && a.speciesId===sp.id); if(list.length<2) return; const means={}; keys.forEach(k=>means[k]=0); list.forEach(a=>keys.forEach(k=>means[k]+=a.genes[k]||1)); keys.forEach(k=>means[k]/=list.length); let varSum=0; list.forEach(a=>keys.forEach(k=>{ const d=(a.genes[k]||1)-means[k]; varSum+=d*d; })); totalVar+=varSum/(list.length*keys.length); speciesUsed++; }); return speciesUsed?totalVar/speciesUsed:0; }
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
  let p5inst=null; let canvasW=0, canvasH=0; let selected=null; let overlayLayer=null; let bgLayer=null;
  function startP5(){
    p5inst=new p5(p=>{
      p.setup=()=>{const host=document.getElementById('canvasHost'); const w=host.clientWidth, h=host.clientHeight; canvasW=w; canvasH=h; p.createCanvas(w,h); overlayLayer=p.createGraphics(w,h); bgLayer=p.createGraphics(w,h); overlayLayer.noStroke(); bgLayer.noStroke(); state.needsBgRedraw=true;};
      p.windowResized=()=>{const host=document.getElementById('canvasHost'); canvasW=host.clientWidth; canvasH=host.clientHeight; p.resizeCanvas(canvasW,canvasH); if(overlayLayer){overlayLayer.resizeCanvas(canvasW,canvasH); overlayLayer.noStroke();} if(bgLayer){bgLayer.resizeCanvas(canvasW,canvasH); bgLayer.noStroke(); state.needsBgRedraw=true;}};
      p.draw=()=>{try{if(state.running){for(let i=0;i<parseInt(document.getElementById('speedSelect').value);i++) stepSimulation();} render(p);}catch(err){state.lastError=err; document.getElementById('renderAlert').style.display='block'; console.error(err);} }; 
      p.mouseMoved=()=>{handleHover(p);};
      p.mousePressed=()=>{handleSelect(p);};
    },'canvasHost');
  }

  function redrawBackground(){
    if(!bgLayer) return; const cellSize=params.cellSize; bgLayer.clear();
    for(let y=0;y<params.gridH;y++){
      for(let x=0;x<params.gridW;x++){
        const c=state.cells[y*params.gridW+x]; const elevColor=bgLayer.lerpColor(bgLayer.color('#1b2b1e'), bgLayer.color('#5fa470'), c.elev); const treeShade=bgLayer.lerpColor(elevColor, bgLayer.color('#28442f'), c.veg.tree*0.6);
        bgLayer.noStroke(); bgLayer.fill(treeShade); bgLayer.rect(x*cellSize,y*cellSize,cellSize,cellSize);
        const vegLevel=c.veg.grass+c.veg.shrub+c.veg.tree;
        if(vegLevel>0.18){
          const grassAlpha=clamp01(c.veg.grass*0.9);
          const dense=vegLevel>0.38;
          bgLayer.fill(110,200,120,grassAlpha*140);
          bgLayer.circle(x*cellSize+cellSize*0.3,y*cellSize+cellSize*0.25,1.5);
          if(dense){ bgLayer.circle(x*cellSize+cellSize*0.65,y*cellSize+cellSize*0.65,1.8); bgLayer.circle(x*cellSize+cellSize*0.4,y*cellSize+cellSize*0.7,1.2); }
        }
        if(c.river){bgLayer.fill(70,160,255,180); bgLayer.rect(x*cellSize,y*cellSize,cellSize,cellSize);} else if(c.shore){bgLayer.fill(90,140,200,60); bgLayer.rect(x*cellSize,y*cellSize,cellSize,cellSize);}
      }
    }
    state.needsBgRedraw=false;
  }
  function handleHover(p){
    const cellTooltip=document.getElementById('cellTooltip'); const x=Math.floor(p.mouseX/params.cellSize), y=Math.floor(p.mouseY/params.cellSize);
    if(x<0||y<0||x>=params.gridW||y>=params.gridH){cellTooltip.classList.add('hidden'); return;}
    const c=state.cells[y*params.gridW+x]; cellTooltip.textContent=`(${x},${y}) elev:${c.elev.toFixed(2)}\n地形:${c.terrain} river:${c.river?'yes':'no'}\nmoist:${c.moist.toFixed(2)}\n草:${c.veg.grass.toFixed(2)} 毒:${c.veg.poison.toFixed(2)}\n低木:${c.veg.shrub.toFixed(2)} トゲ:${c.veg.shrubThorn.toFixed(2)} 樹木:${c.veg.tree.toFixed(2)}`;
    cellTooltip.style.left=(p.mouseX+16)+'px'; cellTooltip.style.top=(p.mouseY+16)+'px'; cellTooltip.classList.remove('hidden');
  }
  function handleSelect(p){
    const mx=p.mouseX/params.cellSize, my=p.mouseY/params.cellSize; const found=state.animals.find(a=>a.alive && Math.hypot(a.x*params.cellSize-mx*params.cellSize,a.y*params.cellSize-my*params.cellSize)<8);
    if(found){selected=found; updateInspector();}
  }
  function overlayLabelText(mode){
    const map={base:'地形+植生', river:'河川(流路)', moisture:'水分', vegetation_total:'植生合計', vegetation_grass:'草(密度ヒート)', vegetation_poison:'毒草', vegetation_shrub:'低木', vegetation_shrubThorn:'トゲ低木', vegetation_tree:'樹木', animals_all:'動物(全)', animals_filter:'動物(種別)', density_heatmap:'密度ヒート'}; return map[mode]||mode;
  }
  function drawColorbar(p,mode){
    const x=12,y=12,w=18,h=140; p.push(); p.translate(12,60); const grad=p.drawingContext.createLinearGradient(0,0,0,h); const colors={moisture:['#1b2d6b','#6fa4ff'], vegetation_total:['#17351f','#68e38f'], vegetation_grass:['#16361c','#5acb72'], vegetation_poison:['#30202e','#e64f86'], vegetation_shrub:['#1d2f1c','#90d088'], vegetation_shrubThorn:['#231f13','#d6b15d'], vegetation_tree:['#18261a','#5fa173'], density_heatmap:['#1d1b4f','#ffcc66'], river:['#0c2238','#59c6ff'], animals_all:['#222','#fff']};
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
          case 'vegetation_total': col=overlayLayer.lerpColor(overlayLayer.color('#14301e'), overlayLayer.color('#68e38f'), clamp01((c.veg.grass+c.veg.shrub+c.veg.tree)/2)); break;
          case 'vegetation_grass': col=overlayLayer.lerpColor(overlayLayer.color('#16361c'), overlayLayer.color('#5acb72'), clamp01(c.veg.grass*1.2)); break;
          case 'vegetation_poison': col=overlayLayer.lerpColor(overlayLayer.color('#30202e'), overlayLayer.color('#e64f86'), clamp01(c.veg.poison*1.4)); break;
          case 'vegetation_shrub': col=overlayLayer.lerpColor(overlayLayer.color('#1d2f1c'), overlayLayer.color('#90d088'), clamp01(c.veg.shrub*1.2)); break;
          case 'vegetation_shrubThorn': col=overlayLayer.lerpColor(overlayLayer.color('#231f13'), overlayLayer.color('#d6b15d'), clamp01(c.veg.shrubThorn*1.3)); break;
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
  function render(p){
    const cellSize=params.cellSize; p.background('#050910');
    const dimTerrain=document.getElementById('dimTerrain').checked;
    const activeOverlay=state.overlay;
    if(state.needsBgRedraw) redrawBackground();
    if(bgLayer) p.image(bgLayer,0,0);
    if(dimTerrain && activeOverlay.startsWith('vegetation')){ p.fill(5,9,16,130); p.noStroke(); p.rect(0,0,canvasW,canvasH); }
    drawOverlay(p, state.overlay, parseFloat(document.getElementById('overlayAlpha').value||'0.6'));
    // animals
    for(const a of state.animals){ if(!a.alive) continue; drawAnimal(p,a); }
    // trails
    if(document.getElementById('trailToggle').checked && selected){ p.stroke(255,255,255,120); p.noFill(); p.beginShape(); selected.trail.forEach(pt=>p.vertex(pt.x*cellSize+cellSize/2, pt.y*cellSize+cellSize/2)); p.endShape(); }
    if(selected){ p.noFill(); p.stroke('#ffea8a'); p.rect(Math.floor(selected.x)*cellSize, Math.floor(selected.y)*cellSize, cellSize, cellSize); }
    // overlay label
    const overlay=state.overlay;
    const label=document.getElementById('layerLabel'); label.textContent=`レイヤー: ${overlayLabelText(overlay)}`; label.innerHTML=`レイヤー: ${overlayLabelText(overlay)}<small>表示中: ${overlayLabelText(overlay)}</small>`;
    drawColorbar(p, overlay);
    updateHud(); updateInspector(); updateChart();
  }
  function drawAnimal(p,a){
    const sp=state.species.find(s=>s.id===a.speciesId); const size=sp.trophic==='carn'?9:8; const screenX=a.x*params.cellSize+params.cellSize/2; const screenY=a.y*params.cellSize+params.cellSize/2;
    if(screenX<-16||screenX>canvasW+16||screenY<-16||screenY>canvasH+16) return;
    const baseColor=p.color(sp.color);
    let color=baseColor;
    if(a.state===AnimalStates.DRINK){ color=p.lerpColor(baseColor,p.color('#6fa4ff'),0.45); }
    else if(a.state===AnimalStates.EAT){ color=p.lerpColor(baseColor,p.color('#68e38f'),0.3); }
    else if(a.state===AnimalStates.MATE){ color=p.lerpColor(baseColor,p.color('#ffc1e3'),0.35); }
    const angle=Math.atan2(a.headingY||0,a.headingX||1);
    p.push(); p.translate(screenX,screenY); p.rotate(angle); const stroke=p.brightness(color)>50?'#000':'#fff'; p.strokeWeight(a.state===AnimalStates.DRINK?2:1.1); p.stroke(a.state===AnimalStates.DRINK?'#6fa4ff':stroke); p.fill(color);
    if(state.overlay==='animals_filter' && document.getElementById('speciesDim').checked && state.overlaySpecies && state.overlaySpecies!==a.speciesId){ p.tint(255,60); p.stroke(255,80);}
    if(sp.trophic==='carn'){
      p.triangle(-size/2,size/2, size/2,size/2, 0,-size/2);
      p.rect(-size*0.45,-size*0.15,size*0.9,size*0.3,2);
    } else {
      p.circle(0,0,size+ (a.state===AnimalStates.DRINK?1.5:0));
      p.noStroke(); p.fill(255,255,255,130); p.circle(size*0.25,0,2.5);
      p.stroke(a.state===AnimalStates.DRINK?'#6fa4ff':stroke); p.fill(color);
    }
    if(document.getElementById('haloToggle').checked){ if(a.behavior==='graze') {p.noFill(); p.stroke(50,200,120,160); p.circle(0,0,size+6);} else if(a.behavior==='chase'){p.noFill(); p.stroke(255,80,80,180); p.circle(0,0,size+6);} else if(a.behavior==='water'){p.noFill(); p.stroke(80,160,255,200); p.circle(0,0,size+7);} else if(a.behavior==='seek-mate'){p.noStroke(); p.fill(255,180,200,200); p.text('♡',-4,4);} }
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
  }
  function updateInspector(){
    const box=document.getElementById('selectedInfo'); if(!selected||!selected.alive){box.textContent='クリックで個体情報を表示'; return;}
    const sp=state.species.find(s=>s.id===selected.speciesId); const hunger=(1-selected.energy), thirst=(1-selected.hydration);
    box.textContent=`種: ${sp.name}\n性別: ${selected.sex}\n年齢: ${selected.age}\n状態: ${selected.state} / 行動:${selected.behavior}\n飢え:${hunger.toFixed(2)} 渇き:${thirst.toFixed(2)}\nE:${selected.energy.toFixed(2)} H:${selected.hydration.toFixed(2)}\n直近イベント:${selected.lastEvent}\ngenes:${Object.entries(selected.genes).map(([k,v])=>`${k}:${v.toFixed(2)}`).join(' ')}`;
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
  function init(){ resetSpeciesEditor(); if(localStorage.getItem(STORAGE_KEY)){ loadSpeciesLocal(true); } generateTerrain(document.getElementById('patternSelect').value); spawnAnimals(); startP5(); bindUI(); }
  function bindUI(){
    document.querySelectorAll('button[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
      const act=btn.dataset.action; if(act==='start') state.running=true; else if(act==='stop') state.running=false; else if(act==='reset'){ state=createState(document.getElementById('seedInput').value); generateTerrain(document.getElementById('patternSelect').value); spawnAnimals(); selected=null; }
      else if(act==='regen'){ state.seed=document.getElementById('seedInput').value; state.rng=createRng(state.seed); generateTerrain(document.getElementById('patternSelect').value); }
      else if(act==='download-csv') downloadCsv(); else if(act==='run-test') runTest(); else if(act==='self-test') runSelfTest(); else if(act==='headless-3000') runHeadless3000();
      else if(act==='add-species') addCustomSpeciesFromForm(); else if(act==='export-species') exportSpeciesJSON(); else if(act==='import-species') importSpeciesJSON(); else if(act==='save-species') saveSpeciesLocal(); else if(act==='load-species') loadSpeciesLocal();
    }));
    document.querySelectorAll('button[data-preset]').forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.preset)));
    document.querySelectorAll('input[name="overlay"]').forEach(r=>r.addEventListener('change',e=>{state.overlay=e.target.value;}));
    document.getElementById('overlaySpecies').addEventListener('change',e=>{state.overlaySpecies=e.target.value;});
    document.getElementById('boundaryMode').addEventListener('change',e=>{state.boundaryMode=e.target.value;});
    document.getElementById('riverThresh').addEventListener('change',()=>updateRivers(document.getElementById('patternSelect').value));
    document.getElementById('riverWidthCtrl').addEventListener('input',()=>updateRivers(document.getElementById('patternSelect').value));
    document.getElementById('speciesEditor').addEventListener('input',e=>{
      const kind=e.target.dataset.kind; const id=e.target.dataset.id; if(kind==='param'){ const sp=state.species.find(s=>s.id===id); sp[e.target.dataset.field]=parseFloat(e.target.value); }
    });
    document.getElementById('speciesEditor').addEventListener('change',e=>{const kind=e.target.dataset.kind; const id=e.target.dataset.id; if(kind==='mode'){ const sp=state.species.find(s=>s.id===id); sp.behaviorMode=e.target.value; }});
    document.getElementById('speciesEditor').addEventListener('click',e=>{const kind=e.target.dataset.kind; const id=e.target.dataset.id; if(kind==='respawn'){ spawnAnimals(); }});
  }
  window.addEventListener('load',init);
