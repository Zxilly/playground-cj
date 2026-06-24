#syntax=docker/dockerfile:1

# cj-runner image for Azure Container Apps Express: the full Cangjie toolchain
# (incl. cjfmt for /format) + the fghttp HTTP server, which sandboxes the run
# step in-process (see fghttp/main.go). Based on server/Dockerfile but builds
# fghttp instead of the Docker-per-request agent, and adds util-linux (prlimit).
#
# Mirrors default to global sources so it builds on GitHub-hosted runners; set
# build-args to switch to CN mirrors for a local/ACR build near China.
ARG CJV_TOOLCHAIN="1.1.0-beta.25"
ARG CJV_VERSION="latest"
ARG CJ_STDX_URL="https://gitcode.com/Cangjie/cangjie_stdx/releases/download/v1.1.0-beta.25/cangjie-stdx-linux-x64-1.1.0-beta.25.1.zip"
ARG GOPROXY="https://proxy.golang.org,direct"
ARG CJV_MIRROR="1"

FROM golang:1.26 AS builder
WORKDIR /app
ARG GOPROXY
ENV GOPROXY=${GOPROXY}
COPY . .
RUN go build -v -o /app/fghttp ./fghttp
ARG CJV_VERSION
RUN go install "github.com/Zxilly/cjv/cmd/cjv@${CJV_VERSION}"

FROM debian:12-slim
ARG CJV_TOOLCHAIN
ARG CJ_STDX_URL
ARG CJV_MIRROR

# cjc needs a C toolchain + linker + openssl; curl/unzip/ca-certs fetch the SDK;
# util-linux provides prlimit for the run sandbox's rlimits.
RUN apt-get update && \
    apt-get install -y --no-install-recommends binutils libc-dev build-essential openssl libssl-dev curl unzip ca-certificates util-linux && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /go/bin/cjv /usr/local/bin/cjv
ENV CJV_HOME="/opt/cjv"
ENV CJV_NO_PATH_SETUP="1"
ENV CJV_MIRROR=${CJV_MIRROR}

RUN set -eu; \
    cjv install "${CJV_TOOLCHAIN}"; \
    cjv default "${CJV_TOOLCHAIN}"; \
    cj_home="$(cjv which)"; \
    test -x "$cj_home/bin/cjc"; \
    test -x "$cj_home/tools/bin/cjfmt"; \
    ln -sfn "$cj_home" /cangjie

RUN set -eu; \
    curl -fsSL --retry 3 -o /tmp/stdx.zip "${CJ_STDX_URL}"; \
    unzip -q /tmp/stdx.zip -d /; \
    test -d /linux_x86_64_cjnative/dynamic/stdx; \
    rm /tmp/stdx.zip

COPY --from=builder /app/fghttp /usr/local/bin/fghttp

ENV CANGJIE_HOME="/cangjie"
ENV PATH="/cangjie/bin:/cangjie/tools/bin:/opt/cjv/bin:/usr/local/bin:/usr/bin:/bin"
ENV LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_cjnative:/cangjie/tools/lib:/linux_x86_64_cjnative/dynamic/stdx"

# /playground holds per-request temp dirs created by fghttp at runtime.
RUN mkdir -p /playground && chmod 777 /playground
WORKDIR /playground
RUN cjpm init
ADD ./cjpm.toml /playground/cjpm.toml

ENV PORT=8000
EXPOSE 8000
CMD ["/usr/local/bin/fghttp"]
