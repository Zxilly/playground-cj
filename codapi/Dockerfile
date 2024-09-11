FROM debian:12-slim

RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends binutils libc-dev build-essential && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --home /sandbox --create-home --shell /bin/sh sandbox

ADD ./Cangjie-0.55.3-linux_x64.tar.gz /
RUN chown -R sandbox:sandbox /cangjie && \
    chmod -R 755 /cangjie

USER sandbox
WORKDIR /sandbox

ENV CANGJIE_HOME="/cangjie"
ENV PATH="/cangjie/bin:/cangjie/tools/bin:/.cjpm/bin:$PATH"
ENV LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_llvm:/cangjie/tools/lib"
