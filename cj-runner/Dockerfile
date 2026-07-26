#syntax=docker/dockerfile:1

# cj-runner image for managed on-demand container platforms. The full ~2.4GB
# toolchain imposes an unnecessary cold-start penalty, so this slims it to
# ~1.4GB by stripping libLLVM and dropping Windows cross libraries and unused
# developer tools while preserving the full compile path. Modal supplies the
# single-use container and network boundary for every invocation.
#
ARG GOPROXY="https://proxy.golang.org,direct"

FROM golang:1.26@sha256:3aff6657219a4d9c14e27fb1d8976c49c29fddb70ba835014f477e1c70636647 AS builder
WORKDIR /app
ARG GOPROXY
ENV GOPROXY=${GOPROXY}
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -v -o /cj-runner ./cmd/runner

# prep installs the toolchain, then trims it and stages the minimal subset at a
# fixed path (/cjroot) so the final COPY is version-agnostic.
FROM debian:12-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818 AS prep
# debian:slim does not guarantee a CA bundle before apt. Bootstrap that exact
# file from the already digest-pinned Go image so the snapshot stays on HTTPS.
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
RUN rm -f /etc/apt/sources.list /etc/apt/sources.list.d/* && \
    printf '%s\n' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260725T000000Z bookworm main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20260725T000000Z bookworm-security main' \
      > /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends binutils libc-dev build-essential openssl libssl-dev curl jq unzip ca-certificates && \
    rm -rf /var/lib/apt/lists/*
COPY cangjie-toolchain.lock.json install-cangjie-toolchain.sh /opt/playground-cj-toolchain/
RUN set -eu; \
    sh /opt/playground-cj-toolchain/install-cangjie-toolchain.sh \
      --lock /opt/playground-cj-toolchain/cangjie-toolchain.lock.json \
      --sdk-parent /opt/cangjie-sdk \
      --archive /tmp/cangjie-sdk.tar.gz \
      --stdx-root /; \
    test -x /opt/cangjie-sdk/cangjie/bin/cjc; \
    ln -s /opt/cangjie-sdk/cangjie /cangjie; \
    rm /tmp/cangjie-sdk.tar.gz /opt/cangjie-sdk/cangjie-stdx.zip
ENV CANGJIE_HOME="/cangjie" PATH="/cangjie/bin:/cangjie/tools/bin:$PATH" \
    LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_cjnative:/cangjie/tools/lib:/linux_x86_64_cjnative/dynamic/stdx"
RUN mkdir -p /playground
WORKDIR /playground
RUN cjpm init
COPY cjpm.toml /playground/cjpm.toml
# Slim: drop Windows cross libs, strip libLLVM (~650M), and drop developer
# executables while retaining tools/lib for the compiler's shared-library path.
# Then stage only the compile/runtime subset to /cjroot.
RUN set -eu; CJ="$(readlink -f /cangjie)"; \
    rm -rf "$CJ/lib/windows_x86_64_cjnative" "$CJ/lib/libstdFFI.dll" "$CJ/lib/libstdFFI.dll.a" \
           "$CJ/runtime/lib/windows_x86_64_cjnative" "$CJ/modules/windows_x86_64_cjnative"; \
    find "$CJ/third_party" -name 'libLLVM*' -type f -exec strip --strip-unneeded {} +; \
    rm -rf "$CJ/tools/bin"; \
    for d in "$CJ/tools"/*; do case "$(basename "$d")" in lib) ;; *) rm -rf "$d";; esac; done; \
    mkdir -p /cjroot; cp -a "$CJ/bin" "$CJ/lib" "$CJ/third_party" "$CJ/runtime" "$CJ/modules" "$CJ/tools" /cjroot/; \
    cp "$CJ/.playground-cj-toolchain-lock.sha256" /cjroot/; \
    chmod -R a+rX /cjroot /linux_x86_64_cjnative

FROM debian:12-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818
COPY --from=prep /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
RUN rm -f /etc/apt/sources.list /etc/apt/sources.list.d/* && \
    printf '%s\n' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260725T000000Z bookworm main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20260725T000000Z bookworm-security main' \
      > /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends binutils gcc libc6-dev && \
    find /usr/lib/gcc -maxdepth 3 -type f \( -name 'cc1*' -o -name 'lto1' \) -delete && \
    rm -f /usr/bin/*lto-dump* /usr/lib/x86_64-linux-gnu/lib*san.so* /usr/lib/x86_64-linux-gnu/libc.a && \
    rm -rf /var/lib/apt/lists/*
COPY --from=prep /cjroot /cangjie
COPY --from=prep /linux_x86_64_cjnative /linux_x86_64_cjnative
COPY --from=prep /playground /playground
COPY --from=prep /opt/playground-cj-toolchain/cangjie-toolchain.lock.json /usr/share/playground-cj/cangjie-toolchain.lock.json
COPY --from=builder /cj-runner /usr/local/bin/cj-runner
RUN chown -R 65532:65532 /playground && chmod 0700 /playground
ENV CANGJIE_HOME="/cangjie"
ENV PATH="/cangjie/bin:/usr/local/bin:/usr/bin:/bin"
ENV LD_LIBRARY_PATH="/cangjie/runtime/lib/linux_x86_64_cjnative:/cangjie/tools/lib:/linux_x86_64_cjnative/dynamic/stdx"
ENV PORT=8000
ENV CJ_RUNNER_ENV=production
EXPOSE 8000
USER 65532:65532
CMD ["/usr/local/bin/cj-runner"]
