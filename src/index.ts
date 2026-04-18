import express from 'express';
import { config } from './config/config';
import { jobsRouter } from './routes/jobs.router';

// Boot the worker in the same process for simplicity.
// In production, run this as a separate process: npm run worker
import './workers/enrichment.worker';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/jobs', jobsRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(config.port, () => {
  console.log(JSON.stringify({
    level: 'info',
    message: 'Server started',
    port: config.port,
    timestamp: new Date().toISOString(),
  }));
});
