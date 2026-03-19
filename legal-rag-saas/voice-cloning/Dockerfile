FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    espeak-ng \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies with COMPATIBLE versions
# TTS 0.21.0 works with transformers 4.33.0
RUN pip install --no-cache-dir torch==2.0.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir transformers==4.33.0
RUN pip install --no-cache-dir TTS==0.21.0

# Accept TOS
ENV COQUI_TOS_AGREED=1

# Copy server code
COPY server.py .

EXPOSE 7860

CMD ["python", "server.py"]
