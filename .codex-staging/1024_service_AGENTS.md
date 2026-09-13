---
description: 1024 游戏 TypeScript + Fastify + MySQL 后端服务
---

## 项目概况

- 项目部署在 `/home/ubuntu/projects/1024_service`，与 Cocos Creator 客户端分开维护。
- 技术栈为 Node.js 22、TypeScript、Fastify 5 和 MySQL；数据库驱动使用 `mysql2`。
- TypeScript 源码位于 `src/`，编译产物位于 `dist/`，数据库初始化脚本位于 `sql/001_init.sql`。
- `src/app.ts` 负责组装 Fastify 应用，`src/server.ts` 负责监听端口与优雅退出，`src/database.ts` 统一创建 MySQL 连接池。
- `GET /health` 检查 HTTP 服务，`GET /health/db` 检查 MySQL 连接。
- 数据库结构已为经典、闯关和双人模式预留玩家与分数记录，但对应业务接口尚未实现。

## 开发规则

- 使用严格 TypeScript，不用 `any` 绕过类型检查；新增模块使用 ESM，并在相对导入路径中保留 `.js` 扩展名。
- 路由只处理参数验证、鉴权和响应转换；游戏业务逻辑与数据库访问应拆分到独立 service/repository 模块。
- 所有外部输入必须通过 Fastify JSON Schema 或等效机制校验，不能信任客户端上传的分数、关卡或用户身份。
- 数据库访问统一复用 Fastify 实例上的连接池，使用参数化查询，禁止拼接用户输入生成 SQL。
- 数据库表结构变更新增顺序迁移脚本，不直接覆盖已执行的初始化脚本；迁移需兼容已有数据。
- 新增连接、定时器、后台任务或外部客户端时，必须在 Fastify `onClose` 阶段释放。
- `.env`、数据库密码、令牌和私钥不得提交到 Git；新增环境变量时同步更新 `.env.example` 和 `README.md`。
- 不手工修改或提交 `dist/`、`node_modules/`，不要进行无关重构或破坏性 Git 操作。

## 运行环境

- Node.js 由 NVM 安装在 `/home/ubuntu/.nvm/versions/node/v22.23.2`。非交互 SSH 未必加载 NVM，运行 Node/npm 前使用 `export PATH=/home/ubuntu/.nvm/versions/node/v22.23.2/bin:/usr/bin:/bin`。
- 服务默认只监听 `127.0.0.1:3000`，正式公网访问应通过 Nginx 反向代理和 HTTPS，不直接暴露开发端口。
- 初始搭建时服务器尚未安装和配置 MySQL 服务端，也尚未配置 systemd、Nginx、域名和 HTTPS；操作前先检查当前状态，不依据本说明假设仍未配置。
- MySQL 应使用应用专用的最小权限账号，不使用 root 账号运行服务；生产密码只保存在服务器 `.env` 或安全的密钥管理中。

## 验证与交付

- 修改后至少运行 `npm run typecheck`、`npm run build` 和 `npm test`。
- 涉及数据库时还需在测试数据库执行迁移，并验证 `/health/db`；没有可用 MySQL 时必须明确说明未完成数据库联调。
- 接口变更需同步更新 `README.md`，说明请求参数、响应结构、错误码和新增环境变量。
- 交付时简要说明修改文件、验证结果、数据库迁移以及仍需部署配置的事项。
