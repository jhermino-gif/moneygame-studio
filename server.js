require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pipeline } = require('stream/promises');

const app = express();
const execFileAsync = promisify(execFile);
const OUT = path.join(__dirname, 'outputs');
fs.mkdirSync(OUT, { recursive: true });
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/outputs', express.static(OUT));
const jobs = new Map();

function apiHeaders() {
  if (!process.env.PIXVERSE_API_KEY) throw new Error('Falta la clave PIXVERSE_API_KEY en el archivo .env.');
  return { 'API-KEY': process.env.PIXVERSE_API_KEY, 'Ai-trace-id': randomUUID(), 'Content-Type': 'application/json' };
}
async function pixverse(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ErrCode !== 0) throw new Error(body.ErrMsg || `PixVerse respondió HTTP ${response.status}`);
  return body.Resp;
}
async function createClip(prompt) {
  const result = await pixverse('https://app-api.pixverse.ai/openapi/v2/video/text/generate', {
    method: 'POST', body: JSON.stringify({
      aspect_ratio: '9:16', duration: 15, model: 'c1', quality: '540p', prompt, seed: 0
    })
  });
  if (!result || !result.video_id) throw new Error('PixVerse no devolvió el identificador del video.');
  return result.video_id;
}
async function getClipStatus(id) {
  return await pixverse(`https://app-api.pixverse.ai/openapi/v2/video/result/${encodeURIComponent(id)}`, { method: 'GET' });
}
async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error('No se pudo descargar un clip terminado.');
  await pipeline(response.body, fs.createWriteStream(dest));
}
async function combineVideos(urls) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'moneygame-'));
  const a = path.join(temp, 'clip1.mp4');
  const b = path.join(temp, 'clip2.mp4');
  const list = path.join(temp, 'list.txt');
  const fileName = `moneygame-${Date.now()}.mp4`;
  const output = path.join(OUT, fileName);
  try {
    await download(urls[0], a); await download(urls[1], b);
    const quote = p => p.replace(/'/g, "'\\''");
    fs.writeFileSync(list, `file '${quote(a)}'\nfile '${quote(b)}'\n`);
    // Requires FFmpeg installed on the hosting server.
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', output]);
    return `/outputs/${fileName}`;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

app.post('/api/generate', async (req, res) => {
  const idea = String(req.body?.prompt || '').trim();
  if (!idea) return res.status(400).json({ error: 'Escribe una idea para el video.' });
  if (idea.length > 1800) return res.status(400).json({ error: 'El texto es demasiado largo; resume la idea.' });
  if (!process.env.PIXVERSE_API_KEY) return res.status(503).json({ error: 'La app todavía no está conectada: falta configurar la clave API de PixVerse en el servidor.' });
  const id = randomUUID();
  jobs.set(id, { id, state: 'starting', message: 'Iniciando generación en PixVerse…', createdAt: Date.now(), videoUrl: null, error: null, ids: [] });
  res.json({ jobId: id, message: 'Solicitud recibida. Se generarán dos clips de 15 segundos.' });
  const job = jobs.get(id);
  try {
    job.state = 'generating';
    job.message = 'Generando dos clips verticales de 15 segundos. Esto puede tardar varios minutos.';
    const p1 = `${idea}. Vertical 9:16, first 15-second scene, strong opening hook, cinematic motion, clear visual storytelling.`;
    const p2 = `${idea}. Vertical 9:16, second 15-second scene, visually follows the same idea and ends with a satisfying conclusion. Keep visual style consistent.`;
    job.ids = await Promise.all([createClip(p1), createClip(p2)]);
  } catch (e) {
    job.state = 'error'; job.error = e.message; job.message = e.message;
  }
});

app.get('/api/status/:id', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'No encontré este trabajo. Puede que el servidor se haya reiniciado.' });
  if (job.state === 'generating' && job.ids.length === 2 && !job.checking) {
    job.checking = true;
    try {
      const clips = await Promise.all(job.ids.map(getClipStatus));
      const failed = clips.find(c => [7, 8].includes(Number(c.status)));
      if (failed) { job.state = 'error'; job.error = 'PixVerse no pudo generar uno de los clips. Prueba con otra descripción.'; job.message = job.error; }
      else if (clips.every(c => Number(c.status) === 1 && c.url)) {
        job.state = 'joining'; job.message = 'Clips listos. Uniendo los videos…';
        try { job.videoUrl = await combineVideos(clips.map(c => c.url)); job.state = 'done'; job.message = '¡Tu video está listo!'; }
        catch (e) { job.state = 'error'; job.error = `Los clips se generaron, pero no se pudieron unir. El servidor necesita FFmpeg. Detalle: ${e.message}`; job.message = job.error; }
      } else { job.message = 'PixVerse está generando los clips. La app revisará de nuevo en unos segundos.'; }
    } catch (e) { job.message = `Esperando respuesta de PixVerse: ${e.message}`; }
    finally { job.checking = false; }
  }
  res.json({ state: job.state, message: job.message, videoUrl: job.videoUrl, error: job.error });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`MONEY GAME Video Maker disponible en el puerto ${port}`));
