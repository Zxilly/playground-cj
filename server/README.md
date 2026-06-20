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
