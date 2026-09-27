/* Capa de datos compartida por la página (index.html) y el service worker (sw.js). */
/* ============================================================
   CAPA DE DATOS
   Sustituir DataSource.getDepartures por llamadas reales
   (API propia, scraping autorizado, GTFS + ocupación, etc.).
   Debe devolver una Promise con un array de salidas:
   { id, operator:'renfe'|'monbus', service, dep:'HH:MM', arr:'HH:MM',
     durMin, price, capacity, occupied }
   ============================================================ */
// Paradas del corredor Salamanca–Madrid, en orden geográfico.
// Paradas oficiales (ver "Fuentes" al pie). Orden para los desplegables: de Salamanca a Madrid.
const CITIES = ["Salamanca","Aldealengua","Santa Marta de Tormes","San Morales","Calvarrasa de Abajo","Babilafuente","Encinas de Abajo","Villar de Gallimazo","Peñaranda de Bracamonte","Cantaracillos","Narros del Castillo","Crespos","Madrigal de las Altas Torres","San Pedro del Arroyo","Cardeñosa de Ávila","Medina del Campo","Arévalo","Ávila","Segovia","Villalba de Guadarrama","Madrid","Aeropuerto Madrid-Barajas"];

// Líneas en sentido Salamanca → Madrid. Cada parada: [ciudad, estación, minutos desde el origen].
// Las paradas son las publicadas por Renfe y Monbus; los minutos, horarios y ocupación son de ejemplo.
// El sentido Madrid → Salamanca se genera invirtiendo la línea.
const LINES = [
  { id:"alvia-med", rail:"alvia", operator:"renfe", service:"Alvia", cap:[266,266], price:[18.5,32.4],
    stops:[["Salamanca","Salamanca",0],["Medina del Campo","Medina del Campo AV",41],["Segovia","Segovia-Guiomar",69],["Madrid","Madrid-Chamartín Clara Campoamor",98]],
    deps:{out:["06:40","10:48"], back:["15:50","19:10"]}},
  { id:"alvia", rail:"alvia", operator:"renfe", service:"Alvia", cap:[266,266], price:[18.5,32.4],
    stops:[["Salamanca","Salamanca",0],["Segovia","Segovia-Guiomar",66],["Madrid","Madrid-Chamartín Clara Campoamor",95]],
    deps:{out:["14:35","18:10"], back:["07:55","11:05"]}},
  { id:"md", rail:"md", operator:"renfe", service:"Media Distancia (L13)", cap:[180,237], price:[14.2,19.8],
    stops:[["Salamanca","Salamanca",0],["Aldealengua","Aldealengua",9],["San Morales","San Morales",14],["Babilafuente","Babilafuente",19],["Villar de Gallimazo","Villar de Gallimazo",25],["Peñaranda de Bracamonte","Peñaranda de Bracamonte",33],["Narros del Castillo","Narros del Castillo",42],["Crespos","Crespos",49],["San Pedro del Arroyo","San Pedro del Arroyo",56],["Cardeñosa de Ávila","Cardeñosa de Ávila",65],["Ávila","Ávila",75],["Villalba de Guadarrama","Villalba de Guadarrama",130],["Madrid","Madrid-Chamartín Clara Campoamor",160]],
    deps:{out:["06:05","08:10","12:05","14:40","17:15","19:30"], back:["07:30","10:10","13:45","16:25","18:40","20:50"]}},
  { id:"bus-dir", rail:"busdir", operator:"monbus", service:"Directo", cap:[55,55], price:[13.5,17.9],
    stops:[["Salamanca","Estación de autobuses de Salamanca",0],["Madrid","Madrid Estación Sur (vía Moncloa)",155]],
    deps:{out:["06:15","07:15","08:15","10:00","12:15","13:00","14:00","16:00","17:00","18:00","19:00","20:00","22:15"], back:["07:45","08:30","09:30","11:00","11:45","16:00","17:00","20:00","21:00","22:15"]}},
  { id:"bus-aero", rail:"busdir", operator:"monbus", service:"Directo Aeropuerto", cap:[55,55], price:[15.9,19.9],
    stops:[["Salamanca","Estación de autobuses de Salamanca",0],["Madrid","Madrid Moncloa",145],["Aeropuerto Madrid-Barajas","Aeropuerto Adolfo Suárez Madrid-Barajas T4",185]],
    deps:{out:["05:00"], back:["13:30"]}},
  { id:"bus-ord", rail:"busord", operator:"monbus", service:"Ruta con paradas", cap:[55,55], price:[11.8,14.5],
    stops:[["Salamanca","Estación de autobuses de Salamanca",0],["Santa Marta de Tormes","Santa Marta de Tormes",10],["Calvarrasa de Abajo","Calvarrasa de Abajo",20],["Encinas de Abajo","Encinas de Abajo",28],["Peñaranda de Bracamonte","Peñaranda de Bracamonte",45],["Cantaracillos","Cantaracillos",55],["Madrigal de las Altas Torres","Madrigal de las Altas Torres",75],["Arévalo","Arévalo",95],["Madrid","Madrid Estación Sur (vía Moncloa)",190]],
    deps:{out:["09:00","15:00"], back:["10:00","17:30"]}},
];

// Esquema del mapa: una vía por servicio, con sus paradas en orden.
const RAILS = [
  {id:"alvia", op:"renfe", label:"Renfe · Alvia", stops:["Salamanca","Medina del Campo","Segovia","Madrid"], note:"Medina del Campo solo en algunos trenes"},
  {id:"md", op:"renfe", label:"Renfe · Media Distancia L13", stops:LINES.find(l=>l.id==="md").stops.map(s=>s[0])},
  {id:"busdir", op:"monbus", label:"Monbus · Directo", stops:["Salamanca","Madrid","Aeropuerto Madrid-Barajas"], note:"Aeropuerto solo en el primer bus"},
  {id:"busord", op:"monbus", label:"Monbus · Ruta con paradas", stops:LINES.find(l=>l.id==="bus-ord").stops.map(s=>s[0])},
];

