"""
Script de validación completa de la Fase 2 (API Flask, endpoints y concurrencia).
"""
import time
from app import app, manager

client = app.test_client()

print("1. Probando GET /api/status inicial...")
res = client.get("/api/status")
assert res.status_code == 200, f"Error {res.status_code}"
data = res.get_json()
print("  Status:", data)
assert data["status"] == "ok"
assert data["is_capturing"] is False
assert data["packet_count"] == 0

print("2. Probando POST /api/capture/start...")
res = client.post("/api/capture/start", json={"mode": "mock"})
assert res.status_code == 200
data = res.get_json()
print("  Start:", data)
assert data["status"] == "started"
assert data["is_capturing"] is True

print("  Esperando 1.2 segundos para que el hilo productor genere paquetes...")
time.sleep(1.2)

print("3. Probando GET /api/packets y no-bloqueo...")
start_t = time.time()
res = client.get("/api/packets")
latency = (time.time() - start_t) * 1000
assert res.status_code == 200
data = res.get_json()
print(f"  Packets (Latencia {latency:.2f} ms): Total capturados: {data['total_captured']}, Devueltos: {data['returned_count']}")
assert latency < 250, f"Latencia excesiva: {latency} ms"
assert data["returned_count"] >= 2
assert data["packets"][0]["id"] == 1

print("4. Probando parámetro incremental since_id...")
first_id = data["packets"][0]["id"]
res_since = client.get(f"/api/packets?since_id={first_id}")
data_since = res_since.get_json()
print(f"  Since ID {first_id}: devueltos {data_since['returned_count']} paquetes nuevos")
for p in data_since["packets"]:
    assert p["id"] > first_id

print("5. Probando POST /api/capture/stop...")
res = client.post("/api/capture/stop")
assert res.status_code == 200
data = res.get_json()
print("  Stop:", data)
assert data["status"] == "stopped"
assert data["is_capturing"] is False

print("6. Probando POST /api/capture/clear...")
res = client.post("/api/capture/clear")
assert res.status_code == 200
data = res.get_json()
print("  Clear:", data)
assert data["status"] == "cleared"
assert data["packet_count"] == 0

res_after = client.get("/api/packets")
data_after = res_after.get_json()
assert data_after["total_captured"] == 0
assert len(data_after["packets"]) == 0

print("\nTODAS LAS PRUEBAS DE LA FASE 2 PASARON EXITOSAMENTE (100% OK)!")

