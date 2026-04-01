import express from 'express';
import pty from 'node-pty';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// 创建全局伪终端实例
const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const shellArgs = process.platform === 'win32'
  ? ['-NoLogo', '-ExecutionPolicy', 'Bypass']
  : [];

let terminalOutput = '';
const MAX_OUTPUT_LENGTH = 100000; // 限制输出缓存大小

const ptyProcess = pty.spawn(shell, shellArgs, {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: process.cwd(),
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor'
  },
  encoding: 'utf8'
});

// 收集终端输出
ptyProcess.onData((data) => {
  terminalOutput += data;
  // 限制输出缓存大小
  if (terminalOutput.length > MAX_OUTPUT_LENGTH) {
    terminalOutput = terminalOutput.slice(-MAX_OUTPUT_LENGTH);
  }
  console.log(data); // 同时在后端控制台显示
});

ptyProcess.onExit(({ exitCode }) => {
  console.log(`Terminal exited with code: ${exitCode}`);
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 执行命令接口
app.post('/api/execute', (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  try {
    // 清空之前的输出
    const outputBefore = terminalOutput.length;

    // 写入命令到终端
    ptyProcess.write(command + '\r');

    console.log(`Executed command: ${command}`);

    res.json({
      success: true,
      message: 'Command executed',
      command
    });
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

// 移除 ANSI 转义序列
function stripAnsi(str) {
  return str
    .replace(/\x1B\[[?!>]?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1B\][0-9];.*?(\x07|\x1B\\)/g, '')
    .replace(/\x1B[=>@-_]/g, '')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

// 获取终端输出接口
app.get('/api/output', (req, res) => {
  const { lines, raw } = req.query;
  const lineCount = parseInt(lines) || 50;

  const content = raw === '1' ? terminalOutput : stripAnsi(terminalOutput);
  const outputLines = content.split('\n');
  const recentOutput = outputLines.slice(-lineCount).join('\n');

  res.json({
    output: recentOutput,
    totalLength: terminalOutput.length
  });
});

// 清空输出缓存接口
app.post('/api/clear', (req, res) => {
  terminalOutput = '';
  res.json({ success: true, message: 'Output cleared' });
});

// 获取终端状态
app.get('/api/status', (req, res) => {
  res.json({
    running: true,
    outputLength: terminalOutput.length,
    shell,
    cwd: process.cwd()
  });
});

const server = app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
  console.log(`Terminal output will be displayed here in real-time.\n`);

  // 自动执行 claude 命令
  setTimeout(() => {
    console.log('Auto-executing "claude" command...');
    ptyProcess.write('claude\r');
  }, 1000);
});

process.on('exit', () => {
  ptyProcess.kill();
});

