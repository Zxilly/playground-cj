#syntax=docker/dockerfile:1

# cj-runner image for Azure Container Apps Express. Express provisions from a
# prewarmed pool with a tight image-ready time budget, so the full ~2.4GB
# toolchain image fails to come up. This slims it to ~1.4GB (which provisions in
# a couple seconds) by stripping libLLVM, dropping the Windows cross libs, and
# keeping only cjfmt out of tools/ (needed for /format) — while preserving the
# full compile path. fghttp sandboxes the run step in-process (see fghttp/main.go).
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

# prep installs the toolchain, then trims it and stages the minimal subset at a
# fixed path (/cjroot) so the final COPY is version-agnostic.
FROM debian:12-slim AS prep
ARG CJV_TOOLCHAIN
ARG CJ_STDX_URL
ARG CJV_MIRROR
RUN apt-get update && \
    apt-get install -y --no-install-recommends binutils libc-dev build-essential openssl libssl-dev curl unzip ca-certificates && \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /go/bin/cjv /usr/local/bin/cjv
ENV CJV_HOME="/opt/cjv" CJV_NO_PATH_SETUP="1" CJV_MIRROR=${CJV_MIRROR}
RUN set -eu; cjv install "${CJV_TOOLCHAIN}"; cjv default "${CJV_TOOLCHAIN}"; \
    cj_home="$(cjv which)"; test -x "$cj_home/bin/cjc"; test -x "$cj_home/tools/bin/cjfmt"; ln -sfn "$cj_home" /cangjie
RUN set -eu; curl -fsSL --retry 3 -o /tmp/stdx.zip "${CJ_STDX_URL}"; unzip -q /tmp/stdx.zip -d /; \
    test -d /linux_x86_64_cjnative/dynamic/stdx; rm /tmp/stdx.zip
ENV CANGJIE_HOME="/cangjie" PATH="/cangjie/bin:/cangjie/tools/bin:/opt/cjv/bin:$PATH" \
    LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_cjnative:/cangjie/tools/lib:/linux_x86_64_cjnative/dynamic/stdx"
RUN mkdir -p /playground && chmod 777 /playground
WORKDIR /playground
RUN cjpm init
COPY cjpm.toml /playground/cjpm.toml
# Slim: drop Windows cross libs, strip libLLVM (~650M), and keep only cjfmt out
# of tools/ (drop cjdb/cjcov/cjpm/lsp/etc.) while preserving tools/lib that cjfmt
# links against. Then stage the needed subset (incl. tools) to /cjroot.
RUN set -eu; CJ="$(readlink -f /cangjie)"; \
    rm -rf "$CJ/lib/windows_x86_64_cjnative" "$CJ/lib/libstdFFI.dll" "$CJ/lib/libstdFFI.dll.a" \
           "$CJ/runtime/lib/windows_x86_64_cjnative" "$CJ/modules/windows_x86_64_cjnative"; \
    find "$CJ/third_party" -name 'libLLVM*' -type f -exec strip --strip-unneeded {} + 2>/dev/null || true; \
    find "$CJ/tools/bin" -mindepth 1 ! -name cjfmt -delete 2>/dev/null || true; \
    for d in "$CJ/tools"/*; do case "$(basename "$d")" in bin|lib) ;; *) rm -rf "$d";; esac; done; \
    mkdir -p /cjroot; cp -a "$CJ/bin" "$CJ/lib" "$CJ/third_party" "$CJ/runtime" "$CJ/modules" "$CJ/include" "$CJ/tools" /cjroot/; \
    chmod -R a+rX /cjroot /linux_x86_64_cjnative; chmod -R 777 /playground

FROM debian:12-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends binutils gcc libc6-dev util-linux && \
    find /usr/lib/gcc -maxdepth 3 -type f \( -name 'cc1*' -o -name 'lto1' \) -delete && \
    rm -f /usr/bin/*lto-dump* /usr/lib/x86_64-linux-gnu/lib*san.so* /usr/lib/x86_64-linux-gnu/libc.a && \
    rm -rf /var/lib/apt/lists/*
COPY --from=prep /cjroot /cangjie
COPY --from=prep /linux_x86_64_cjnative /linux_x86_64_cjnative
COPY --from=prep /playground /playground
COPY --from=builder /app/fghttp /usr/local/bin/fghttp
ENV CANGJIE_HOME="/cangjie"
ENV PATH="/cangjie/bin:/cangjie/tools/bin:/usr/local/bin:/usr/bin:/bin"
ENV LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_cjnative:/cangjie/tools/lib:/linux_x86_64_cjnative/dynamic/stdx"
ENV PORT=8000
EXPOSE 8000
CMD ["/usr/local/bin/fghttp"]
