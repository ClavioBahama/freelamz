const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticação JWT.
 * Verifica o token no header Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de acesso não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'freelamz_secret_dev_2024_mudar_em_producao', (err, user) => {
    if (err) {
      // 401 = autenticação falhou (token inválido/expirado); 403 fica para permissões (allowRoles)
      return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware de autorização por tipo de usuário.
 * @param {...string} allowedTypes - tipos permitidos (CLIENTE, FREELANCER, ADMIN)
 */
function allowRoles(...allowedTypes) {
  return (req, res, next) => {
    if (!req.user || !allowedTypes.includes(req.user.tipo_usuario)) {
      return res.status(403).json({ success: false, message: 'Acesso negado: permissão insuficiente' });
    }
    next();
  };
}

module.exports = { authenticateToken, allowRoles };
