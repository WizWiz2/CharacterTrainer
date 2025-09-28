# syntax=docker/dockerfile:1.5
FROM node:18-bullseye AS build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend ./
RUN npm run build

FROM node:18-bullseye
WORKDIR /app/frontend

ENV NODE_ENV=production

COPY --from=build /app/frontend/dist ./dist

RUN npm install -g serve

EXPOSE 4173

ENV VITE_API_URL="http://backend:8000"

CMD ["serve", "-s", "dist", "-l", "4173"]
