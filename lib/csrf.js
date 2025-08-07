export function verifyCsrf(req, res) {
  const token = req.headers['x-csrf-token'];
  const cookie = req.cookies?.['csrf-token'];
  if (!token || !cookie || token !== cookie) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return false;
  }
  return true;
}
