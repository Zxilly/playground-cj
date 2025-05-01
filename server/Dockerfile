#syntax=docker/dockerfile:1-labs

FROM golang:1.24 AS builder

WORKDIR /app
COPY . .
ENV GOPROXY="https://goproxy.cn"
RUN go build -v -o /app/agent ./cmd/agent

FROM debian:12-slim AS extract

ADD ./cangjie-stdx-linux-x64-0.60.5.1.zip /cangjie-stdx.zip

RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends unzip && \
    unzip /cangjie-stdx.zip

FROM debian:12-slim

RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends binutils libc-dev build-essential openssl libssl-dev && \
    rm -rf /var/lib/apt/lists/*

ADD --exclude=cangjie/lib/windows_x86_64_llvm/* \
    --exclude=cangjie/modules/windows_x86_64_llvm/* \
    --exclude=cangjie/modules/windows_x86_64_llvm/*/* \
    --exclude=cangjie/runtime/windows_x86_64_llvm/* \
    --exclude=cangjie/third_partry/mingw/*/* \
    ./cangjie-sdk-linux-x64-0.60.5.tar.gz /

COPY --from=extract /linux_x86_64_llvm/static/stdx /linux_x86_64_llvm/static/stdx

COPY --from=builder /app/agent /app/agent

ENV CANGJIE_HOME="/cangjie"
ENV PATH="/cangjie/bin:/cangjie/tools/bin:/.cjpm/bin:$PATH"
ENV LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_llvm:/cangjie/tools/lib"

RUN mkdir -p /playground

WORKDIR /playground

RUN cjpm init

ADD ./cjpm.toml /playground/cjpm.toml

ENTRYPOINT ["/app/agent"]
