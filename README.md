# Claude Code Terminal Server

基于 Express + WebSocket + node-pty 的 Web 终端服务，专为集成 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 设计。通过 WebSocket 将浏览器连接到服务端伪终端，支持自动启动 Claude Code 并自动接受权限提示。

## 功能

- WebSocket 实时双向通信，浏览器即终端
- node-pty 伪终端，支持完整的交互式 shell
- 自动检测并接受 Claude Code 权限提示（基于终端输出模式匹配）
- 支持自定义工作目录、shell 类型、初始命令
- 跨平台：Windows（PowerShell）/ Linux & macOS（Bash）
- 提供 REST API 模式和纯终端模式两种备选方案

## 环境要求

- Node.js >= 18
- pnpm
- Windows 需要安装 C++ 编译工具链（`npm install -g windows-build-tools` 或 Visual Studio Build Tools）

## 安装

```bash
pnpm install
```

> node-pty 是原生模块，安装时需要编译。如果遇到编译错误，参考 [node-pty 安装文档](https://github.com/nicktomlin/node-pty#dependencies)。

## 使用

### WebSocket 模式（主要）

```bash
pnpm start
```

启动后访问 http://localhost:3000 打开 Web 终端。

支持环境变量：

```bash
PORT=8080 pnpm start
```

### REST API 模式

```bash
pnpm api
```

提供 HTTP 接口控制终端，访问 http://localhost:3000/control.html 打开控制面板。

### 纯终端模式

```bash
pnpm terminal
```

在当前终端中直接运行伪终端（无 Web 服务）。

### 开发模式

```bash
pnpm dev
```

文件变更自动重启。

## 架构

```
src/
├── index.js          # WebSocket 终端服务（主入口）
├── api-server.js     # REST API 终端服务（备选）
└── terminal.js       # 纯终端模式（备选）

public/
├── index.html        # Web 终端界面（xterm.js）
└── control.html      # REST API 控制面板
```

## WebSocket 协议

连接地址：`ws://localhost:3000/ws`

### 客户端 -> 服务端

**init** - 初始化终端

```json
{
  "type": "init",
  "payload": {
    "workingDir": "/path/to/project",
    "cols": 120,
    "rows": 30,
    "shell": "bash",
    "initialCommand": "claude"
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| workingDir | 否 | 工作目录，默认当前目录 |
| cols | 否 | 列数，默认 120 |
| rows | 否 | 行数，默认 32 |
| shell | 否 | shell 类型，Windows 默认 powershell.exe，其他默认 bash |
| initialCommand | 否 | 终端就绪后自动执行的命令 |

**input** - 发送输入

```json
{
  "type": "input",
  "payload": { "data": "ls -la\r" }
}
```

**resize** - 调整终端大小

```json
{
  "type": "resize",
  "payload": { "cols": 120, "rows": 40 }
}
```

**terminate** - 关闭终端

```json
{ "type": "terminate" }
```

### 服务端 -> 客户端

| type | 说明 |
|---|---|
| `ready` | 连接就绪，返回 `sessionId` |
| `status` | 终端初始化完成 |
| `output` | 终端输出数据 |
| `error` | 错误信息 |
| `exit` | 终端进程退出，返回 `exitCode` |

## REST API

仅在 `pnpm api` 模式下可用。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| POST | `/api/execute` | 执行命令，body: `{ "command": "ls" }` |
| GET | `/api/output?lines=50` | 获取最近 N 行输出 |
| POST | `/api/clear` | 清空输出缓存 |
| GET | `/api/status` | 获取终端状态 |

## 自动接受权限提示

`src/index.js` 中内置了 Claude Code 权限提示的自动接受逻辑：

1. 持续缓存最近 4000 字符的终端输出
2. 清除 ANSI 转义序列后，匹配 `1. Yes` + `2/3. No/Yes` 模式
3. 检测到权限提示后，500ms 防抖延迟自动发送 `1`（选择 Yes）

如需关闭此功能，删除 `src/index.js` 中 `// 检测 Claude 权限提示并自动确认` 注释下方的代码块。

## 与前端项目集成

本服务设计为被前端项目（如 Vue/React 应用）通过 WebSocket 调用。典型集成方式：

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'init',
    payload: {
      workingDir: '/path/to/project',
      initialCommand: 'claude',
    },
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'output') {
    console.log(msg.payload.data);
  }
};
```

## 注意事项

- 本服务会启动真实的 shell 进程，**请勿暴露到公网**
- 自动接受权限功能仅适用于开发环境
- 每个 WebSocket 连接对应一个独立的终端进程，断开后自动清理

## 技术栈

- [Express](https://expressjs.com/) - HTTP 服务器
- [ws](https://github.com/websockets/ws) - WebSocket 服务端
- [node-pty](https://github.com/nicktomlin/node-pty) - 伪终端
- [xterm.js](https://xtermjs.org/) - Web 终端 UI（前端）

## License

MIT
