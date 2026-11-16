# TaxiCompare UZ 🚕
MVP сервиса сравнения такси в Ташкенте. **Цены такси пока не подключены.** Никаких выдуманных тарифов и ETA.

## Возможности
- Мобильный интерфейс React + TypeScript, карта Leaflet / OpenStreetMap
- Точки отправления и прибытия: выбор на карте, примеры, поиск адреса, GPS
- Маршрут: расстояние, продолжительность, линия на карте (демо OSRM)
- Список сервисов Yandex Go, Uklon, MyTaxi без неподтверждённых цен
- Переход в Yandex Go с координатами маршрута; ссылки на другие сервисы, требующие ручного ввода
- Переключатель русского и узбекского интерфейса

## Запуск API
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
pytest backend/tests
```

## Запуск frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
Открой http://localhost:5173 . Backend API находится на http://localhost:8000 .

## Развёртывание
Frontend: Vercel с **Root Directory** `frontend`, framework Vite, command `npm run build`, output `dist`. Установи `VITE_API_BASE` в URL отдельно развёрнутого HTTPS FastAPI. Backend: Python ASGI-хостинг, startup `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, `CORS_ORIGINS` укажи свой frontend origin.

## Ограничения MVP
- Nominatim и публичный OSRM здесь использованы **только для прототипа**, не для массового коммерческого трафика. Нужны собственные или коммерческие маршрутизация и геокодирование.
- API агрегаторов (и реальные цены/подача) требуют разрешённых интеграций и коммерческих договорённостей.
- Для заказов переход осуществляется на сайты или в приложения операторов; редиректы и предзаполнение необходимо тестировать на реальных устройствах.
- Полный end-to-end deploy/frontend build в этой версии не подтверждён.
