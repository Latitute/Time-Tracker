import jwt from 'jsonwebtoken'

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return process.env.JWT_SECRET
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token is required' })
  }

  try {
    const token = header.split(' ')[1]
    req.user = jwt.verify(token, getJwtSecret())
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
