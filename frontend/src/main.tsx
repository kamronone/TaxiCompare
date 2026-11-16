import React from "react";
import { createRoot } from "react-dom/client";
import { MapContainer, Marker, TileLayer, Polyline, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

type Point = {lat:number;lon:number;label:string};
type Quote = {id:string;name:string;price:number|null;eta:number|null;type:string;url:string;routePrefilled:boolean};
type Route = {distance_km:number|null;duration_min:number|null;geometry:[number,number][];quotes:Quote[];offline?:boolean};
const places:Point[] = [
 {lat:41.3111,lon:69.2797,label:"Сквер Амира Темура"},
 {lat:41.2826,lon:69.2703,label:"Аэропорт Ташкента"},
 {lat:41.3261,lon:69.2280,label:"Чорсу"},
 {lat:41.3388,lon:69.2852,label:"Юнусабад"}
];
const base="";
async function request<T>(path:string,init?:RequestInit):Promise<T>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 let response:Response;
 try{response=await fetch(base+path,{...init,signal:controller.signal});}
 catch{throw new Error("Не удалось связаться с сервером. Проверьте интернет.");}
 finally{clearTimeout(timer);}
 if(!response.ok){const detail=await response.json().catch(()=>({detail:"Ошибка сервера"}));throw new Error(detail.detail||"Ошибка сети");}
 return response.json();
}
function fallbackRoute(a:Point,b:Point):Route{
 const makeLink=()=>{const url=new URL("https://3.redirect.appmetrica.yandex.com/route");url.searchParams.set("start-lat",String(a.lat));url.searchParams.set("start-lon",String(a.lon));url.searchParams.set("end-lat",String(b.lat));url.searchParams.set("end-lon",String(b.lon));url.searchParams.set("tariffClass","econom");url.searchParams.set("lang","ru");return url.toString();};
 return {distance_km:null,duration_min:null,geometry:[],offline:true,quotes:[
 {id:"yandex",name:"Yandex Go",price:null,eta:null,type:"unavailable",url:makeLink(),routePrefilled:true},
 {id:"uklon",name:"Uklon",price:null,eta:null,type:"unavailable",url:"https://uz.uklon.eu/",routePrefilled:false},
 {id:"mytaxi",name:"MyTaxi",price:null,eta:null,type:"unavailable",url:"https://mytaxi.uz/",routePrefilled:false}]};
}
function ClickMap({pick}:{pick:(lat:number,lon:number)=>void}){useMapEvents({click:e=>pick(e.latlng.lat,e.latlng.lng)});return null;}
function View({a,b}:{a:Point|null;b:Point|null}){const map=useMap();React.useEffect(()=>{
 if(a&&b)map.fitBounds([[a.lat,a.lon],[b.lat,b.lon]],{padding:[50,50],maxZoom:13});
 else if(a)map.flyTo([a.lat,a.lon],13);
},[map,a,b]);return null;}
function Pin({p,color}:{p:Point;color:string}){return <Marker position={[p.lat,p.lon]} icon={L.divIcon({className:"custom-pin",html:'<div style="background:'+color+'"></div>',iconSize:[20,20]})}/>;}
function App(){
 const [a,setA]=React.useState<Point|null>(places[0]);
 const [b,setB]=React.useState<Point|null>(places[1]);
 const [target,setTarget]=React.useState<"a"|"b">("b");
 const [route,setRoute]=React.useState<Route|null>(null);
 const [search,setSearch]=React.useState("");
 const [results,setResults]=React.useState<Point[]>([]);
 const [editing,setEditing]=React.useState(false);
 const [busy,setBusy]=React.useState(false);
 const [error,setError]=React.useState("");
 const [lang,setLang]=React.useState<"ru"|"uz">("ru");
 const labels=lang==="ru"?{
 title:"Один маршрут. Лучший выбор.",subtitle:"Сравните варианты такси для поездки по Ташкенту.",from:"Откуда",to:"Куда",locate:"Моё местоположение",compare:"Сравнить такси",refresh:"Обновить",search:"Найти адрес",map:"Нажмите на карту для выбора точки",noPrice:"Цена пока недоступна",open:"Открыть сервис",openRoute:"Проверить цену и заказать",notice:"Актуальные цены операторов пока не подключены. Проверяйте цену в приложении перед заказом.",manual:"Маршрут потребуется ввести самостоятельно."
 }:{
 title:"Bitta yo‘nalish. Eng yaxshi tanlov.",subtitle:"Toshkent bo‘ylab taksi xizmatlarini bir joyda ko‘ring.",from:"Qayerdan",to:"Qayerga",locate:"Mening joylashuvim",compare:"Taksilarni solishtirish",refresh:"Yangilash",search:"Manzilni izlash",map:"Nuqtani belgilash uchun xaritaga bosing",noPrice:"Narx hozircha mavjud emas",open:"Xizmatni ochish",openRoute:"Narxni tekshirish va buyurtma berish",notice:"Hozircha operatorlarning haqiqiy narxlari ulanmagan. Buyurtmadan oldin narxni tekshiring.",manual:"Yo‘nalishni xizmatda qaytadan kiritish kerak."
 };
 function select(p:Point){target==="a"?setA(p):setB(p);setRoute(null);setEditing(false);setResults([]);}
 async function find(){if(search.trim().length<3)return;setBusy(true);setError("");try{const data=await request<{results:Point[]}>(`/api/places?q=${encodeURIComponent(search.trim())}`);setResults(data.results);if(!data.results.length)setError("Адрес не найден");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function compare(){if(!a||!b)return;if(Math.hypot(a.lat-b.lat,a.lon-b.lon)<0.00015){setRoute(null);setError(lang==="ru"?"Точки А и Б совпадают. Выберите разные адреса.":"A va B nuqtalari bir xil. Boshqa manzilni tanlang.");return;}setBusy(true);setError("");try{setRoute(await request<Route>("/api/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from:a,to:b})}));}catch{setRoute(fallbackRoute(a,b));setError(lang==="ru"?"Сервис маршрутов временно недоступен. Можно открыть такси, но расстояние и время не рассчитаны.":"Yo‘nalish xizmati vaqtincha ishlamayapti. Taksi ilovasini ochishingiz mumkin, ammo masofa va vaqt hisoblanmadi.");}finally{setBusy(false);}}
 function locate(){navigator.geolocation?.getCurrentPosition(p=>{setA({lat:p.coords.latitude,lon:p.coords.longitude,label:lang==="ru"?"Моё местоположение":"Mening joylashuvim"});setRoute(null);},()=>setError("Нет доступа к геолокации"),{enableHighAccuracy:true,timeout:10000});}
 return <div className="app">
 <header><div className="logo"><span>🚕</span> TaxiCompare <b>UZ</b></div><div className="header-right"><span>📍 Tashkent</span><button onClick={()=>setLang(lang==="ru"?"uz":"ru")}>{lang==="ru"?"UZ":"RU"}</button></div></header>
 <main><section className="sidebar"><p className="eyebrow">TAXICOMPARE UZ · MVP</p><h1>{labels.title}</h1><p className="subtitle">{labels.subtitle}</p>
 <div className="route-form">
 <button className={target==="a"?"selected":""} onClick={()=>{setTarget("a");setEditing(true);setResults([]);}}><span className="point a"/> <span><small>{labels.from}</small><strong>{a?.label||"Выберите точку"}</strong></span></button>
 <button className={target==="b"?"selected":""} onClick={()=>{setTarget("b");setEditing(true);setResults([]);}}><span className="point b"/> <span><small>{labels.to}</small><strong>{b?.label||"Выберите точку"}</strong></span></button>
 <button className="swap" onClick={()=>{setA(b);setB(a);setRoute(null);}}>⇅</button>
 </div>
 {editing&&<div className="search"><div className="search-input"><input value={search} placeholder={labels.search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&find()}/><button onClick={find}>⌕</button><button onClick={()=>setEditing(false)}>✕</button></div><div className="suggestions">{results.concat(places).map((p,i)=><button key={i} onClick={()=>select(p)}>📍 {p.label}</button>)}</div></div>}
 <div className="tools"><button onClick={locate}>⌖ {labels.locate}</button><button onClick={()=>setTarget(target==="a"?"b":"a")}>📍 {target==="a"?"A":"B"}</button></div>
 <button className="main-button" disabled={!a||!b||busy} onClick={compare}>{busy?"Загрузка…":route?labels.refresh:labels.compare} →</button>
 {error&&<p className="error" role="alert">{error}</p>}
 {route&&<div className="comparison"><div className="summary"><small>МАРШРУТ</small><h2>{route.offline || route.distance_km==null || route.duration_min==null ? (lang==="ru"?"Расстояние пока недоступно":"Masofa hozircha mavjud emas") : `${route.distance_km.toFixed(1)} км · ~${Math.round(route.duration_min)} мин`}</h2></div>
 {route.quotes.map(q=><article key={q.id}><div className="operator"><span className="operator-icon">{q.name[0]}</span><div><strong>{q.name}</strong><small>{q.price==null?labels.noPrice:new Intl.NumberFormat("ru-RU").format(q.price)+" сум"}</small></div></div><a href={q.url} target="_blank" rel="noopener noreferrer">{q.routePrefilled?labels.openRoute:labels.open} ↗</a>{!q.routePrefilled&&<small>{labels.manual}</small>}</article>)}
 <div className="notice">ⓘ {labels.notice}</div></div>}
 <p className="privacy">🔒 Без регистрации · Никаких автоматических заказов</p>
 </section>
 <section className="map-area"><MapContainer center={[41.3111,69.2797]} zoom={12} zoomControl={true} style={{height:"100%",width:"100%"}}>
 <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
 {a&&<Pin p={a} color="#16a777"/>}{b&&<Pin p={b} color="#ff786d"/>}
 {route&&<Polyline positions={route.geometry} pathOptions={{color:"#197aee",weight:5}}/>}
 <ClickMap pick={(lat,lon)=>select({lat,lon,label:`📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`})}/><View a={a} b={b}/>
 </MapContainer><div className="map-hint">{labels.map} {target.toUpperCase()}</div></section></main>
 <footer>TaxiCompare UZ · MVP 0.1 · © OpenStreetMap contributors</footer></div>;
}
createRoot(document.getElementById("root")!).render(<App/>);
