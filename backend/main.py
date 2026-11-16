from __future__ import annotations
import asyncio, os, time
from urllib.parse import urlencode
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="TaxiCompare UZ API", version="0.1.0")
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_origin_regex=r"https://[a-zA-Z0-9-]+\\.vercel\\.app", allow_methods=["GET","POST"], allow_headers=["Content-Type"])

class Point(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    label: str = Field(max_length=250)

class RouteRequest(BaseModel):
    from_: Point = Field(alias="from")
    to: Point
    model_config = {"populate_by_name":True}

_lock = asyncio.Lock()
_last = 0.0
_cache = {}

@app.get("/api/health")
def health():
    return {"status":"ok","version":"0.1.0"}

@app.get("/api/places")
async def places(q: str):
    global _last
    q=q.strip()
    if not 3<=len(q)<=100:
        raise HTTPException(422,"Введите от 3 до 100 символов")
    key=q.casefold()
    if key in _cache and time.monotonic()-_cache[key][0]<86400:
        return {"results":_cache[key][1]}
    async with _lock:
        if key in _cache and time.monotonic()-_cache[key][0]<86400:
            return {"results":_cache[key][1]}
        await asyncio.sleep(max(0,1.1-(time.monotonic()-_last)))
        _last=time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=12,headers={"User-Agent":"TaxiCompareUZ-Prototype/0.1 (https://github.com/kamronone/TaxiCompare)"}) as client:
                r=await client.get("https://nominatim.openstreetmap.org/search",params={"q":q+", Ташкент, Узбекистан","format":"json","limit":6,"viewbox":"69.05,41.45,69.55,41.15","bounded":1})
                r.raise_for_status()
                points=[{"lat":float(x["lat"]),"lon":float(x["lon"]),"label":x["display_name"].split(",")[0]} for x in r.json()]
                _cache[key]=(time.monotonic(),points)
                return {"results":points}
        except httpx.HTTPError:
            raise HTTPException(503,"Поиск адресов временно недоступен. Выберите точку на карте.")

def yandex_link(a: Point,b: Point):
    params={"start-lat":str(a.lat),"start-lon":str(a.lon),"end-lat":str(b.lat),"end-lon":str(b.lon),"tariffClass":"econom","lang":"ru"}
    return "https://3.redirect.appmetrica.yandex.com/route?"+urlencode(params)

@app.post("/api/compare")
async def compare(payload: RouteRequest):
    a,b=payload.from_,payload.to
    if not all(40.9<=p.lat<=41.6 and 68.8<=p.lon<=69.8 for p in (a,b)):
        raise HTTPException(422,"Пока доступны только маршруты в Ташкенте и окрестностях")
    providers=[
        {"id":"yandex","name":"Yandex Go","price":None,"eta":None,"type":"unavailable","url":yandex_link(a,b),"routePrefilled":True},
        {"id":"uklon","name":"Uklon","price":None,"eta":None,"type":"unavailable","url":"https://uz.uklon.eu/","routePrefilled":False},
        {"id":"mytaxi","name":"MyTaxi","price":None,"eta":None,"type":"unavailable","url":"https://mytaxi.uz/","routePrefilled":False},
    ]
    url=f"https://router.project-osrm.org/route/v1/driving/{a.lon},{a.lat};{b.lon},{b.lat}"
    try:
        async with httpx.AsyncClient(timeout=13) as client:
            r=await client.get(url,params={"overview":"full","geometries":"geojson"})
            r.raise_for_status()
            result=r.json()
        if result.get("code")!="Ok" or not result.get("routes"):
            raise HTTPException(422,"Маршрут не найден")
        route=result["routes"][0]
        return {"distance_km":round(route["distance"]/1000,2),"duration_min":round(route["duration"]/60,1),"geometry":[[p[1],p[0]] for p in route["geometry"]["coordinates"]],"quotes":providers,"demo":True}
    except httpx.HTTPError:
        raise HTTPException(503,"Сервис маршрутизации временно недоступен.")
