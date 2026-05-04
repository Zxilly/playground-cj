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

AI 助教模式（`/tour/.../ai`）依赖一个 [new-api](https://github.com/QuantumNous/new-api) 实例颁发限额 token，并用 [Upstash Redis](https://upstash.com/) 做 IP→token 幂等映射。Next.js API 路由 `/api/ai-key` 在收到首次请求时会调用 new-api 创建 token，之后浏览器直接用该 token 访问 new-api 的 OpenAI 兼容端点。

服务端（Next.js 运行时，仅 server 可见）：

| 变量 | 必需 | 说明 |
|---|---|---|
| `NEW_API_BASE_URL` | ✓ | new-api 根地址（不带 `/v1`），如 `https://llm.example.com` |
| `NEW_API_ACCESS_TOKEN` | ✓ | 用来颁发 token 的 service user access token（new-api 后台「我的令牌」中获取） |
| `NEW_API_USER_ID` | ✓ | service user 的数字 ID（用于 `New-Api-User` header） |
| `NEW_API_TOKEN_GROUP` |  | token 所属分组，默认 `default` |
| `UPSTASH_REDIS_REST_URL` | ✓ | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ | Upstash Redis REST token |

客户端（`NEXT_PUBLIC_` 前缀，会被打入浏览器 bundle）：

| 变量 | 必需 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_LLM_BASE_URL` |  | LLM OpenAI 兼容端点，默认 `https://llm.learningman.top/v1` |
| `NEXT_PUBLIC_NEW_API_BASE_URL` |  | new-api 根地址（用于查询 token 用量），默认 `https://llm.learningman.top` |
| `NEXT_PUBLIC_LLM_DEFAULT_MODEL` |  | 默认模型名，默认 `gpt-4o-mini` |
| `NEXT_PUBLIC_BACKEND_URL` |  | cj-api（编译/运行后端）地址，默认 `https://cj-api.learningman.top` |

## TODO

- [x] 分享链接
- [x] 格式化
- [x] 代码高亮
- [ ] 允许导入流行第三方包
- [x] 彩色输出支持
- [ ] 用户友好的错误处理
- [ ] 用户友好的运行状态显示
