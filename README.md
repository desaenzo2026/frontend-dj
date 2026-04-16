# 🎧 DJ App

Full-stack app para DJ con agenda de eventos, listas colaborativas y pedidos en vivo con ranking en tiempo real.

---

## Arquitectura

```
dj/
├── database/
│   └── schema.sql            # Esquema PostgreSQL
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── app.js            # Entry point (Express + Socket.IO)
│       ├── config/database.js
│       ├── routes/
│       │   ├── events.js        # CRUD eventos
│       │   ├── songLists.js     # Listas colaborativas
│       │   └── songRequests.js  # Pedidos en vivo + votos
│       └── socket/handlers.js   # Rooms de Socket.IO
└── frontend/
    ├── .env.example
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── api/index.js         # Capa HTTP centralizada
        ├── context/SocketContext.jsx
        ├── components/
        │   ├── Navbar.jsx
        │   └── Agenda/EventForm.jsx
        └── pages/
            ├── AgendaPage.jsx       # Gestión de eventos
            ├── PartyPage.jsx        # Lista colaborativa (DJ)
            ├── LiveRequestsPage.jsx # Pedidos + ranking
            └── SharedListPage.jsx   # Vista pública via link
```

---

## Modelos de datos

| Tabla | Campos clave |
|---|---|
| `events` | id, title, venue, event_date, start_time, end_time, status |
| `song_lists` | id, event_id, name, **share_token** (único) |
| `list_songs` | id, list_id, title, artist, added_by, position, played |
| `song_requests` | id, event_id, title, artist, requested_by, **votes**, status |
| `request_votes` | id, request_id, voter_token — `UNIQUE(request_id, voter_token)` |

---

## API Endpoints

### Eventos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/events` | Listar todos |
| GET | `/api/events/:id` | Obtener uno |
| POST | `/api/events` | Crear |
| PUT | `/api/events/:id` | Actualizar |
| DELETE | `/api/events/:id` | Eliminar |

### Listas colaborativas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/lists?event_id=` | Listas del evento |
| GET | `/api/lists/share/:token` | Vista pública (sin auth) |
| POST | `/api/lists` | Crear lista |
| POST | `/api/lists/:id/songs` | Añadir canción |
| PUT | `/api/lists/:id/songs/:songId` | Editar / marcar tocada |
| DELETE | `/api/lists/:id/songs/:songId` | Eliminar canción |

### Pedidos en vivo
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/requests?event_id=` | Ranking (order by votes DESC) |
| POST | `/api/requests` | Nuevo pedido |
| POST | `/api/requests/:id/vote` | Votar (deduplicado por token) |
| PUT | `/api/requests/:id/status` | DJ: played / rejected / pending |

### Socket.IO events
| Evento emitido por cliente | Descripción |
|---|---|
| `join:event <eventId>` | Suscribirse a pedidos en vivo |
| `join:list <listId>` | Suscribirse a lista colaborativa |
| `leave:event` / `leave:list` | Desuscribirse |

| Evento emitido por servidor | Descripción |
|---|---|
| `requests:new` | Nuevo pedido |
| `requests:vote_updated` | Voto registrado |
| `requests:status_updated` | Estado cambiado por DJ |
| `list:song_added` | Canción añadida a lista |
| `list:song_updated` | Canción editada / marcada |
| `list:song_removed` | Canción eliminada |

---

## Setup

### 1. Base de datos

```bash
createdb djapp
psql -U postgres -d djapp -f database/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # edita las variables
npm install
npm run dev                 # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env        # edita si el backend no corre en :4000
npm install
npm run dev                 # http://localhost:5173
```

---

## Seguridad implementada

- `helmet` — cabeceras HTTP seguras
- `cors` — origin restringido via `CLIENT_ORIGIN`
- `express-rate-limit` — 120 req/min por IP en `/api`
- Votos deduplicados con `UNIQUE(request_id, voter_token)` a nivel de BD
- Validación de formato de `voter_token` en el endpoint
- Validación de `listId` / `eventId` en Socket.IO (UUID regex)
- `helmet` + parámetros preparados (no concatenación de SQL)
