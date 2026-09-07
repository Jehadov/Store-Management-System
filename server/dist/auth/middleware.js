import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-prod';
export function signToken(user) {
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}
export function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token)
        return res.status(401).json({ error: 'missing token' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    }
    catch {
        return res.status(401).json({ error: 'invalid token' });
    }
}
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'unauthorized' });
        if (!roles.includes(req.user.role))
            return res.status(403).json({ error: 'forbidden' });
        next();
    };
}
