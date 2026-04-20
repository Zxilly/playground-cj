#syntax=docker/dockerfile:1

ARG CJ_SDK_URL="https://cangjie-lang.cn/v1/files/auth/downLoad?nsId=142267&fileName=cangjie-sdk-linux-x64-1.1.0-beta.25.tar.gz&objectKey=69cb718e6e8ed61e6e07fd42"
ARG CJ_STDX_URL="https://gitcode.com/Cangjie/cangjie_stdx/releases/download/v1.1.0-beta.25/cangjie-stdx-linux-x64-1.1.0-beta.25.1.zip"

FROM golang:1.25 AS builder

WORKDIR /app
COPY . .
ENV GOPROXY="https://goproxy.cn"
RUN go build -v -o /app/agent ./cmd/agent

FROM debian:12-slim AS extract

ARG CJ_STDX_URL

RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends unzip curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL --retry 3 -o /tmp/stdx.zip "${CJ_STDX_URL}" && \
    mkdir -p /tmp/stdx-raw && \
    unzip -q /tmp/stdx.zip -d /tmp/stdx-raw && \
    stdx_dir=$(find /tmp/stdx-raw -type d -name stdx -print -quit) && \
    [ -n "$stdx_dir" ] || { echo "stdx dir not found in zip" >&2; exit 1; } && \
    mkdir -p /linux_x86_64_llvm/dynamic/stdx && \
    cp -a "$stdx_dir"/. /linux_x86_64_llvm/dynamic/stdx/ && \
    rm -rf /tmp/stdx-raw /tmp/stdx.zip

FROM debian:12-slim

ARG CJ_SDK_URL

RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends binutils libc-dev build-essential openssl libssl-dev curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL --retry 3 -o /tmp/sdk.tar.gz "${CJ_SDK_URL}" && \
    mkdir -p /cangjie && \
    tar -xzf /tmp/sdk.tar.gz -C /cangjie --strip-components=1 \
        --wildcards \
        --exclude='*/windows_x86_64_llvm*' \
        --exclude='*/mingw*' && \
    rm /tmp/sdk.tar.gz

COPY --from=extract /linux_x86_64_llvm/dynamic/stdx /linux_x86_64_llvm/dynamic/stdx
COPY --from=builder /app/agent /app/agent

ENV CANGJIE_HOME="/cangjie"
ENV PATH="/cangjie/bin:/cangjie/tools/bin:/.cjpm/bin:$PATH"
ENV LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_llvm:/cangjie/tools/lib:/linux_x86_64_llvm/dynamic/stdx"

RUN mkdir -p /playground
WORKDIR /playground

RUN cjpm init

ADD ./cjpm.toml /playground/cjpm.toml

ENTRYPOINT ["/app/agent"]
