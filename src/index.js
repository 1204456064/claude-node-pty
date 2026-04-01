import express from 'express';
import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import { randomUUID } from 'crypto';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

const server = app.listen(PORT, () => {
  console.log(`Terminal server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server, path: '/ws' });

function send(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function createShellOptions(payload = {}) {
  const isWindows = process.platform === 'win32';
  const shell = payload.shell || (isWindows ? 'powershell.exe' : 'bash');
  const shellArgs = payload.shellArgs || (isWindows ? ['-NoLogo', '-ExecutionPolicy', 'Bypass'] : []);

  return {
    shell,
    shellArgs,
    cwd: payload.workingDir || process.cwd(),
    cols: Number(payload.cols) || 120,
    rows: Number(payload.rows) || 32,
  };
}

wss.on('connection', (ws) => {
  const sessionId = randomUUID();
  let ptyProcess = null;
  let initialized = false;

  console.log(`[${sessionId}] Client connected`);

  send(ws, {
    type: 'ready',
    payload: { sessionId },
  });

  ws.on('message', (rawMessage) => {
    try {
      const message = JSON.parse(rawMessage.toString());
      const { type, payload = {} } = message;

      if (type === 'init') {
        console.log(`[${sessionId}] Initializing terminal:`, { cwd: payload.workingDir, initialCommand: payload.initialCommand });
        if (initialized) {
          send(ws, { type: 'error', payload: { message: 'Terminal already initialized' } });
          return;
        }

        const { shell, shellArgs, cwd, cols, rows } = createShellOptions(payload);
        ptyProcess = pty.spawn(shell, shellArgs, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          },
        });

        initialized = true;

        let totalBytes = 0;
        let outputBuffer = '';
        let autoAcceptTimer = null;

        ptyProcess.onData((data) => {
          totalBytes += data.length;
          if (totalBytes % 1000 < data.length) {
            console.log(`[${sessionId}] Received ${totalBytes} bytes from terminal`);
          }
          send(ws, { type: 'output', payload: { data } });

          // 检测 Claude 权限提示并自动确认
          outputBuffer += data;
          // 只保留最近的 4000 字符用于检测
          if (outputBuffer.length > 4000) {
            outputBuffer = outputBuffer.slice(-4000);
          }

          // 清理所有 ANSI 转义序列后再匹配
          const plainText = outputBuffer
            .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')
            .replace(/\x1B\][^\x07]*\x07/g, '')
            .replace(/\x1B[^[\]].?/g, '')
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

          // 检测选择提示：出现 "1. Yes" 或 "> 1. Yes" 就说明有权限提示
          const hasPermissionPrompt = /[>]?\s*1\.\s*Yes/.test(plainText)
            && /[23]\.\s*(No|Yes)/.test(plainText);

          if (hasPermissionPrompt) {
            // 用 debounce 避免重复触发
            if (autoAcceptTimer) clearTimeout(autoAcceptTimer);
            autoAcceptTimer = setTimeout(() => {
              if (ptyProcess) {
                console.log(`[${sessionId}] Auto-accepting permission prompt`);
                ptyProcess.write('1');
                outputBuffer = '';
              }
              autoAcceptTimer = null;
            }, 500);
          }
        });

        ptyProcess.onExit(({ exitCode, signal }) => {
          console.log(`[${sessionId}] Terminal exited:`, { exitCode, signal });
          send(ws, { type: 'exit', payload: { exitCode, signal } });
          ws.close();
        });

        console.log(`[${sessionId}] Terminal initialized successfully`);
        send(ws, {
          type: 'status',
          payload: {
            sessionId,
            message: 'Terminal initialized',
            cwd,
            shell,
          },
        });

        if (payload.initialCommand) {
          console.log(`[${sessionId}] Executing initial command:`, payload.initialCommand);
          ptyProcess.write(`${payload.initialCommand}\r`);
        }

        return;
      }

      if (!ptyProcess) {
        send(ws, { type: 'error', payload: { message: 'Terminal not initialized' } });
        return;
      }

      if (type === 'input') {
        console.log(`[${sessionId}] Received input:`, payload.data?.substring(0, 50));
        ptyProcess.write(payload.data || '');
        return;
      }

      if (type === 'resize') {
        const cols = Number(payload.cols);
        const rows = Number(payload.rows);
        if (cols > 0 && rows > 0) {
          ptyProcess.resize(cols, rows);
        }
        return;
      }

      if (type === 'terminate') {
        ptyProcess.kill();
        ptyProcess = null;
        send(ws, { type: 'status', payload: { sessionId, message: 'Terminal terminated' } });
      }
    } catch (error) {
      send(ws, {
        type: 'error',
        payload: { message: error instanceof Error ? error.message : 'Unknown terminal error' },
      });
    }
  });

  ws.on('close', () => {
    console.log(`[${sessionId}] Client disconnected`);
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
});
