import { createServer } from 'node:http';

// Minimal emulator of the Panasonic AW HTTP CGI control API, enough to smoke-
// test JM Studio Control's PTZ driver without a real camera. Logs every command
// and answers the power query like a real AW camera does.
const PORT = Number(process.env['PORT'] ?? 5961);

let powerOn = true;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const cgi = url.pathname.replace('/cgi-bin/', '');

  if (cgi === 'aw_ptz' || cgi === 'aw_cam') {
    const cmd = url.searchParams.get('cmd') ?? '';
    console.log(`[mock-ptz] ${cgi} cmd=${cmd}`);

    let body: string;
    if (cmd === '#O') {
      body = powerOn ? 'p1' : 'p0';
    } else if (/^#O[01]$/.test(cmd)) {
      powerOn = cmd.endsWith('1');
      body = powerOn ? 'p1' : 'p0';
    } else {
      // AW cameras echo the accepted command back without the leading '#'.
      body = cmd.replace(/^#/, '');
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(body);
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[mock-ptz] AW camera emulator listening on :${PORT}`);
});
