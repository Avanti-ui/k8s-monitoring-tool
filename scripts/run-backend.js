#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const isWin = process.platform === 'win32';

function findExecutable() {
  const venvNames = ['.venv', 'venv'];
  const searchBases = [];

  // Check active VIRTUAL_ENV first if present
  if (process.env.VIRTUAL_ENV) {
    searchBases.push(process.env.VIRTUAL_ENV);
  }

  // Check backend folder and root folder
  searchBases.push(backendDir, rootDir);

  const candidates = [];

  for (const base of searchBases) {
    // Check if the directory itself is the virtualenv root
    if (isWin) {
      candidates.push(
        { cmd: path.join(base, 'Scripts', 'python.exe'), args: ['-m', 'uvicorn'] },
        { cmd: path.join(base, 'Scripts', 'uvicorn.exe'), args: [] }
      );
    } else {
      candidates.push(
        { cmd: path.join(base, 'bin', 'python3'), args: ['-m', 'uvicorn'] },
        { cmd: path.join(base, 'bin', 'python'), args: ['-m', 'uvicorn'] },
        { cmd: path.join(base, 'bin', 'uvicorn'), args: [] }
      );
    }

    // Check if base contains a .venv or venv subdirectory
    for (const venv of venvNames) {
      const venvPath = path.join(base, venv);
      if (isWin) {
        candidates.push(
          { cmd: path.join(venvPath, 'Scripts', 'python.exe'), args: ['-m', 'uvicorn'] },
          { cmd: path.join(venvPath, 'Scripts', 'uvicorn.exe'), args: [] }
        );
      } else {
        candidates.push(
          { cmd: path.join(venvPath, 'bin', 'python3'), args: ['-m', 'uvicorn'] },
          { cmd: path.join(venvPath, 'bin', 'python'), args: ['-m', 'uvicorn'] },
          { cmd: path.join(venvPath, 'bin', 'uvicorn'), args: [] }
        );
      }
    }
  }

  // Pick first candidate that exists on disk
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate.cmd)) {
        return candidate;
      }
    } catch {
      // Continue search
    }
  }

  // Fallback to system Python / Uvicorn in PATH
  if (isWin) {
    return { cmd: 'python', args: ['-m', 'uvicorn'], isFallback: true };
  } else {
    return { cmd: 'python3', args: ['-m', 'uvicorn'], isFallback: true };
  }
}

function run() {
  const runner = findExecutable();
  const userArgs = process.argv.slice(2);

  const uvicornArgs = [
    'app.main:app',
    '--host',
    '0.0.0.0',
    '--port',
    '4000',
    ...userArgs
  ];

  const fullArgs = [...runner.args, ...uvicornArgs];

  console.log(`[Backend Runner] Starting backend using: ${runner.cmd} ${fullArgs.join(' ')}`);
  console.log(`[Backend Runner] Working Directory: ${backendDir}`);

  const child = spawn(runner.cmd, fullArgs, {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
    shell: isWin && runner.isFallback ? true : false,
  });

  child.on('error', (err) => {
    console.error(`\n[Backend Runner] Error starting FastAPI backend: ${err.message}`);
    console.error('\nPlease verify your Python virtual environment and dependencies:');
    if (isWin) {
      console.error('  Windows:');
      console.error('    cd backend');
      console.error('    python -m venv .venv');
      console.error('    .venv\\Scripts\\pip install -r requirements.txt\n');
    } else {
      console.error('  macOS / Linux:');
      console.error('    cd backend');
      console.error('    python3 -m venv .venv');
      console.error('    source .venv/bin/activate');
      console.error('    pip install -r requirements.txt\n');
    }
    process.exit(1);
  });

  // Handle process termination cleanly
  const forwardSignal = (signal) => {
    if (child && !child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

run();
