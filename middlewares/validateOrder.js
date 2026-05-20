// middlewares/validateOrder.js

const { Order } = require('../models');

// middleware для валидации создания заказа
function validateOrderInput(req, res, next) {
  const { description, categoryId, deadline } = req.body;

  // Проверка обязательных полей
  if (!description || !categoryId) {
    return res.status(400).json({ error: 'Необходимо указать описание и категорию' });
  }

  // Проверка description (строка, не пустая)
  if (typeof description !== 'string' || description.trim() === '') {
    return res.status(400).json({ error: 'Описание должно быть непустой строкой' });
  }

  // Проверка deadline (если передан)
  if (deadline !== undefined && deadline !== null) {
    const date = new Date(deadline);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'срок должен быть валидной датой (ISO 8601)' });
    }
    // дата не в прошлом
    if (date < new Date()) {
      return res.status(400).json({ error: 'срок не может быть в прошлом' });
    }
    req.parsedDeadline = date; // сохраняем для использования в обработчике
  }

  next();
}


const findOrderAndCheck = (expectedStatus, ownerField) => async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }
    if (order.status !== expectedStatus) {
      return res.status(400).json({ error: `Заказ должен иметь статус "${expectedStatus}"` });
    }
    // Проверка владельца, если поле указано
    if (ownerField && order[ownerField] !== req.session.userId) {
      return res.status(403).json({ error: 'Нет доступа к этому заказу' });
    }
    req.order = order;
    next();
  } catch (error) {
    console.error('Ошибка в findOrderAndCheck:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
};

const validateReviewInput = (req, res, next) => {
  const { score, review } = req.body;

  // Проверка наличия обязательного поля score
  if (score === undefined || score === null) {
    return res.status(400).json({ error: 'Необходимо указать оценку (score)' });
  }

  // Проверка типа и диапазона score
  if (typeof score !== 'number' || isNaN(score)) {
    return res.status(400).json({ error: 'Оценка должна быть числом' });
  }
  if (score < 1 || score > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
  }

  // Проверка отзыва
  if (review !== undefined && typeof review !== 'string') {
    return res.status(400).json({ error: 'Отзыв должен быть строкой' });
  }

  // Преобразуем review в null, если он отсутствует или пустая строка
  let processedReview = null;
  if (review && typeof review === 'string' && review.trim() !== '') {
    processedReview = review.trim();
  }
  req.review = processedReview;

  next();
};

module.exports = {
  validateOrderInput,
  findOrderAndCheck,
  validateReviewInput
};