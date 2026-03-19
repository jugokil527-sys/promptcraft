/**
 * Vercel serverless entry point.
 * Exports the Express app as a handler — Vercel calls it per-request.
 * Do NOT call app.listen() here.
 */
import 'dotenv/config';
import { createApp } from './app.js';

export default createApp();
