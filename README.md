# 仓颉 Playground（playground-cj）

![Next.js](https://img.shields.io/badge/Next.js-16-000000)
[![Runs All Unit tests](https://github.com/Zxilly/playground-cj/actions/workflows/test.yml/badge.svg)](https://github.com/Zxilly/playground-cj/actions/workflows/test.yml)

基于 Next.js 16 + React 19 构建的仓颉编程语言（Cangjie）在线运行、交互式教程与 AI 教学平台。

- 国际站点：[https://playground.cj.zxilly.dev](https://playground.cj.zxilly.dev) / 教程独立域名：[https://tour.cj.zxilly.dev](https://tour.cj.zxilly.dev)
- 国内访问入口：[https://play.cj.zxilly.com](https://play.cj.zxilly.com)

## 核心功能与架构

| 模块 | 路径 | 说明 |
| ---- | ---- | ---- |
| **Playground** | `/{lang}` | 在线编写、格式化、运行与分享仓颉代码，内置 18 个中英文示例（`src/examples/`）与彩色 ANSI 输出 |
| **仓颉之旅（Tour）** | `/{lang}/tour`（或 `tour.*` 域名下 `/{lang}`） | 12 章双语交互式教程（`tour/`），支持 C / Java / Go / Rust 跨语言对比与内嵌运行 |
| **AI 课堂（Teach）** | `/{lang}/tour/ai` | 基于概念图（`src/lib/ai/concept-graph/`）与离线构建内容包（`src/lib/teach/classroom/`）的自适应交互学习与练习评测 |
| **浏览器端 WASM LSP & Formatter** | `public/lsp/`、`src/lib/lsp*`、`src/lib/cangjie-formatter.ts` | 在浏览器 Web Worker 中运行仓颉 WASM 语言服务与格式化器，提供补全、悬停与类型诊断 |
| **远程执行后端** | `cj-runner/`（Go）+ `modal/`（Python） | 沙盒化编译与运行仓颉程序，工具链版本与 SHA-256 锁定在 `cj-runner/cangjie-toolchain.lock.json`（含 `cjc 1.2.0` 与 `stdx 1.2.0.1`） |

## 环境要求

- **Node.js**：`>= 24.0.0`（见 `package.json` 的 `engines.node`）
- **包管理器**：`pnpm@12.14.0`（建议通过 Corepack 启用：`corepack enable`）
- **可选（本地验证仓颉代码与内容包）**：Python 3 + 本地仓颉 SDK（`cjc`）

## 本地开发

首次克隆仓库后安装依赖并启动开发服务器：

```bash
pnpm install
pnpm dev
```

> 说明：`pnpm dev` 会通过 `predev` 自动执行 `pnpm prep`（拉取 WASM LSP/Formatter 资产）、`pnpm lingui:compile`、`pnpm fonts:generate` 和 `pnpm monaco:generate-nls`。如果跳过 `predev` 直接运行 `next dev` 或未执行 `pnpm prep`，`next.config.ts` 会因缺少 WASM 资产直接报错。

若修改了 `tour/` 或 `src/lib/ai/concept-graph/` 内容，开发或构建前需同步重新生成 AI 课堂内容包（`prebuild` / `pretest` 会自动运行，`predev` 不会自动运行）：

```bash
pnpm content-packs:generate
```

## 常用脚本

| 命令 | 说明 |
| ---- | ---- |
| `pnpm prep` | 下载并校验浏览器端 WASM LSP / Formatter 资产到 `public/lsp/` |
| `pnpm dev` | 启动本地开发服务器（自动触发 `predev`） |
| `pnpm build` | 生产构建（自动触发 `prebuild`，含内容包、i18n、字体子集与 Monaco NLS 生成） |
| `pnpm content-packs:generate` | 根据 `tour/` 与 `concept-graph.json` 生成 `src/lib/teach/classroom/generated/content-packs/{en,zh}.json` |
| `pnpm content-packs:verify` | 校验生成内容包一致性，并使用 `cjc` 编译运行全部练习与独立代码样例 |
| `pnpm lingui:extract` | 扫描源码并更新 `src/locales/{zh,en}/messages.po` |
| `pnpm lingui:compile` | 编译 Lingui 翻译目录 |
| `pnpm fonts:generate` | 基于 Lingui 中文词表生成 `harmony-ui-zh.woff2` 等字体子集 |
| `pnpm monaco:generate-nls` | 裁剪并生成 Monaco/VS Code 简体中文 NLS 消息包 |
| `pnpm run lint` / `pnpm run lint:fix` | 运行 ESLint 静态检查 / 自动修复 |
| `pnpm exec tsc --noEmit --incremental false` | 执行全量 TypeScript 类型检查 |
| `pnpm test:run` | 运行全部单元与组件测试（`unit` + `component` 项目） |
| `pnpm test:browser` | 运行 Playwright 真实浏览器组件测试（`browser` 项目） |
| `pnpm test:e2e` | 运行端到端测试（生产模式验收可设置 `PLAYGROUND_TEST_MODE=production`） |

## 仓颉代码与内容包验证

在 Linux / CI 或 WSL 环境中安装 `cj-runner/cangjie-toolchain.lock.json` 锁定的 SDK 并加载环境后执行：

```bash
source /path/to/cangjie/envsetup.sh
python3 scripts/verify-cangjie.py
pnpm content-packs:verify
```

- `scripts/verify-cangjie.py`：在 Linux 锁定环境下校验编译器版本及 SHA-256，编译并运行仓库内全部 Git 跟踪的 `.cj` 文件（宏包使用 `--compile-macro` 并提取注释调用示例验证，测试宏额外使用 `--test` 执行断言）。支持 `--jobs 4` 控制并发与 `--report result.json` 导出报告。
- `pnpm content-packs:verify`：校验 `en.json` / `zh.json` 内容包与源码完全一致，并编译运行全部练习参考答案、初始代码与独立代码样例。
  - **Linux / CI**：默认严格校验 `cj-runner/cangjie-toolchain.lock.json` 中锁定的 Linux x64 `cjc` SHA-256、目标三元组与版本号。
  - **Windows / macOS 本地开发**：自动跳过 Linux-only 的 SHA-256 与目标三元组锁定检查并打印提示，仍会使用本地 `cjc` 编译运行全部程序以验证功能正确性（设置 `CONTENT_PACKS_STRICT_TOOLCHAIN=1` 可强制启用严格校验）。

## 环境变量

### Next.js 服务端

| 用途 | 变量 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| 共享模型 | `SHARED_LLM_BASE_URL`、`SHARED_LLM_MODEL` | 生产推荐 | 共享 AI 额度的上游模型地址与模型名 |
| new-api | `NEW_API_BASE_URL`、`NEW_API_ACCESS_TOKEN`、`NEW_API_USER_ID` | 使用共享额度时必填 | 用于动态签发共享额度令牌 |
| new-api 分组 | `NEW_API_TOKEN_GROUP` | 可选（默认 `default`） | 签发令牌所属分组 |
| Redis | `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN` | 生产必填 | 限流、配额与共享状态存储 |
| Modal Runner | `CJ_RUNNER_MODAL_URL`、`CJ_RUNNER_MODAL_PROXY_KEY`、`CJ_RUNNER_MODAL_PROXY_SECRET`、`CJ_RUNNER_SHARED_TOKEN` | 生产必填 | 调用远程沙盒编译运行服务的地址与鉴权凭据 |
| 限流与代理头 | `CJ_RUNNER_IDENTITY_REQUESTS_PER_MINUTE`、`CJ_RUNNER_GLOBAL_REQUESTS_PER_MINUTE` | 生产必填 | 单身份与全局每分钟运行次数上限 |
| 反向代理 IP | `AI_GATEWAY_TRUSTED_IP_HEADER` | 自托管 / EdgeOne 必填 | 客户端真实 IP 请求头（如 EdgeOne 下设为 `eo-connecting-ip`） |

### Next.js 客户端（均可选）

| 变量 | 说明 |
| ---- | ---- |
| `NEXT_PUBLIC_LLM_BASE_URL` | OpenAI-compatible 默认端点 |
| `NEXT_PUBLIC_LLM_DEFAULT_MODEL` | OpenAI-compatible 默认模型 |
| `NEXT_PUBLIC_ANTHROPIC_BASE_URL` | Anthropic 默认端点 |
| `NEXT_PUBLIC_ANTHROPIC_DEFAULT_MODEL` | Anthropic 默认模型 |
| `NEXT_PUBLIC_CANGJIE_MCP_URL` | 仓颉文档 / 工具 MCP 服务地址 |

### 独立 Runner 与部署（CI / 后端）

| 作用域 | 变量 | 说明 |
| ---- | ---- | ---- |
| `cj-runner`（Go） | `CJ_RUNNER_ENV`、`CJ_RUNNER_ISOLATION_DRIVER`、`CJ_RUNNER_SHARED_TOKEN`、`PORT` | 运行环境、隔离驱动、共享鉴权令牌与监听端口 |
| `modal/` 部署 | `MODAL_TOKEN_ID`、`MODAL_TOKEN_SECRET` | GitHub Actions 部署 Modal Runner 所需凭据 |
| EdgeOne 部署 | `EDGEONE_API_TOKEN`（Secret）、`EDGEONE_PROJECT_NAME`（Variable） | EdgeOne Makers 自动部署凭据与项目名（`playground-cj-global`） |
| 本地验证 / 测试 | `CJC` / `CANGJIE_HOME` / `CJV_HOME`、`CONTENT_PACKS_STRICT_TOOLCHAIN`、`PLAYGROUND_TEST_MODE` | 指定 `cjc` 路径、强制严格校验工具链、切换 E2E 生产构建模式 |

## 部署架构

Vercel 与 EdgeOne Makers 分别部署同一套 Next.js 应用，代码执行共用 Modal Runner：

- EdgeOne 项目 `playground-cj-global` 使用全球可用区（含中国大陆），在 `master` 单元测试通过后由工作流自动构建部署（使用 `edgeone.json` 与固定版本 EdgeOne CLI，兼容钩子说明见 [docs/edgeone-hook.md](./docs/edgeone-hook.md)）。
- 原域名 `playground.cj.zxilly.dev` 与 `tour.cj.zxilly.dev` 继续由 Vercel 提供服务。
- `src/proxy.ts` 负责：
  1. 根据 Vercel 国家头将中国大陆的页面请求 302 重定向至 `play.cj.zxilly.com`（保留路径与查询参数，`tour.*` 映射至 `/{lang}/tour/...`）；
  2. 为 `tour.*` 独立域名处理无 `/tour/` 前缀的 URL 重写与重定向；
  3. 为教程章节整理前的旧步号 URL（如 `/basics/23`–`35`）提供 301 永久重定向。

## 常见问题排查

1. **启动或构建报错缺少 WASM / `.cjo` 资产**
   先执行 `pnpm prep` 下载并校验 `public/lsp/` 资产后再运行 `next dev` 或 `next build`。
2. **`pnpm content-packs:verify` 提示内容包过期（`stale`）**
   修改 `tour/` 或 `concept-graph.json` 后运行 `pnpm content-packs:generate` 重新生成并提交 `generated/content-packs/{en,zh}.json`。
3. **Windows / macOS 本地运行 `pnpm content-packs:verify` 提示找不到 `cjc`**
   将仓颉 SDK 的 `bin` 目录加入 `PATH`，或通过 `CJC` / `CANGJIE_HOME` / `CJV_HOME` 环境变量显式指定 `cjc` 路径。非 Linux 主机在本地开发时会自动跳过 Linux x64 SHA-256 校验，仍会编译运行所有样例。
4. **运行 `pnpm run lint` 或 `vitest` 发现教程内容校验失败**
   查看 `src/tour/content-guardrails.test.ts` 的报错信息，确认目录数字前缀唯一、`<CompareWith lang="...">` 仅使用受支持语言（`c` / `java` / `go` / `rust`）、`concept-graph.json` 引用的路径存在且正文不含硬编码行号指引。

## 工程文档索引

- [EdgeOne 兼容钩子与升级指南](./docs/edgeone-hook.md)
- [设计验收记录（2026-10-28）](./docs/design/design-qa-2026-10-28.md)
- [共享编辑器与响应式基线（2026-10-28）](./docs/performance/editor-reuse-2026-10-28.md)
- 历史性能实验快照（已被后续变更取代）：[playground-startup.md](./docs/performance/playground-startup.md)、[monaco-startup.md](./docs/performance/monaco-startup.md)、[frontend-experience.md](./docs/performance/frontend-experience.md)
