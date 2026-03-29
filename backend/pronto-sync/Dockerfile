FROM mcr.microsoft.com/playwright/python:v1.54.0-jammy

WORKDIR /app

RUN pip install --no-cache-dir requests python-dotenv playwright==1.54.0

COPY scripts/prf_pronto_sync.py /app/scripts/prf_pronto_sync.py
COPY scripts/pronto_access.py /app/scripts/pronto_access.py
COPY pronto-sync/pronto_sync_worker.py /app/pronto_sync_worker.py

ENV PYTHONUNBUFFERED=1

CMD ["python", "/app/pronto_sync_worker.py"]
