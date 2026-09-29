export function useColor(environment = process.env, isTTY = process.stdout.isTTY) {
  if (environment.NO_COLOR !== undefined) return false;
  if (environment.FORCE_COLOR !== undefined) return environment.FORCE_COLOR !== '0';
  if (environment.LOCAL_OUTPUT_COLOR !== undefined) return environment.LOCAL_OUTPUT_COLOR === '1';
  return Boolean(isTTY && environment.TERM !== 'dumb');
}

function style(text, code, color) {
  return color ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export function containerLogLine(service, line, color = useColor()) {
  return `${style(`[container ${service} | internal]`, '2', color)} ${line}\n`;
}

export function readyMessage({ environment, container, testing, webURL, apiURL, publicWebURL, publicApiURL }, color = useColor()) {
  const hostAccessible = !container || Boolean(publicWebURL && publicApiURL);
  const heading = `${testing ? 'TEST SERVERS READY' : 'APP READY'} | ${environment} | ${container ? 'Docker' : 'Native'}`;
  const lines = ['', style(heading, '1;32', color), ''];
  if (hostAccessible) {
    lines.push('Open on your computer:',
      style(`  App: ${container ? publicWebURL : webURL}`, '1;36', color),
      style(`  API docs: ${container ? publicApiURL : apiURL}/docs`, '36', color));
    if (container) lines.push('', 'Container addresses in the logs are internal. Use the host URLs above.');
  } else {
    lines.push('Container-only addresses (not host URLs):',
      `  Web: ${webURL}`, `  API docs: ${apiURL}/docs`, '',
      testing ? 'The test runner connects inside Docker; web/API ports are not published.'
        : 'Use the host ports from your docker run -p mappings to open the app.');
  }
  return `${lines.join('\n')}\n`;
}