import { access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export async function startDisplay(processes, env) {
  const display = processes.start('Xvfb', [env.DISPLAY, '-screen', '0', '1440x1000x24', '-nolisten', 'tcp'], env);
  const deadline = Date.now() + 10_000;
  while (true) {
    processes.controller.signal.throwIfAborted();
    if (display.ended || Date.now() >= deadline) throw new Error('Container browser display failed to start');
    try {
      await access('/tmp/.X11-unix/X99');
      break;
    } catch {
      await delay(100, undefined, { signal: processes.controller.signal });
    }
  }
  const vnc = processes.start('x11vnc', [
    '-display', env.DISPLAY, '-listen', '127.0.0.1', '-rfbport', '5900',
    '-nopw', '-forever', '-shared', '-quiet',
  ], env);
  const desktop = processes.start('websockify', ['--web=/usr/share/novnc', '6080', '127.0.0.1:5900'], env);
  return [display, vnc, desktop];
}