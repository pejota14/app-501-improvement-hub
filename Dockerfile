FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY backend/requirements*.txt ./backend/
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r backend/requirements-dev.txt

COPY angular.json tsconfig*.json ./
COPY src ./src
COPY public ./public
COPY backend ./backend
COPY ci ./ci
COPY e2e ./e2e

RUN mkdir -p .local .angular/cache e2e/reports \
    && chmod -R a+rwX .local .angular e2e/reports

ENV LOCAL_CONTAINER=1 \
    LOCAL_PYTHON=/opt/venv/bin/python \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp

USER node

FROM runtime AS e2e
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium \
    && apt-get update \
    && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify \
    && rm -rf /var/lib/apt/lists/*
USER node
EXPOSE 6080
ENTRYPOINT ["node", "e2e/run.mjs"]

FROM runtime AS app
EXPOSE 4200 8000 4201 8001
ENTRYPOINT ["node", "ci/start.mjs"]