function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const toMin=t=>{const[h,m]=t.split(":").map(Number);return h*60+m};
const toHM=m=>{m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")};
const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");

// Devuelve la línea en el sentido pedido si pasa por a y luego por b.
function lineFor(line,a,b){
  const ia=line.stops.findIndex(s=>s[0]===a), ib=line.stops.findIndex(s=>s[0]===b);
  if(ia<0||ib<0||ia===ib) return null;
  const back=ia>ib;
  let stops=line.stops;
  if(back){const tot=stops[stops.length-1][2];stops=stops.slice().reverse().map(s=>[s[0],s[1],tot-s[2]]);}
  const i=stops.findIndex(s=>s[0]===a), j=stops.findIndex(s=>s[0]===b);
  return {stops,i,j,deps:back?line.deps.back:line.deps.out,dir:back?"back":"out"};
}

const LIVE_MS=30000;          // cada cuánto cambia la simulación de cancelaciones
const FORCED=new Map();        // liberaciones forzadas con el botón de demostración: id -> hasta cuándo
const DataSource = {
  // Solo para la demo: libera una plaza de esa salida durante 2 minutos.
  simulateRelease(id){ FORCED.set(id,Date.now()+120000); },
  cities(){ return CITIES.slice(); },
  hasRoute(a,b){ return a!==b && LINES.some(l=>lineFor(l,a,b)); },
  stations(city){ const m=new Map(); LINES.forEach(l=>l.stops.forEach(s=>{ if(s[0]===city){ const k=s[1]; if(!m.has(k)) m.set(k,new Set()); m.get(k).add(l.operator);} })); return [...m].map(([name,ops])=>({name,ops:[...ops]})); },
  stopsServed(){ const o={}; CITIES.forEach(c=>o[c]={renfe:false,monbus:false}); LINES.forEach(l=>l.stops.forEach(s=>o[s[0]][l.operator]=true)); return o; },
  async getDepartures(from,to,dateStr){
    const date=new Date(dateStr+"T12:00:00");
    const dow=date.getDay(); // 0 domingo
    const today=new Date(); today.setHours(12,0,0,0);
    const daysAhead=Math.round((date-today)/86400000);
    const dayFactor={0:1.2,1:0.95,2:0.8,3:0.85,4:0.97,5:1.25,6:0.85}[dow];
    const leadFactor=Math.max(0.55,1.12-daysAhead*0.04); // cuanto más cerca, más ocupado
    const out=[];
    for(const line of LINES){
      const L=lineFor(line,from,to); if(!L) continue;
      const totalMin=L.stops[L.stops.length-1][2];
      L.deps.forEach((dep0,k)=>{
        const rnd=rng(hashStr([line.id,L.dir,dateStr,k].join("|")));
        if(line.operator==="monbus"&&dow===0&&toMin(dep0)<8*60) return; // domingo sin primer bus
        const start=toMin(dep0);
        const cap=line.cap[0]+Math.round(rnd()*((line.cap[1]-line.cap[0])/10))*10;
        const h=start/60;
        const peak=(h>=6.5&&h<9.5)?1.2:(h>=14&&h<16)?1.05:(h>=17.5&&h<21)?1.2:0.85;
        let base=0.58*dayFactor*peak*leadFactor+(rnd()-0.5)*0.35;
        if(dow===5&&L.dir==="back"&&h>=14) base+=0.18;   // viernes, Madrid → Salamanca
        if(dow===0&&L.dir==="out"&&h>=16) base+=0.2;     // domingo, vuelta a Madrid
        if(daysAhead<0) base=1;
        // Ocupación por tramo: sube al acercarse a Madrid y varía en cada parada.
        const seg=L.stops.slice(0,-1).map((s,n)=>{
          const nearMadrid=L.dir==="out"?n/(L.stops.length-1):1-(n+1)/(L.stops.length-1);
          return Math.max(0.03,Math.min(1,base*(0.8+nearMadrid*0.35)+(rnd()-0.5)*0.15));
        });
        const segOcc=seg.map(r=>Math.min(cap,Math.round(cap*r)));
        let occupied=Math.max(...segOcc.slice(L.i,L.j));
        const tid=line.id+"-"+dateStr+"-"+L.dir+k;
        // Simulación en vivo: en un vehículo lleno a veces alguien cancela y se libera una plaza durante un rato.
        if(occupied>=cap&&daysAhead>=0){
          const bucket=Math.floor(Date.now()/LIVE_MS);
          if(rng(hashStr(tid+"|"+from+"|"+to+"|"+bucket))()<0.07) occupied=cap-1;
          if(FORCED.has(tid)&&Date.now()<FORCED.get(tid)) occupied=cap-1;
        }
        const dep=start+L.stops[L.i][2], dur=L.stops[L.j][2]-L.stops[L.i][2];
        const share=dur/totalMin;
        const ratio=occupied/cap;
        const price=Math.round((line.price[0]+rnd()*(line.price[1]-line.price[0])*(0.5+ratio*0.7))*Math.max(0.3,share)*100)/100;
        out.push({id:tid, operator:line.operator, service:line.service,
          dep:toHM(dep), arr:toHM(dep+dur), durMin:dur, price, capacity:cap, occupied,
          fromStation:L.stops[L.i][1], toStation:L.stops[L.j][1],
          stops:L.stops.map((s,n)=>({city:s[0],station:s[1],time:toHM(start+s[2]),inTrip:n>=L.i&&n<=L.j}))});
      });
    }
    return out;
  }
};
