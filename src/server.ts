import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import githubRouter from './routes/github.js';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

// Resolve public/ relative to project root (one level up from src/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

app.use(express.static(publicDir));
app.use('/api/github', githubRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`gitpaid running at http://localhost:${PORT}`);
});
