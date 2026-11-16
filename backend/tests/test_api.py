from fastapi.testclient import TestClient
from backend.main import app, Point, yandex_link

client=TestClient(app)
def test_health():
    r=client.get("/api/health")
    assert r.status_code==200
    assert r.json()["status"]=="ok"

def test_route_rejects_outside_tashkent():
    r=client.post("/api/compare",json={"from":{"lat":40,"lon":69.2,"label":"A"},"to":{"lat":41.3,"lon":69.3,"label":"B"}})
    assert r.status_code==422

def test_yandex_route_link_contains_coordinates():
    a=Point(lat=41.31,lon=69.28,label="A")
    b=Point(lat=41.28,lon=69.27,label="B")
    url=yandex_link(a,b)
    assert "start-lat=41.31" in url
    assert "end-lon=69.27" in url
