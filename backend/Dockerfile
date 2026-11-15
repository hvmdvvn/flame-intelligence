FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 FLAME_DATA_DIR=/data
WORKDIR /app
COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir -c constraints.txt -r requirements.txt && useradd --uid 10001 --create-home flame
COPY app ./app
COPY migrations ./migrations
COPY data /seed
COPY entrypoint.py ./entrypoint.py
RUN mkdir /data && chown flame:flame /data
USER flame
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/ready',timeout=3)"
CMD ["python", "entrypoint.py"]
