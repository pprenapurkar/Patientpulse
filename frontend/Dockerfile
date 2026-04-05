FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_APP_ENV=production
ARG VITE_PATIENT_ID=maria-chen-uuid
ARG VITE_CLINICIAN_TOKEN=demo-clinician-token
ARG VITE_PATIENT_TOKEN=demo-patient-token
# Copy package.json only first for better layer caching
COPY package.json ./
# Use npm install (not npm ci) — no lockfile required
RUN npm install --legacy-peer-deps
COPY . .
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_PATIENT_ID=$VITE_PATIENT_ID
ENV VITE_CLINICIAN_TOKEN=$VITE_CLINICIAN_TOKEN
ENV VITE_PATIENT_TOKEN=$VITE_PATIENT_TOKEN
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
