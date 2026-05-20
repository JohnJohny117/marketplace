const express = require('express');
const { User, Session, Category, Order } = require('../models');
const { validateSession } = require('../middlewares/validateSession');

const router = express.Router();

// GET /register – страница регистрации
router.get('/register', (req, res) => {
  res.render('register', { title: 'Регистрация' });
});

// GET /dashboard/:sessionId – панель управления
router.get('/dashboard/:sessionId', validateSession(), async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) return res.redirect('/web/login');

    // В зависимости от роли отображаем разные страницы
    if (user.role === 'customer') {
      res.render('customer-dashboard', { sessionId: req.params.sessionId, title: 'Панель заказчика' });
    } else if (user.role === 'executor') {
      res.render('executor-dashboard', { sessionId: req.params.sessionId, title: 'Панель исполнителя' });
    } else if (user.role === 'admin') {
      // Рендерим шаблон, категории подгрузятся через API на клиенте
      res.render('admin-dashboard', { sessionId: req.params.sessionId, title: 'Панель администратора' 
      });
    } else {
      res.status(403).send('Доступ запрещён');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// GET /category/add-form/:sessionId – страница добавления категории
router.get('/category/add-form/:sessionId', validateSession('admin'), async (req, res) => {
  res.render('add-category', { sessionId: req.params.sessionId, title: 'Добавить категорию', error: null });
});

// GET /category/edit-form/:sessionId/:categoryId – страница редактирования категории
router.get('/category/edit-form/:sessionId/:categoryId', validateSession('admin'), async (req, res) => {
  try {
    // Извлекаем параметры из URL-адреса
    const { sessionId, categoryId } = req.params;

    // Пытаемся найти категорию по первичному ключу (id) в базе данных
    const category = await Category.findByPk(categoryId);

    // Если категория не существует или помечена как удалённая
    if (!category || category.deleted) {
      // Возвращаем HTTP-статус 404 Not Found с сообщением об ошибке
      return res.status(404).send('Категория не найдена или удалена');
    }

    // Рендерим шаблон 'edit-category.pug', передавая необходимые данные:
    res.render('edit-category', {
      sessionId: sessionId,                // ID сессии (для ссылок и API-запросов)
      categoryId: category.id,             // ID редактируемой категории
      currentTitle: category.title,        // Текущее название категории (для предзаполнения поля)
      title: 'Редактировать категорию',    // Заголовок страницы (передаётся в layout)
      error: null                          // Ошибок нет
    });
  } catch (error) {
    // Логируем ошибку на сервере
    console.error(error);
    // Отправляем клиенту статус 500 Internal Server Error
    res.status(500).send('Ошибка сервера');
  }
});

// GET /dashboard/:sessionId/create-order – страница создания заказа
router.get('/dashboard/:sessionId/create-order', validateSession('customer'), async (req, res) => {
  try {
    const categories = await Category.findAll({ where: { deleted: false } });
    res.render('create-order', { sessionId: req.params.sessionId, categories, title: 'Создать заказ', error: null });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// GET /dashboard/:sessionId/choose-executor/:orderId – страница выбора исполнителя
router.get('/dashboard/:sessionId/choose-executor/:orderId', validateSession('customer'), (req, res) => {
  res.render('choose-executor', {
    sessionId: req.params.sessionId,
    orderId: req.params.orderId,
    title: 'Выбор исполнителя'
  });
});

// GET /dashboard/:sessionId/select-categories – страница выбора категорий (исполнитель)
router.get('/dashboard/:sessionId/select-categories', validateSession('executor'), (req, res) => {
  res.render('select-categories', { sessionId: req.params.sessionId, title: 'Выбрать категории' });
});

// GET /dashboard/:sessionId/my-orders – страница моих заказов (доступна заказчику и исполнителю)
router.get('/dashboard/:sessionId/my-orders', validateSession('customer', 'executor'), async (req, res) => {
  try {
    // req.user уже загружен в validateSession, содержит роль и id
    res.render('my-orders', {
      sessionId: req.params.sessionId,
      title: 'Мои заказы',
      userRole: req.user.role
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ошибка сервера');
  }
});

// GET /rate-order/:sessionId/:orderId – страница оценки заказа
router.get('/rate-order/:sessionId/:orderId', validateSession('customer'), async (req, res) => {
  const { sessionId, orderId } = req.params;
  const order = await Order.findOne({ where: { id: orderId, customerId: req.user.id, status: 'completed' } });
  if (!order) {
    return res.status(404).send('Заказ не найден или не может быть оценён');
  }
  res.render('rate-order', { sessionId, orderId, userRole: 'customer', error: null });
});

module.exports = router;