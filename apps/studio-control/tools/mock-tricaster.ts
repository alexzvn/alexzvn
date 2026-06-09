import { createServer } from 'node:http';

const PORT = Number(process.env['PORT'] ?? 5951);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (url.pathname === '/v1/version') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('mock TC2 2.7.1');
    return;
  }
  if (url.pathname === '/v1/shortcut') {
    const name = url.searchParams.get('name');
    const params = Object.fromEntries(url.searchParams.entries());
    console.log(`[mock-tricaster] shortcut name=${name} params=${JSON.stringify(params)}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[mock-tricaster] listening on :${PORT}`);
});
