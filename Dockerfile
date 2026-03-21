# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS dev
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
COPY . .
EXPOSE 4321
CMD ["npm", "run", "dev"]

FROM base AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
