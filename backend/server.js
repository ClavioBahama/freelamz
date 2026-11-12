const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais
// Origens permitidas: lista separada por vírgulas em CORS_ORIGINS.
// Inclui sempre as origens locais de desenvolvimento e do Capacitor (APK).
const origensPadrao = [
  'http://localhost:5173', 'http://localhost:4173',
  'http://localhost', 'https://localhost', 'capacitor://localhost',
];
const origensPermitidas = Array.from(new Set([
  ...origensPadrao,
  ...(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
]));

app.use(cors({
  origin(origin, callback) {
    // Sem Origin (apps nativos, curl, same-origin) → permitir.
    if (!origin) return callback(null, true);
    if (origensPermitidas.includes('*') || origensPermitidas.includes(origin)) {
      return callback(null, true);
    }
    console.warn('[CORS] Origem não permitida:', origin);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos enviados (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Página raiz da API
app.get('/', (req, res) => {
  res.json({ success: true, name: 'FreelaMZ API', status: 'ok' });
});

// Health check
app.get('/api/health', (req, res) => {
  const provider = require('./src/services/payments').getProvider();
  res.json({
    success: true, name: 'FreelaMZ API', status: 'ok',
    payment_provider: provider.name,
    modo_teste: provider.isTestMode,
  });
});

// Rotas da API
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/categories', require('./src/routes/categoryRoutes'));
app.use('/api/services', require('./src/routes/serviceRoutes'));
app.use('/api/proposals', require('./src/routes/proposalRoutes'));
app.use('/api/projects', require('./src/routes/projectRoutes'));
app.use('/api/messages', require('./src/routes/messageRoutes'));
app.use('/api/reviews', require('./src/routes/reviewRoutes'));
app.use('/api/favorites', require('./src/routes/favoriteRoutes'));
app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/upload', require('./src/routes/uploadRoutes'));
app.use('/api/payments', require('./src/routes/paymentRoutes'));

// Middleware de tratamento de erros (404)
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

// Middleware centralizado de erros
app.use((err, req, res, next) => {
  console.error('[ERRO]', err.stack || err.message);
  // erros do multer (ex.: ficheiro demasiado grande) → 400, não 500
  const ehMulter = err && typeof err.code === 'string' && err.code.startsWith('LIMIT_');
  const status = err.status || (ehMulter ? 400 : 500);
  const msg = ehMulter && err.code === 'LIMIT_FILE_SIZE'
    ? 'Imagem demasiado grande'
    : (err.message || 'Erro interno do servidor');
  res.status(status).json({
    success: false,
    message: msg,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`[API] FreelaMZ rodando em http://localhost:${PORT}`);

  /* FASE A: lembretes de cliente silente (só NOTIFICAM — o escrow nunca
     é liberado automaticamente). A cada 6h, com falhas silenciosas. */
  const { lembretesAutoRelease } = require('./src/services/finance');
  const avisoLembretes = setInterval(async () => {
    try { await lembretesAutoRelease(); } catch (e) { /* silencioso */ }
  }, 6 * 60 * 60 * 1000);
  avisoLembretes.unref(); // não impede o encerramento do processo
  lembretesAutoRelease().catch(() => { /* silencioso no arranque */ });
});
