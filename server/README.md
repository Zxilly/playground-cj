# 构建镜像

运行用的 Cangjie **SDK 由 [cjv](https://cjv.zxilly.dev) 在镜像里安装**（替代旧的签名
URL 手动下载）。cjv 装好后，镜像把工具链软链到 `/cangjie`，因此 agent 与 `cjpm.toml`
无需改动。

`stdx` 仍直接下载压缩包解压到 `/linux_x86_64_cjnative`：cjv 对该 beta 版本的组件下载会
构造出错误的发布 tag（请求 `v1.1.0-beta.25.1`，实际 tag 为 `v1.1.0-beta.25`，导致 404），
所以用 `CJ_STDX_URL` 固定已知可用的归档；换工具链版本时同步更新它。

```bash
# 默认安装 ARG CJV_TOOLCHAIN 指定的版本（默认沿用项目当前的 1.1.0-beta.25）
docker build -t cangjie ./server

# 也可换成 cjv 的频道或其它版本（记得一并调整 CJ_STDX_URL）：
docker build -t cangjie --build-arg CJV_TOOLCHAIN=lts --build-arg CJ_STDX_URL=... ./server
```

镜像内默认 `CJV_MIRROR=1`（走 GitCode 镜像，便于国内网络）。

# 安装

```bash
useradd --groups docker --shell /usr/bin/bash --create-home --home /opt/cjplay cjplay
vi /etc/systemd/system/cjplay.service
```

# API

## `POST /run`

支持两种请求体：

- `Content-Type: application/json`：`{ "code": string, "stdin": string }`，
  `code` 为待编译运行的源码，`stdin` 会作为标准输入喂给编译后的程序（用于 OJ 按测试用例传入数据）。
- 其它（如 `text/plain`，遗留方式，playground 仍在使用）：整个请求体即为源码，不附带 stdin。

## `POST /format`

仅接受源码本身（请求体即源码），不涉及 stdin。
