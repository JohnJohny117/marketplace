const { Session, User } = require('../models');

function validateSession(...allowedRoles) {
  const requireRoleCheck = allowedRoles.length > 0;

  return async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      let session;

      // Пытаемся найти сессию, обрабатывая возможную ошибку формата UUID
      try {
        session = await Session.findByPk(sessionId);
      } catch (dbError) {
        // Если ошибка связана с неверным форматом UUID, считаем, что сессия не найдена
        if (dbError.message && dbError.message.includes('invalid input syntax for type uuid')) {
          return res.status(401).json({ error: 'Сессия не найдена или неактивна' });
        }
        throw dbError; // иначе пробрасываем дальше
      }

      // Проверка существования и активности сессии
      if (!session || !session.active) {
        return res.status(401).json({ error: 'Сессия не найдена или неактивна' });
      }

      req.session = session;

      if (requireRoleCheck) {
        const user = await User.findByPk(session.userId);
        if (!user) {
          return res.status(401).json({ error: 'Пользователь не найден' });
        }
        // Используем allowedRoles
        if (!allowedRoles.includes(user.role)) {
          return res.status(403).json({ error: 'Недостаточно прав для выполнения действия' });
        }
        req.user = user;
      }

      next();
    } catch (error) {
      console.error('Ошибка при проверке сессии:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  };
}

module.exports = { validateSession };