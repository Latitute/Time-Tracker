const jwt = require('jsonwebtoken')

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return process.env.JWT_SECRET
}

function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization
  const [scheme, token] = authorization ? authorization.split(' ') : []

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authorization token is required' })
  }

  try {
    req.user = jwt.verify(token, getJwtSecret())
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

module.exports = authMiddleware