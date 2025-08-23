import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseServerClient } from '../../lib/supabaseServer';
import logger from '../../lib/logger.server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const form = formidable({ maxFiles: 1, keepExtensions: true });

  let files;
  try {
    ({ files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    }));
  } catch (err) {
    logger.error({ err }, 'Failed to parse upload form');
    return res.status(400).json({ error: 'Invalid form data' });
  }

  const file = files.file;
  if (!file) {
    return res.status(400).json({ error: 'File is required' });
  }

  try {
    const supabase = getSupabaseServerClient(req, res, { admin: true });
    const fileBuffer = await fs.readFile(file.filepath);
    const ext = path.extname(file.originalFilename || '');
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('visitas')
      .upload(fileName, fileBuffer, { contentType: file.mimetype });
    if (uploadError) {
      logger.error({ err: uploadError }, 'Error uploading file to Supabase');
      return res.status(500).json({ error: 'Upload failed' });
    }
    const { data: { publicUrl } } = supabase.storage
      .from('visitas')
      .getPublicUrl(fileName);
    return res.status(200).json({ url: publicUrl });
  } catch (err) {
    logger.error({ err }, 'Unexpected error uploading file');
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
