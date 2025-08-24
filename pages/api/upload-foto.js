const formidable = require('formidable');
const { promises: fs } = require('fs');
const path = require('path');
const { withLogging } = require('../../lib/api-logger');
const { getSupabaseServerClient } = require('../../lib/supabaseServer');

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

  const supabase = getSupabaseServerClient(req, res, { admin: true });
  const fileBuffer = await fs.readFile(file.filepath);
  const ext = path.extname(file.originalFilename || '');
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('visitas')
    .upload(fileName, fileBuffer, { contentType: file.mimetype });

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
