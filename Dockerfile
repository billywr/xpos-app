# Build stage
FROM node:20-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build-time env (baked into bundle). Hardcoded so the image always has valid URLs.
# Ports match typical host mapping (backend 9003, Keycloak 8080). For localhost test, use http://localhost:9003 and http://localhost:8088.
ENV VITE_API_BASE_URL=http://localhost:9003 \
    VITE_KEYCLOAK_URL=http://localhost:8088 \
    VITE_KEYCLOAK_REALM=xpos \
    VITE_KEYCLOAK_CLIENT_ID=xpos-client-api

RUN npm run build

# Runtime stage
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
