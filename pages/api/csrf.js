import { randomBytes } from 'crypto';

export default function handler(req, res) {
  const token = randomBytes(32).toString('hex');
  res.setHeader('Set-Cookie', `csrf-token=${token}; Path=/; SameSite=Lax`);
  res.status(200).json({ csrfToken: token });
}
