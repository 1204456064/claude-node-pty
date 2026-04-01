import pty from 'node-pty';
import { stdin, stdout } from 'process';

// 配置 stdin 为原始模式
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');

// 创建伪终端
const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const shellArgs = process.platform === 'win32'
  ? ['-NoLogo', '-ExecutionPolicy', 'Bypass']
  : [];

const ptyProcess = pty.spawn(shell, shellArgs, {
  name: 'xterm-256color',
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows || 30,
  cwd: process.cwd(),
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor'
  },
  encoding: 'utf8'
});

// 将伪终端输出连接到控制台
ptyProcess.onData((data) => {
  stdout.write(data);
});

// 将控制台输入连接到伪终端
stdin.on('data', (data) => {
  ptyProcess.write(data);
});

// 处理窗口大小变化
stdout.on('resize', () => {
  ptyProcess.resize(stdout.columns, stdout.rows);
});

// 处理退出
ptyProcess.onExit(({ exitCode, signal }) => {
  console.log(`\nTerminal exited with code: ${exitCode}, signal: ${signal}`);
  process.exit(exitCode);
});

process.on('exit', () => {
  ptyProcess.kill();
});

// 等待终端准备好后自动输入 claude 命令
setTimeout(() => {
  ptyProcess.write('claude\r');
}, 1000);

console.log('Terminal started. Auto-executing "claude" command...\n');
