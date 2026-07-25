// ===== DISABLE CACHING MIDDLEWARE =====
export const noCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
};

// ===== SHORT CACHE (5 seconds) =====
export const shortCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'private, max-age=5'
  });
  next();
};

// ===== MEDIUM CACHE (1 minute) =====
export const mediumCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'private, max-age=60'
  });
  next();
};

// ===== LONG CACHE (5 minutes) =====
export const longCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'public, max-age=300'
  });
  next();
};