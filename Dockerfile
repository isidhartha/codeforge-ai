FROM python:3.11-slim

LABEL maintainer="CodeForge AI"
LABEL description="CodeForge AI Backend - FastAPI AI Coding Assistant"

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies first (layer caching)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Create workspace directory
RUN mkdir -p /workspace

# Non-root user
RUN useradd -m -u 1000 codeforge && chown -R codeforge:codeforge /app /workspace
USER codeforge

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info"]
