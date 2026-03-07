# Build stage
FROM node:20-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build-time env (baked into bundle). Hardcoded so the image always has valid URLs.
# Use xpos.com hostnames; add to /etc/hosts: 127.0.0.1 xpos.com api.xpos.com auth.xpos.com
# Keycloak on host port 8088, backend on 9003.
ENV VITE_API_BASE_URL=http://api.xpos.com:9003 \
    VITE_KEYCLOAK_URL=http://auth.xpos.com:8088 \
    VITE_KEYCLOAK_REALM=xpos \
    VITE_KEYCLOAK_CLIENT_ID=xpos-client-api \
    VITE_USE_KEYCLOAK_PROXY=true

RUN npm run build

# Runtime stage
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 9011

CMD ["nginx", "-g", "daemon off;"]
