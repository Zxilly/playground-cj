#syntax=docker/dockerfile:1-labs

ARG CJ_STDX_ZIP=cangjie-stdx-linux-x64-1.0.0.1.zip
ARG CJ_SDK_TAR=cangjie-sdk-linux-x64-1.0.0.tar.gz

FROM golang:1.24 AS builder

WORKDIR /app
COPY . .
ENV GOPROXY="https://goproxy.cn"
RUN go build -v -o /app/agent ./cmd/agent

FROM debian:12-slim AS extract

ARG CJ_STDX_ZIP
ADD ./${CJ_STDX_ZIP} /cangjie-stdx.zip

RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends unzip && \
    unzip /cangjie-stdx.zip

FROM debian:12-slim

ARG CJ_SDK_TAR
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends binutils libc-dev build-essential openssl libssl-dev && \
    rm -rf /var/lib/apt/lists/*

ADD --exclude=cangjie/lib/windows_x86_64_llvm/* \
    --exclude=cangjie/modules/windows_x86_64_llvm/* \
    --exclude=cangjie/modules/windows_x86_64_llvm/*/* \
    --exclude=cangjie/runtime/windows_x86_64_llvm/* \
    --exclude=cangjie/third_partry/mingw/*/* \
    ./${CJ_SDK_TAR} /

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