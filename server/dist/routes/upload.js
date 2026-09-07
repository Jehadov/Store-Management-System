import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
const uploadDir = process.env.UPLOAD_DIR || './uploads';
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
});
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE.includes(file.mimetype) || ALLOWED_VIDEO.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('images (jpeg/png/webp/gif) or videos (mp4/webm/mov) only'));
    },
});
export const uploadRouter = Router();
// Accept legacy `image` field + new `file`/`video` fields
const acceptAny = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'video', maxCount: 1 },
]);
// POST /api/upload (admin) form-data: file=<image|video> (legacy: image=<file>) -> { url, type, mimetype, size }
// Replaces pasting image URL strings in ManageCategory / ProductForm.
// Uploaded mp4/webm can be used directly as `url` in POST /videos.
uploadRouter.post('/', acceptAny, (req, res) => {
    const files = (req.files || {});
    const picked = files.file?.[0] || files.image?.[0] || files.video?.[0];
    if (!picked)
        return res.status(400).json({ error: 'no file (field: file | image | video)' });
    const url = `/uploads/${picked.filename}`;
    const type = picked.mimetype.startsWith('video/') ? 'video' : 'image';
    res.status(201).json({ url, type, mimetype: picked.mimetype, size: picked.size });
});
