const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { testarConexao } = require('./config/db');
const { UPLOADS_DIR, garantirPastas } = require('./config/paths');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';
const EM_PRODUCAO = process.env.NODE_ENV === 'production';
const VERBOSO = !EM_PRODUCAO || process.env.LOG_VERBOSE === 'true';

/* Atrás do proxy do Railway (HTTPS terminado à frente). */
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ---------- CORS por variável de ambiente ----------
   CORS_ORIGINS = lista separada por vírgulas.
   Ex.: http://localhost:5173,https://freelamz.com
   As origens do Capacitor/APK são sempre aceites. */
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
    if (VERBOSO) console.warn('[CORS] Origem não permitida:', origin);
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* Ficheiros públicos (avatares, capas, portfólio, imagens de serviços). */
garantirPastas();
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: EM_PRODUCAO ? '7d' : 0 }));

/* Página raiz da API */
app.get('/', (req, res) => {
  res.json({ success: true, name: 'FreelaMZ API', status: 'ok' });
});

/* Health check (usado pelo Railway e pelos testes) */
app.get('/api/health', (req, res) => {
  res.json({ success: true, name: 'FreelaMZ API', status: 'ok' });
});

/* Rotas da API */
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/proposals', require('./routes/proposalRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/favorites', require('./routes/favoriteRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

/* 404 */
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

/* Erros centralizados */
app.use((err, req, res, next) => {
  console.error('[ERRO]', err.stack || err.message);
  const ehMulter = err && typeof err.code === 'string' && err.code.startsWith('LIMIT_');
  const status = err.status || (ehMulter ? 400 : 500);
  const msg = ehMulter && err.code === 'LIMIT_FILE_SIZE'
    ? 'Imagem demasiado grande'
    : (err.message || 'Erro interno do servidor');
  res.status(status).json({
    success: false,
    message: msg,
    ...(!EM_PRODUCAO && { stack: err.stack }),
  });
});

/* ---------- Arranque ---------- */
async function iniciar() {
  try {
    await testarConexao();
  } catch (e) {
    console.error('[API] Arranque cancelado: base de dados indisponível.');
    process.exit(1);
  }

  const servidor = app.listen(PORT, HOST, () => {
    if (VERBOSO) {
      console.log(`[API] FreelaMZ a ouvir em http://${HOST}:${PORT}`);
      console.log(`[API] Uploads públicos: ${UPLOADS_DIR}`);
      console.log(`[API] Origens CORS: ${origensPermitidas.join(', ')}`);
    } else {
      console.log(`[API] FreelaMZ pronta na porta ${PORT}`);
    }
  });

  /* FASE A: lembretes de cliente silente (só NOTIFICAM — o escrow
     nunca é liberado automaticamente). A cada 6h, falhas silenciosas. */
  const { lembretesAutoRelease } = require('./services/finance');
  const avisoLembretes = setInterval(async () => {
    try { await lembretesAutoRelease(); } catch (e) { /* silencioso */ }
  }, 6 * 60 * 60 * 1000);
  avisoLembretes.unref();
  lembretesAutoRelease().catch(() => { /* silencioso no arranque */ });

  /* Encerramento limpo (Railway envia SIGTERM nos deploys). */
  const fechar = () => {
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', fechar);
  process.on('SIGINT', fechar);
}

iniciar();
