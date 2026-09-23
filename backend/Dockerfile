FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY . .

EXPOSE 8000
# Retries while Postgres is still starting (e.g. after `docker compose restart`).
ENTRYPOINT ["sh", "-c", "for i in $(seq 1 30); do alembic upgrade head && { python -m app.seed; exec uvicorn app.main:app --host 0.0.0.0 --port 8000; }; echo \"Database not ready, retry $i/30\"; sleep 1; done; exit 1"]
