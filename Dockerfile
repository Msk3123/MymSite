# «Мамина шафа»: один образ — React-сайт + .NET API. Збирається на сервері з deploy/server/docker-compose.yml.

# ---------- 1. Сайт (React + Vite) ----------
FROM node:22-alpine AS client
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---------- 2. API (.NET) ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
# Спершу лише проєкти — щоб restore кешувався, поки не змінились залежності.
COPY SIteMym.sln ./
COPY src/SiteMym.Domain/SiteMym.Domain.csproj src/SiteMym.Domain/
COPY src/SiteMym.Application/SiteMym.Application.csproj src/SiteMym.Application/
COPY src/SiteMym.Infrastructure/SiteMym.Infrastructure.csproj src/SiteMym.Infrastructure/
COPY src/SiteMym.Api/SiteMym.Api.csproj src/SiteMym.Api/
RUN dotnet restore src/SiteMym.Api/SiteMym.Api.csproj
COPY src/ src/
RUN dotnet publish src/SiteMym.Api/SiteMym.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# ---------- 3. Запуск ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
COPY --from=client /client/dist ./client

# /data — том Docker: фото речей і ключі входу переживають оновлення.
RUN mkdir -p /data/uploads /data/keys && chown -R app:app /data
USER app

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080 \
    Client__DistPath=/app/client \
    Storage__LocalPath=/data/uploads \
    DataProtection__KeysPath=/data/keys \
    ForwardedHeaders__TrustAllProxies=true

EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["dotnet", "SiteMym.Api.dll"]
