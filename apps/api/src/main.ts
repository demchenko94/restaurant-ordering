import express from 'express';

const host = process.env['HOST'] ?? 'localhost';
const port = process.env['PORT'] ? Number(process.env['PORT']) : 3333;

const app = express();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
