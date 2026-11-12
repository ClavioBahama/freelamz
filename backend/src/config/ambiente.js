/* ============================================================
   FreelaMZ — Deteção do ambiente

   Consideramos "produção" quando:
     - NODE_ENV=production (ou prod), OU
     - o processo corre no Railway (RAILWAY_ENVIRONMENT/PROJECT_ID
       são injetados automaticamente pelo Railway).

   Em produção NÃO usamos valores por omissão para a base de dados
   (nada de 127.0.0.1 / root / freelamz).
   ============================================================ */

function emProducao() {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') return true;
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT
    || process.env.RAILWAY_PROJECT_ID
    || process.env.RAILWAY_SERVICE_ID
  );
}

module.exports = { emProducao };
