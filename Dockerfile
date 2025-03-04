FROM python:3.11-slim

# Use key=value format for ENV
ENV HOST=0.0.0.0
ENV PORT=8000
ENV DEBUG=True
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app.py ./backend/
COPY frontend/ ./frontend/
COPY .env .

EXPOSE 8000

CMD ["uvicorn", "backend.app:app", "--host", "${HOST}", "--port", "${PORT}"]