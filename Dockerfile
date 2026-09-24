FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/editorialRegistry ./src/editorialRegistry
COPY scripts/editorial-registry ./scripts/editorial-registry
COPY content-registry/generated/registry.json ./content-registry/generated/registry.json
ENV NODE_ENV=production REGISTRY_HOST=0.0.0.0 PORT=8080 REQUIRE_API_KEY=true REGISTRY_PATH=content-registry/generated/registry.json
USER node
EXPOSE 8080
CMD ["npm", "run", "registry:serve"]
