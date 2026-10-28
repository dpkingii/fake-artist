import { startServer } from './app.js';

const { port } = await startServer(Number(process.env.PORT) || 3000);
console.log(`Fake Artist on http://localhost:${port}`);
