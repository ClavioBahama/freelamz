const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { emProducao } = require('./config/ambiente');
const { validarConfigBanco, resumoConfig } = require('./config/dbConfig');
const {
  testarConexao, verificarBanco, estadoBanco, configBanco,
} = require('./config/db');
const { UPLOADS_DIR, garantirPastas } = require('./config/paths');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';
const EM_PRODUCAO = emProducao();
const VERBOSO = !EM_PRODUCAO || process.env.LOG_VERBOSE === 'true';

/* Atrás do proxy do Railway (HTTPS terminado à frente). */
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ============================================================
   Validação do ambiente ANTES de arrancar.
   Lista apenas os NOMES das variáveis em falta (nunca valores).
   ============================================================ */
function validarArranque() {
  const { problemas, avisos } = validarConfigBanco();
  const faltando = [...problemas];

  if (EM_PRODUCAO && !process.env.JWT_SECRET) {
    faltando.push('JWT_SECRET');
  }

  for (const aviso of avisos) console.warn('[CONFIG] AVISO:', aviso);

  if (faltando.length) {
    console.error('[CONFIG] ERRO: faltam variáveis de ambiente obrigatórias:');
    for (const nome of faltando) console.error('  -', nome);
    console.error('[CONFIG] Defina-as no Railway > serviço > Variables (nunca no código).');
    console.error('[CONFIG] Atalho: MYSQL_URL=${{MySQL.MYSQL_URL}} cobre toda a ligação à BD.');
    console.error('[CONFIG] Arranque cancelado.');
    process.exit(1);
  }
}

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

/* Ficheiros públicos (avatares, capas, portfólio, imagens de serviços).
   Se a pasta não puder ser criada, avisamos mas NÃO derrubamos o servidor. */
try {
  garantirPastas();
} catch (e) {
  console.warn('[API] AVISO: não foi possível preparar as pastas de uploads:', e.message);
  console.warn('[API] Definir UPLOADS_DIR para uma pasta com permissões de escrita.');
}
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: EM_PRODUCAO ? '7d' : 0 }));

/* Página raiz da API */
app.get('/', (req, res) => {
  res.json({ success: true, name: 'FreelaMZ API', status: 'ok' });
});

/* Health check do Railway: responde SEMPRE 200, mesmo sem BD.
   Assim o serviço não é morto e o motivo fica visível em /api/health/db. */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    name: 'FreelaMZ API',
    status: 'ok',
    db: estadoBanco.online ? 'up' : 'down',
  });
});

/* Health da base de dados: testa a ligação agora. */
app.get('/api/health/db', async (req, res) => {
  const r = await verificarBanco();
  if (r.ok) {
    return res.json({
      success: true,
      db: 'up',
      host: configBanco.host || '(não definido)',
      database: configBanco.database || '(não definida)',
    });
  }
  return res.status(503).json({
    success: false,
    db: 'down',
    erro: r.code || 'ERRO',
    mensagem: r.message || 'Sem ligação à base de dados',
    config: resumoConfig(configBanco),
  });
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
let lembretesIniciados = false;

function iniciarLembretes() {
  if (lembretesIniciados) return;
  lembretesIniciados = true;

  /* FASE A: lembretes de cliente silente (só NOTIFICAM — o escrow
     nunca é liberado automaticamente). A cada 6h, falhas silenciosas. */
  const { lembretesAutoRelease } = require('./services/finance');
  const avisoLembretes = setInterval(() => {
    lembretesAutoRelease().catch(() => { /* silencioso */ });
  }, 6 * 60 * 60 * 1000);
  avisoLembretes.unref();
  lembretesAutoRelease().catch(() => { /* silencioso no arranque */ });
}

/* ---------- Dados de demonstração opcionais ----------
   Com SEED_DEMO=true no Railway, o próprio servidor cria os
   freelancers/serviços de exemplo usando a MYSQL_URL interna.
   Assim não é preciso copiar a URL pública nem a senha. */
let demoSeedFeito = false;

function semearDemoSePedido() {
  if (demoSeedFeito) return;
  if (String(process.env.SEED_DEMO || '').toLowerCase() !== 'true') return;
  demoSeedFeito = true;
  const { main: semearDemo } = require('../scripts/demo-seed');
  console.log('[DEMO] SEED_DEMO=true — a criar dados de demonstração…');
  semearDemo()
    .then(() => {
      console.log('[DEMO] Dados de demonstração prontos.');
      console.log('[DEMO] Pode remover a variável SEED_DEMO (ou definir false).');
    })
    .catch((err) => {
      console.error('[DEMO] Falhou:', err.code || '', err.message);
      console.error('[DEMO] Será tentado de novo quando a base de dados responder.');
      demoSeedFeito = false;
    });
}

async function iniciar() {
  validarArranque();

  const servidor = app.listen(PORT, HOST, () => {
    if (VERBOSO) {
      console.log(`[API] FreelaMZ a ouvir em http://${HOST}:${PORT}`);
      console.log(`[API] Uploads públicos: ${UPLOADS_DIR}`);
      console.log(`[API] Origens CORS: ${origensPermitidas.join(', ')}`);
    } else {
      console.log(`[API] FreelaMZ pronta na porta ${PORT} (ambiente: produção)`);
    }
  });

  servidor.on('error', (err) => {
    console.error('[API] ERRO ao abrir a porta', PORT, '—', err.code || '', err.message);
    process.exit(1);
  });

  /* Liga à BD DEPOIS de o servidor estar a ouvir:
     /api/health responde sempre, mesmo que a BD esteja em baixo. */
  const resultado = await testarConexao({ tentativas: 5 });

  if (resultado.ok) {
    iniciarLembretes();
    semearDemoSePedido();
  } else {
    console.error('[API] A API continua online, mas SEM base de dados.');
    console.error('[API] Diagnóstico: GET /api/health/db');
    console.error('[API] Corrija as variáveis no Railway e faça Redeploy.');
  }

  /* Revalida a cada 60s: se a BD voltar, os lembretes arrancam sozinhos. */
  const revalidar = setInterval(async () => {
    const r = await verificarBanco();
    if (r.ok && !lembretesIniciados) {
      console.log('[DB] Ligação restabelecida.');
      iniciarLembretes();
    }
    if (r.ok) semearDemoSePedido();
  }, 60 * 1000);
  revalidar.unref();

  /* Encerramento limpo (Railway envia SIGTERM nos deploys). */
  const fechar = () => {
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', fechar);
  process.on('SIGINT', fechar);
}

iniciar();
