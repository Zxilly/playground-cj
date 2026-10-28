# 仓颉 Playground

![Next.js](https://img.shields.io/badge/next.js-000000)
[![Runs All Unit tests](https://github.com/Zxilly/playground-cj/actions/workflows/test.yml/badge.svg)](https://github.com/Zxilly/playground-cj/actions/workflows/test.yml)

## Demo

[https://playground.cj.zxilly.dev](https://playground.cj.zxilly.dev)

国内访问入口：[https://play.cj.zxilly.com](https://play.cj.zxilly.com)

## 部署

Vercel 与 EdgeOne Makers 分别部署同一 Next.js 应用，代码执行共用 Modal Runner。
EdgeOne 项目 `playground-cj-global` 使用全球可用区（含中国大陆）。
`master` 的单元测试工作流成功后，`EdgeOne Makers` 工作流自动构建并部署该次提交；
也可手动触发部署。构建使用 `edgeone.json` 和固定版本的 EdgeOne CLI。

GitHub Actions 需要配置 `EDGEONE_API_TOKEN` secret 和
`EDGEONE_PROJECT_NAME=playground-cj-global` variable。应用环境变量保存在
EdgeOne 项目的生产环境中，部署时由 CLI 同步；不需要在仓库中保存环境变量值。
EdgeOne 的 `AI_GATEWAY_TRUSTED_IP_HEADER` 设置为 `eo-connecting-ip`，
其余 Runner、Redis 和 AI 配置沿用现有服务。

原 `playground.cj.zxilly.dev` 和 `tour.cj.zxilly.dev` 继续由 Vercel 提供服务。
`proxy.ts` 使用 Vercel 的国家标记，将中国大陆的页面访问临时重定向至
`play.cj.zxilly.com`，保留路径和查询参数；独立教程域名映射至新站的 `/语言/tour/`。
其他地区继续访问原站，API 和静态资源不参与重定向。

## 开发

```bash
pnpm dev
```

## 仓颉代码验证

在 Linux 或 WSL 中安装 `cj-runner/cangjie-toolchain.lock.json` 锁定的 SDK，
加载其环境后执行：

```bash
source /path/to/cangjie/envsetup.sh
python3 scripts/verify-cangjie.py
pnpm content-packs:verify
```

全量检查会校验编译器版本及 SHA-256，编译并运行所有 Git 跟踪的 `.cj` 文件。
宏包使用 `--compile-macro`，并提取注释中的 `main.cj` 调用示例运行、核对输出；
测试宏额外使用 `--test` 执行断言。普通程序在独立临时目录中运行，使用空标准输入，
执行超时为 20 秒。可通过 `--jobs 4` 控制并发，`--report result.json` 保存结果。
课程验证另行检查练习参考答案、起始代码和课程样例的教学判定。

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
- [ ] 改进错误处理
- [ ] 改进运行状态显示
