# Node.js 后端服务 - node-pty 集成

基于 Express + WebSocket + node-pty 的伪终端服务。

## 功能特性

- 🚀 Express Web 服务器
- 🔌 WebSocket 实时通信
- 💻 node-pty 伪终端集成
- 🌐 Web 终端界面

## 安装依赖

```bash
pnpm install
```

## 启动服务

```bash
pnpm start
```

开发模式（自动重启）：
```bash
pnpm dev
```

## 访问

打开浏览器访问：http://localhost:3000

## API

- `GET /health` - 健康检查接口
- `WebSocket /` - 终端 WebSocket 连接

## 技术栈

- Express 4.x
- ws (WebSocket)
- node-pty 1.x
