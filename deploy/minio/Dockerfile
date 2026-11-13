# Build from the upstream security release instead of relying on legacy mirror images.
FROM golang:1.26.9-bookworm AS server-build
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
RUN go install -trimpath github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z

FROM golang:1.26.9-bookworm AS client-build
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
RUN go install -trimpath github.com/minio/mc@RELEASE.2025-08-13T08-35-41Z

FROM alpine:3.24 AS server
RUN apk add --no-cache ca-certificates curl && addgroup -g 10001 storage && adduser -D -H -u 10001 -G storage storage
ENV HOME=/tmp
COPY --from=server-build /go/bin/minio /usr/local/bin/minio
LABEL org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.version="RELEASE.2025-10-15T17-29-55Z"
USER 10001:10001
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]

FROM alpine:3.24 AS client
RUN apk add --no-cache ca-certificates && addgroup -g 10001 storage && adduser -D -H -u 10001 -G storage storage
COPY --from=client-build /go/bin/mc /usr/local/bin/mc
COPY deploy/minio/init-storage.sh /usr/local/bin/init-storage.sh
ENV HOME=/tmp MC_CONFIG_DIR=/tmp/.mc
USER 10001:10001
ENTRYPOINT ["mc"]
