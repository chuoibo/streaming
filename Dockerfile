ARG BASE_IMAGE=python:3.10.14-slim-bullseye
FROM ${BASE_IMAGE}

ENV HOST=0.0.0.0
ENV PORT=8000
ENV DEBUG=True

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app.py .
COPY .env .

EXPOSE ${PORT}
EXPOSE 5000

CMD ["sh", "-c", "uvicorn app:app --host ${HOST} --port ${PORT}"]