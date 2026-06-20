import multer from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../../../uploads');

function makeStorage(subdir) {
  const dir = resolve(root, subdir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const safe = Date.now() + '-' + Math.round(Math.random() * 1e6) + extname(file.originalname);
      cb(null, safe);
    },
  });
}

const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
function fileFilter(_req, file, cb) {
  const ext = extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Недопустимый тип файла. Разрешены: ' + allowed.join(', ')));
}

export const uploadOrderDoc = multer({
  storage: makeStorage('orders'),
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const uploadCatalog = multer({
  storage: makeStorage('catalog'),
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});
