# Build with an approved generated project's package.json and lockfile in context.
# The running agent never installs dependencies or accesses the network.
FROM node:22-bookworm-slim
WORKDIR /opt
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund && npm cache clean --force
ENV PATH="/opt/node_modules/.bin:${PATH}"
USER 1000:1000
WORKDIR /workspace
