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

### 服务端

| 用途 | 必需变量 |
| ---- | ---- |
| 共享模型 | `SHARED_LLM_BASE_URL`、`SHARED_LLM_MODEL` |
| new-api | `NEW_API_BASE_URL`、`NEW_API_ACCESS_TOKEN`、`NEW_API_USER_ID` |
| Redis | `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` |
| Modal Runner | `CJ_RUNNER_MODAL_URL`、`CJ_RUNNER_MODAL_PROXY_KEY`、`CJ_RUNNER_MODAL_PROXY_SECRET`、`CJ_RUNNER_SHARED_TOKEN` |

生产环境还必须设置 `CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE`
和 `CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE`。自托管生产环境需另外设置
`AI_GATEWAY_TRUSTED_IP_HEADER`。其余限流、超时和缓存参数均有默认值。

### 客户端（可选）

| 变量 | 说明 |
| ---- | ---- |
| `NEXT_PUBLIC_LLM_BASE_URL` | OpenAI-compatible 默认端点 |
| `NEXT_PUBLIC_LLM_DEFAULT_MODEL` | OpenAI-compatible 默认模型 |
| `NEXT_PUBLIC_ANTHROPIC_BASE_URL` | Anthropic 默认端点 |
| `NEXT_PUBLIC_ANTHROPIC_DEFAULT_MODEL` | Anthropic 默认模型 |

## TODO

- [x] 分享链接
- [x] 格式化
- [x] 代码高亮
- [ ] 允许导入流行第三方包
- [x] 彩色输出支持
- [ ] 用户友好的错误处理
- [ ] 用户友好的运行状态显示
