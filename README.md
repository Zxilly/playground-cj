# 仓颉 Playground

![Next.js](https://img.shields.io/badge/next.js-000000)
[![Runs All Unit tests](https://github.com/Zxilly/playground-cj/actions/workflows/test.yml/badge.svg)](https://github.com/Zxilly/playground-cj/actions/workflows/test.yml)

## Demo

[https://playground.cj.zxilly.dev](https://playground.cj.zxilly.dev)

## 开发

```bash
pnpm dev
```

## 环境变量

| 变量                                      | 必需 | 说明                                                                          |
| ----------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `SHARED_LLM_BASE_URL`                     | ✓    | 共享模型上游的 HTTPS OpenAI-compatible `/v1` 地址；生产环境不设则拒绝启动请求 |
| `SHARED_LLM_MODEL`                        | ✓    | 共享网关固定使用的模型名                                                      |
| `SHARED_LLM_TIMEOUT_MS`                   |      | 单次共享请求总超时（含请求体、Redis、凭据/元数据和上游），默认 `25000`         |
| `SHARED_LLM_IDENTITY_REQUESTS_PER_MINUTE` |      | 单个匿名身份每分钟请求上限，默认 `30`                                         |
| `SHARED_LLM_GLOBAL_REQUESTS_PER_MINUTE`   |      | 全部署每分钟请求上限，默认 `1000`                                             |
| `SHARED_LLM_MAX_CONCURRENT_REQUESTS`      |      | 每个服务进程从读取请求体到响应流结束的并发上限，默认 `32`                      |
| `SHARED_LLM_METADATA_IDENTITY_REQUESTS_PER_MINUTE` | | 单个匿名身份每分钟元数据请求上限，默认 `60`；不消耗模型额度 |
| `SHARED_LLM_METADATA_GLOBAL_REQUESTS_PER_MINUTE` | | 全部署每分钟元数据缓存未命中上限，默认 `500` |
| `SHARED_LLM_METADATA_MAX_CONCURRENT_REQUESTS` | | 每个进程查询 Redis/new-api 元数据的并发上限，默认 `8` |
| `SHARED_LLM_METADATA_CACHE_TTL_MS`        |      | 进程内配额元数据合并缓存时长，默认 `5000` 毫秒 |
| `SHARED_LLM_METADATA_CACHE_MAX_ENTRIES`   |      | 进程内配额元数据缓存条目上限，默认 `2000` |
| `AI_GATEWAY_TRUSTED_IP_HEADER`            | 自托管生产 | 由可信反向代理写入、且从公网请求中剥离后再覆盖的客户端 IP 请求头；共享模型和 runner 准入共同使用 |
| `NEW_API_BASE_URL`                        | ✓    | new-api HTTPS 根地址（不带 `/v1`）；仅非生产 loopback 可用 HTTP               |
| `NEW_API_ACCESS_TOKEN`                    | ✓    | 管理匿名身份额度 token 的专用 service user access token                       |
| `NEW_API_USER_ID`                         | ✓    | service user 的数字 ID（用于 `New-Api-User` header）                          |
| `NEW_API_TOKEN_GROUP`                     |      | token 所属分组，默认 `default`                                                |
| `CJ_RUNNER_URL`                           | ✓    | 服务端仓颉编译/运行后端 HTTPS 地址；仅非生产环境允许 loopback HTTP            |
| `CJ_RUNNER_SHARED_TOKEN`                  | 生产 | Next 网关与私有 runner 共享的 32–512 字节服务令牌；两个服务必须配置相同值      |
| `CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE`  | 生产 | 单个可信代理身份每分钟编译/运行请求上限；生产环境必须显式设置，开发默认 `10`   |
| `CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE`    | 生产 | 全部署每分钟编译/运行请求上限；不得小于身份上限，开发默认 `120`                |
| `CJ_RUNNER_ADMISSION_TIMEOUT_MS`          |      | Redis 分布式准入超时，范围 `100`–`5000` 毫秒，默认 `2000`                      |
| `UPSTASH_REDIS_REST_URL`                  | ✓    | 共享额度、并发锁和网关限流使用的 HTTPS Redis REST URL；仅非生产 loopback 可用 HTTP |
| `UPSTASH_REDIS_REST_TOKEN`                | ✓    | Upstash Redis REST token                                                      |

托管与自托管环境统一部署 [`cj-runner`](./cj-runner/README.md) 镜像；仓库不再维护第二套、边界不同的运行后端。原 `server/` 的 Docker-per-request 后端已移除，迁移原因、放弃的隔离特性和部署前提记录在 [ADR 0014](./docs/adr/0014-runner-backends-are-consolidated.md)。

共享模型按可信匿名身份隔离 new-api 额度，浏览器只读取额度元数据，永远不会
收到真实上游凭据。每个 managed token 都有有限失效时间；跨额度周期仍活跃
时才延长。创建新身份前会在全局分布式锁内从 new-api 的完整 inventory
清理已失效且超过在途宽限的 `pcj:s:` token，并强制最多保留 `512` 个。
因此轮换地址只能暂时占满容量，不能无限扩张上游数据库。new-api 应给该
专用 service user 配置不高于平台预算的 `max_user_tokens`，且不得混用人工
token；容量满时网关 fail-closed，而不会偷建替代凭据。

`/api/run` 与 `/api/format` 在读取源码前，先按可信基础设施提供的客户端
IP 做 Redis 原子化的 per-identity 与 global 准入，再进入每个 Next.js
进程的并发 bulkhead。Vercel 使用平台覆盖的 `x-vercel-forwarded-for`；
自托管反向代理必须删除公网同名请求头，并写入
`AI_GATEWAY_TRUSTED_IP_HEADER` 指定的头。`Origin` 和 Fetch Metadata 只用于
浏览器 CSRF 拦截，curl 可以伪造它们，因此它们从不参与身份或配额计算。
身份、Redis 凭据或生产限流值缺失时接口返回 `503`；触发分布式请求上限时
返回 `429`，本进程 bulkhead 饱和也返回 `503`。请求体与 runner 上游共享
一个固定的 28 秒总期限，为 30 秒函数执行预算保留响应收尾时间。
Redis、runner `fetch` 和请求/响应流都接收请求级取消信号；取消开始后，在
底层 I/O 真正结束前不会复用其 bulkhead 槽位，也不会准入替代请求。若底层
依赖违反取消契约并在 1 秒宽限期后仍未结束，生产进程会 fail-stop，避免靠
超时释放槽位累积无限 zombie I/O。Vercel 会替换该实例；自托管 Next.js
必须运行在会对非零退出自动重启的进程监督器或容器 restart policy 下。

客户端（`NEXT_PUBLIC_` 前缀，会被打入浏览器 bundle）：

| 变量                                  | 必需 | 说明                                                   |
| ------------------------------------- | ---- | ------------------------------------------------------ |
| `NEXT_PUBLIC_LLM_BASE_URL`            |      | 自定义 OpenAI-compatible 配置的默认端点                |
| `NEXT_PUBLIC_LLM_DEFAULT_MODEL`       |      | 自定义 OpenAI-compatible 配置的默认模型                |
| `NEXT_PUBLIC_ANTHROPIC_BASE_URL`      |      | 自定义 Anthropic 配置的默认端点                        |
| `NEXT_PUBLIC_ANTHROPIC_DEFAULT_MODEL` |      | 自定义 Anthropic 配置的默认模型                        |

## TODO

- [x] 分享链接
- [x] 格式化
- [x] 代码高亮
- [ ] 允许导入流行第三方包
- [x] 彩色输出支持
- [ ] 用户友好的错误处理
- [ ] 用户友好的运行状态显示
