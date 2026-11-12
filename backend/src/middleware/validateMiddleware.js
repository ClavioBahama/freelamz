const { validationResult } = require('express-validator');

/**
 * Middleware que valida os resultados do express-validator.
 * Retorna 400 com os erros caso haja falha de validação.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: errors.array().map((e) => ({ campo: e.param, mensagem: e.msg })),
    });
  }
  next();
}

module.exports = { validate };
