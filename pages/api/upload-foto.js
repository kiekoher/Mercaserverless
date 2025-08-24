const formidable = require('formidable');
const { promises: fs } = require('fs');
const path = require('path');
const { withLogging } = require('../../lib/api-logger');
const { getSupabaseServerClient } = require('../../lib/supabaseServer');
const { requireUser } = require('../../lib/auth');
const { checkRateLimit } = require('../../lib/rateLimiter');

export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { error: authError, user } = await requireUser(req, res, ['mercaderista']);
  if (authError) {
    return res.status(authError.status).json({ error: authError.message });
  }
  if (!(await checkRateLimit(req, { userId: user.id }))) {
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  const form = formidable({ maxFiles: 1, keepExtensions: true, maxFileSize: 5 * 1024 * 1024 });

  const { files } = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  }).catch(err => {
    // This will be caught by the HOF's try/catch block
    throw new Error(`Failed to parse upload form: ${err.message}`);
  });

  const file = files.file?.[0];
  if (!file) {
    return res.status(400).json({ error: 'File is required' });
  }
  if (!file.mimetype.startsWith('image/')) {
    await fs.unlink(file.filepath).catch(() => {});
    return res.status(400).json({ error: 'Invalid file type' });
  }

  // Only allow specific image extensions to prevent unexpected files
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalFilename || '').toLowerCase();
  if (!allowedExts.includes(ext)) {
    await fs.unlink(file.filepath).catch(() => {});
    return res.status(400).json({ error: 'Invalid file extension' });
  }

  const supabase = getSupabaseServerClient(req, res);
  const fileBuffer = await fs.readFile(file.filepath);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('visitas')
    .upload(fileName, fileBuffer, { contentType: file.mimetype });

  await fs.unlink(file.filepath).catch(() => {});

  if (uploadError) {
    // Let the HOF log the error
    throw uploadError;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('visitas')
    .getPublicUrl(fileName);

  return res.status(200).json({ url: publicUrl });
}

module.exports = withLogging(handler);;
