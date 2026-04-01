# API 接口文档

## 启动服务

```bash
pnpm api
```

## 接口列表

### 1. 执行命令
**POST** `/api/execute`

请求体：
```json
{
  "command": "ls -la"
}
```

响应：
```json
{
  "success": true,
  "message": "Command executed",
  "command": "ls -la"
}
```

### 2. 获取输出
**GET** `/api/output?lines=50`

参数：
- `lines`: 返回最后 N 行输出（默认 50）

响应：
```json
{
  "output": "命令输出内容...",
  "totalLength": 12345
}
```

### 3. 清空输出
**POST** `/api/clear`

响应：
```json
{
  "success": true,
  "message": "Output cleared"
}
```

### 4. 获取状态
**GET** `/api/status`

响应：
```json
{
  "running": true,
  "outputLength": 12345,
  "shell": "powershell.exe",
  "cwd": "D:\\work-code\\node-pty"
}
```

## Web 控制面板

访问：http://localhost:3000/control.html
