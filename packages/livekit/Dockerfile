# LiveKit Cloud agent image (Python).
# Deploy: cd packages/livekit && lk agent create
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
  && python -c "from livekit.agents.cli import download_files; download_files()" 2>/dev/null \
  || python -m livekit.agents download-files 2>/dev/null \
  || true

COPY agent.py tools.py playbook.py ./

CMD ["python", "agent.py", "start"]
