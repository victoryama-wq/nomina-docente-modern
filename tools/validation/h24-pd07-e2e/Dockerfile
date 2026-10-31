ARG BASE=nomina-regression:h24-pd06-local-20261029
FROM ${BASE}
WORKDIR /app
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json apps/api/vitest.config.ts ./apps/api/
COPY apps/web/src ./apps/web/src
COPY tools ./tools
COPY database ./database
RUN npm --workspace apps/api run build
CMD ["sleep", "7200"]
