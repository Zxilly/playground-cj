#syntax=docker/dockerfile:1

# Cangjie toolchain installed via cjv (https://cjv.zxilly.dev). Accepts a channel
# (lts / sts / nightly) or an exact version; defaults to the version the project
# currently targets so behaviour matches the old SDK download.
ARG CJV_TOOLCHAIN="1.1.0-beta.25"
# Pin the cjv CLI for reproducible builds (a release tag works too).
ARG CJV_VERSION="latest"
# stdx is fetched directly: cjv's component downloader builds the wrong release
# tag for this beta (it requests v1.1.0-beta.25.1, but the real tag is
# v1.1.0-beta.25), so pin the known-good archive. Bump alongside CJV_TOOLCHAIN.
ARG CJ_STDX_URL="https://gitcode.com/Cangjie/cangjie_stdx/releases/download/v1.1.0-beta.25/cangjie-stdx-linux-x64-1.1.0-beta.25.1.zip"

FROM golang:1.26 AS builder

WORKDIR /app
ENV GOPROXY="https://goproxy.cn"

# Build the run agent.
COPY . .
RUN go build -v -o /app/agent ./cmd/agent

# Build the cjv toolchain manager from source — no curl|sh needed.
ARG CJV_VERSION
RUN go install "github.com/Zxilly/cjv/cmd/cjv@${CJV_VERSION}"

FROM debian:12-slim

ARG CJV_TOOLCHAIN
ARG CJ_STDX_URL

# cjc needs a C toolchain + linker + openssl; curl/unzip/ca-certs fetch the SDK
# (via cjv) and the stdx archive. TUNA mirror keeps apt fast on CN networks.
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends binutils libc-dev build-essential openssl libssl-dev curl unzip ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /go/bin/cjv /usr/local/bin/cjv

# Keep cjv's data in a fixed location and never touch shell profiles (PATH /
# CANGJIE_HOME are wired explicitly below). CJV_MIRROR routes downloads through
# the GitCode mirror for CN networks.
ENV CJV_HOME="/opt/cjv"
ENV CJV_NO_PATH_SETUP="1"
ENV CJV_MIRROR="1"

# Install the Cangjie SDK via cjv, then expose its toolchain root at /cangjie —
# the path the agent and cjpm.toml already use — so no Go/cjpm changes are needed.
RUN set -eu; \
    cjv install "${CJV_TOOLCHAIN}"; \
    cjv default "${CJV_TOOLCHAIN}"; \
    cj_home="$(cjv which)"; \
    test -x "$cj_home/bin/cjc"; \
    ln -sfn "$cj_home" /cangjie

# stdx ships as a separate archive whose root is linux_x86_64_cjnative/, so it
# extracts straight to the path cjc links against (-L .../dynamic/stdx).
RUN set -eu; \
    curl -fsSL --retry 3 -o /tmp/stdx.zip "${CJ_STDX_URL}"; \
    unzip -q /tmp/stdx.zip -d /; \
    test -d /linux_x86_64_cjnative/dynamic/stdx; \
    rm /tmp/stdx.zip

COPY --from=builder /app/agent /app/agent

ENV CANGJIE_HOME="/cangjie"
ENV PATH="/cangjie/bin:/cangjie/tools/bin:/opt/cjv/bin:$PATH"
ENV LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_cjnative:/cangjie/tools/lib:/linux_x86_64_cjnative/dynamic/stdx"

RUN mkdir -p /playground
WORKDIR /playground

RUN cjpm init

ADD ./cjpm.toml /playground/cjpm.toml

ENTRYPOINT ["/app/agent"]
