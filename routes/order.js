const express = require('express');
const router = express.Router();
const { Order, Category, User, sequelize} = require('../models');
const { validateSession } = require('../middlewares/validateSession');
const { checkCategoryExists,} = require('../middlewares/validateCategory');
const {validateOrderInput, findOrderAndCheck, validateReviewInput} = require('../middlewares/validateOrder');

const geolib = require('geolib'); // npm install geolib
const { Op } = require('sequelize');
const { sendEmail } = require('../services/emailService');
const { getOrderCreatedTemplate, getOrderStatusUpdateTemplate, getOrderRatedTemplate, getOrderRejectedTemplate, getOrderAssignedTemplate, formatStatus } = require('../services/emailTemplates');



// POST /order/create/:sessionId – создание нового заказа
router.post(
  '/create/:sessionId',
  validateSession('customer'),   // проверка сессии (в req.session лежит объект сессии с userId)
  validateOrderInput,     // проверка наличия description, categoryId и формата deadline
  checkCategoryExists,    // проверка категории
  async function (req, res) {
    try {
      const { description, categoryId, deadline } = req.body;
      const customerId = req.session.userId; // ID пользователя из сессии

      const newOrder = await Order.create({
        customerId,
        categoryId: categoryId,   
        description,
        deadline: deadline ? new Date(deadline) : null,
        executorId: null,
        status: 'created',
        score: 0,
        review: null
      });

       // Получение email заказчика из базы данных (только поле email)
      const customer = await User.findByPk(customerId, { attributes: ['email'] });
      if (customer && customer.email) {
        // Формирование HTML-содержимого письма с помощью шаблона
        const html = getOrderCreatedTemplate({
          id: newOrder.id,
          sessionId: req.params.sessionId
        });
        // Асинхронная отправка письма (не блокируем основной поток)
        sendEmail({
          to: customer.email,
          subject: `Заказ №${newOrder.id} успешно создан`,
          html
        }).catch(err => console.error('Ошибка отправки email:', err));
      }

      // Возвращаем созданный заказ (можно выбрать только нужные поля)
      res.status(201).json(newOrder);
    } catch (error) {
      console.error('Ошибка при создании заказа:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);

// POST /order/assign/:sessionId/:orderId/:executorId – выбрать исполнителя
router.post(
  '/assign/:sessionId/:orderId/:executorId',
  validateSession('customer'),   // проверка сессии
  findOrderAndCheck('created'), // проверка существования заказа и статуса created
  async (req, res) => {
    try {
      const { executorId } = req.params;
      const parsedExecutorId = parseInt(executorId, 10); // приведение к числу

      // Обновляем заказ
      req.order.status = 'assigned';
      req.order.executorId = parsedExecutorId;
      await req.order.save();

      // Отправка email-уведомлений
      // Заказчик
      const customer = await User.findByPk(req.order.customerId, { attributes: ['email'] });
      if (customer && customer.email) {
        const newStatusReadable = formatStatus('assigned'); // 'Назначен'
        const htmlForCustomer = getOrderStatusUpdateTemplate(req.order, newStatusReadable);
        sendEmail({
          to: customer.email,
          subject: `Статус заказа №${req.order.id} изменен`,
          html: htmlForCustomer
        }).catch(err => console.error('Ошибка отправки email заказчику:', err));
      }

      // Исполнитель
      const executor = await User.findByPk(parsedExecutorId, { attributes: ['email'] });
      if (executor && executor.email) {
        const htmlForExecutor = getOrderAssignedTemplate(req.order);
        sendEmail({
          to: executor.email,
          subject: `Вас назначили на заказ №${req.order.id}`,
          html: htmlForExecutor
        }).catch(err => console.error('Ошибка отправки email исполнителю:', err));
      }

      res.status(200).json({ message: 'Исполнитель выбран' });
    } catch (error) {
      console.error('Ошибка при назначении исполнителя:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);

// POST /order/Progress/:sessionId/:orderId – взять в работу (исполнитель)
router.post(
  '/Progress/:sessionId/:orderId',
  validateSession('executor'),
  findOrderAndCheck('assigned'),
  async (req, res) => {
    try {
      req.order.status = 'progress';
      await req.order.save();

      // Отправка email-уведомления заказчику
      const customer = await User.findByPk(req.order.customerId, { attributes: ['email'] });
      if (customer && customer.email) {
        const newStatusReadable = formatStatus('progress'); // 'В работе'
        const html = getOrderStatusUpdateTemplate(req.order, newStatusReadable);
        sendEmail({
          to: customer.email,
          subject: `Статус заказа №${req.order.id} изменен`,
          html
        }).catch(err => console.error('Ошибка отправки email заказчику:', err));
      }

      res.status(200).json({ message: 'Заказ переведён в статус "Назначен"'});
    } catch (error) {
      console.error('Ошибка при взятии в работу:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);

// POST /order/reject/:sessionId/:orderId – отклонить заказ (исполнитель)
router.post(
  '/reject/:sessionId/:orderId',
  validateSession('executor'),
  findOrderAndCheck('assigned'),
  async (req, res) => {
    try {
      req.order.status = 'created';
      req.order.executorId = null; // освобождаем исполнителя
      await req.order.save();

      // Отправка email-уведомления заказчику
      const customer = await User.findByPk(req.order.customerId, { attributes: ['email'] });
      if (customer && customer.email) {
        const html = getOrderRejectedTemplate(req.order);
        sendEmail({
          to: customer.email,
          subject: `Статус заказа №${req.order.id} изменён`,
          html
        }).catch(err => console.error('Ошибка отправки email заказчику:', err));
      }

      res.status(200).json({ message: 'Заказ отклонён, статус "Создан"' });
    } catch (error) {
      console.error('Ошибка при отклонении заказа:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);

// POST /order/cancel/:sessionId/:orderId – отменить заказ (заказчик)
router.post(
  '/cancel/:sessionId/:orderId',
  validateSession('customer'),
  findOrderAndCheck('created'),
  async (req, res) => {
    try {
      req.order.status = 'cancelled';
      await req.order.save();
       // Отправка email-уведомления заказчику
      const customer = await User.findByPk(req.order.customerId, { attributes: ['email'] });
      if (customer && customer.email) {
        const newStatusReadable = formatStatus('cancelled'); // 'Отменён'
        const html = getOrderStatusUpdateTemplate(req.order, newStatusReadable);
        sendEmail({
          to: customer.email,
          subject: `Статус заказа №${req.order.id} изменен`,
          html
        }).catch(err => console.error('Ошибка отправки email заказчику:', err));
      }

      res.status(200).json({ message: 'Заказ отменен' });
    } catch (error) {
      console.error('Ошибка при отмене заказа:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);

// POST /order/complete/:sessionId/:orderId – завершить заказ (исполнитель)
router.post(
  '/complete/:sessionId/:orderId',
  validateSession('executor'),
  findOrderAndCheck('progress'),
  async (req, res) => {
    try {
      req.order.status = 'completed';
      await req.order.save();

      // Отправка email-уведомления заказчику
      const customer = await User.findByPk(req.order.customerId, { attributes: ['email'] });
      if (customer && customer.email) {
        const newStatusReadable = formatStatus('completed'); // 'Завершён'
        const html = getOrderStatusUpdateTemplate(req.order, newStatusReadable);
        sendEmail({
          to: customer.email,
          subject: `Статус заказа №${req.order.id} изменен`,
          html
        }).catch(err => console.error('Ошибка отправки email заказчику:', err));
      }

      res.status(200).json({ message: 'Заказ завершен'});
    } catch (error) {
      console.error('Ошибка при завершении заказа:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);

// POST /order/review/:sessionId/:orderId – оценка заказа
router.post(
  '/review/:sessionId/:orderId',
  validateSession('customer'),  // проверка сессии
  validateReviewInput,       // проверка score и review
  findOrderAndCheck('completed'), // заказ должен быть в статусе completed
  async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const order = req.order;
      const { score } = req.body;
      const review = req.review;

      // Обновление заказа
      order.status = 'rated';
      order.score = score;
      order.review = review;
      await order.save({ transaction });

      // Получение исполнителя заказа (он должен быть назначен)
      const executorId = order.executorId;
      if (!executorId) {
        // На всякий случай – если заказ в статусе completed, но executorId null (не должно быть)
        await transaction.rollback();
        return res.status(400).json({ error: 'У заказа нет исполнителя' });
      }

      // Вычисляем новые агрегатные функции для исполнителя
      const [result] = await Order.findAll({
        where: {
          executorId,
          status: 'rated'
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('AVG', sequelize.col('score')), 'avgScore']
        ],
        raw: true, // возвращает объект без экземпляра модели
        transaction // выполнение запроса в рамках текущей транзакции
      });

      const ratedCount = parseInt(result.count, 10);
      let avgScore = 0;
      if (result.avgScore !== null) {
        avgScore = Math.round(result.avgScore * 10) / 10; // один знак после запятой
      }

      // Обновление данных исполнителя
      const user = await User.findByPk(executorId, { transaction });
      if (!user) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Исполнитель не найден' });
      }
      user.ratingCount = ratedCount;
      user.ratingAvg = avgScore;
      await user.save({ transaction });
      await transaction.commit();

      // Отправка email-уведомлений
      // Исполнитель – оценка
      const executor = await User.findByPk(executorId, { attributes: ['email'] });
      if (executor && executor.email) {
        const htmlForExecutor = getOrderRatedTemplate(order, score, review);
        sendEmail({
          to: executor.email,
          subject: `Ваш заказ №${order.id} получил оценку`,
          html: htmlForExecutor
        }).catch(err => console.error('Ошибка отправки email исполнителю:', err));
      }

      // Заказчику – изменение статуса
      const customer = await User.findByPk(order.customerId, { attributes: ['email'] });
      if (customer && customer.email) {
        const newStatusReadable = formatStatus('rated'); // 'Оценён'
        const htmlForCustomer = getOrderStatusUpdateTemplate(order, newStatusReadable);
        sendEmail({
          to: customer.email,
          subject: `Статус заказа №${order.id} изменен`,
          html: htmlForCustomer
        }).catch(err => console.error('Ошибка отправки email заказчику:', err));
      }

      res.status(200).json({ message: 'Оценка сохранена' });
    } catch (error) {
      await transaction.rollback();
      console.error('Ошибка при сохранении оценки:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);

// GET /order/myOrders/:sessionId – получить заказы текущего пользователя
router.get('/myOrders/:sessionId', validateSession('customer', 'executor'), async (req, res) => {
  try {
    const userId = req.session.userId;

    // Поиск пользователя для определения роли
    const user = req.user; // уже загружен validateSession
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    let condition;
    if (user.role === 'customer') {
      condition = { customerId: userId };
    } else if (user.role === 'executor') {
      condition = { executorId: userId };
    }

    // Выбор связанного пользователя для связанной модели User
    let relatedUser;
    if (user.role === 'customer') {
      relatedUser = 'executor';
    } else {
      relatedUser = 'customer';
    }

    const orders = await Order.findAll({
      where: condition,
      attributes: ['id', 'createdAt', 'description', 'deadline', 'status', 'score'],
      include: [
        {
          model: User,
          as: relatedUser,
          attributes: ['name', 'phone']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['title']
        }
      ],
      order: [['createdAt', 'DESC']] // сортировка по дате
    });
    res.status(200).json(orders);
  } catch (error) {
    console.error('Ошибка при получении заказов:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

// GET /order/offers/:sessionId/:orderId – список исполнителей, подходящих под категорию заказа
/* router.get(
  '/offers/:sessionId/:orderId',
  validateSession('customer'),       // Только заказчик имеет доступ
  findOrderAndCheck('created'),      // Заказ должен быть в статусе "created"
  async (req, res) => {
    try {
      // Получение данных из запроса и сессии
      const customer = req.user;          // Заказчик (уже загружен в validateSession)
      const order = req.order;            // Заказ (уже загружен в findOrderAndCheck)
      const categoryId = order.categoryId; // Категория заказа

      // Проверка наличия координат у заказчика
      const customerCoords = { lon: customer.longitude, lat: customer.latitude };
      const hasCustomerCoords = customerCoords.lon != null && customerCoords.lat != null;
      if (!hasCustomerCoords) {
        // Если у заказчика нет координат – невозможно вычислить расстояние
        return res.status(200).json({ message: 'У вас не указаны координаты, невозможно найти исполнителей рядом', offers: [] });
      }

      // Поиск исполнителей с нужной категорией и с координатами
      const potentialExecutors = await User.findAll({
        where: {
          role: 'executor',                     // Только исполнители
          longitude: { [Op.ne]: null },         // Долгота не NULL
          latitude: { [Op.ne]: null }           // Широта не NULL
        },
        include: [{
          model: Category,
          as: 'categories',
          where: { id: categoryId, deleted: false }, // Категория совпадает с категорией заказа и не удалена
          attributes: [],        // Не нужно выводить данные категории
          through: { attributes: [] } // Не нужны поля промежуточной таблицы
        }],
        attributes: ['id', 'name', 'ratingAvg', 'ratingCount', 'longitude', 'latitude'],
      });

      // Если нет ни одного подходящего исполнителя
      if (!potentialExecutors.length) {
        return res.status(200).json({ message: 'Нет исполнителей, подходящих под категорию заказа', offers: [] });
      }

      // Предварительные вычисления
      // Максимальное количество оценок среди всех найденных исполнителей (для нормализации)
      const maxRatingCount = Math.max(...potentialExecutors.map(e => e.ratingCount), 1);
      const RADIUS_25KM = 25000; // 25 км в метрах

      // Расчёт скора для каждого исполнителя и фильтрация по радиусу
      const offersWithDistance = potentialExecutors.map(executor => {
        // Вычисление расстояния между заказчиком и исполнителем (в метрах)
        const distance = geolib.getDistance(
          { latitude: customerCoords.lat, longitude: customerCoords.lon },
          { latitude: executor.latitude, longitude: executor.longitude }
        );
        // Если расстояние больше 25 км – исключаем исполнителя (возвращаем null)
        if (distance > RADIUS_25KM) return null;

        // Proximity score (близость) – экспоненциальное убывание с порогом 5 км
        const proximityScore = Math.exp(-distance / 5000);

        // Нормализованный средний рейтинг (от 0 до 1)
        let ratingAvgScore = executor.ratingAvg / 5;
        // Бонус для новых исполнителей (нет оценок) – небольшое преимущество
        if (executor.ratingCount === 0) ratingAvgScore += 0.25;

        // Нормализованное количество оценок (от 0 до 1)
        const ratingCountScore = Math.min(1, executor.ratingCount / maxRatingCount);

        // Веса факторов
        const w1 = 0.5; // близость
        const w2 = 0.2; // средняя оценка
        const w3 = 0.3; // количество оценок

        // Итоговый скор
        let totalScore = w1 * proximityScore + w2 * ratingAvgScore + w3 * ratingCountScore;

        return {
          userId: executor.id,
          name: executor.name,
          ratingAvg: executor.ratingAvg,
          ratingCount: executor.ratingCount,
          totalScore: totalScore,
        };
      }).filter(o => o !== null); // Удаление исполнителей за пределами радиуса

      // Если после фильтрации по радиусу никого не осталось
      if (offersWithDistance.length === 0) {
        return res.status(200).json({ message: 'Нет исполнителей рядом с вами (в радиусе 25 км)', offers: [] });
      }

      // Сортировка по убыванию скора (и по userId при равенстве)
      offersWithDistance.sort((a, b) => {
        if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
        return a.userId - b.userId;
      });

      // Отбор топ-5 исполнителей
      const top5 = offersWithDistance.slice(0, 5);
      // Возвращаем только нужные поля 
      const result = top5.map(({ userId, name, ratingAvg, ratingCount, totalScore}) => ({ userId, name, ratingAvg, ratingCount, totalScore }));
      res.status(200).json(result);
    } catch (error) {
      console.error('Ошибка при получении предложений:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
); */

// GET /order/offers/:sessionId/:orderId – список исполнителей, подходящих под категорию заказа
// Вход: sessionId (UUID сессии заказчика), orderId (ID заказа)
// Выход: JSON-массив топ-5 исполнителей с их идентификаторами, именами, рейтингами, количеством оценок и итоговым скором
router.get(
  '/offers/:sessionId/:orderId',
  // 1. Проверка сессии и роли "customer" (только заказчик имеет доступ)
  validateSession('customer'),
  // 2. Проверка существования заказа и его статуса "created"
  findOrderAndCheck('created'),
  async (req, res) => {
    try {
      // Получение объекта заказчика и заказа из ранее выполненных мидлваров
      const customer = req.user;          // заказчик (уже загружен в validateSession)
      const order = req.order;            // заказ (уже загружен в findOrderAndCheck)
      const categoryId = order.categoryId; // категория, к которой относится заказ

      // Проверка наличия координат у заказчика
      const customerCoords = { lon: customer.longitude, lat: customer.latitude };
      const hasCustomerCoords = customerCoords.lon != null && customerCoords.lat != null;
      //если что закомментировать
      if (!hasCustomerCoords) {
        // Без координат невозможно рассчитать расстояние до исполнителей
        return res.status(200).json({
          message: 'У вас не указаны координаты, невозможно найти исполнителей рядом',
          offers: []
        });
      }

      // Поиск исполнителей с подходящей категорией и координатами
      // Выбираем всех пользователей с ролью 'executor', у которых заданы долгота и широта,
      // и которые связаны с категорией, равной категории заказа (через промежуточную таблицу users_categories)
      const potentialExecutors = await User.findAll({
        where: {
          role: 'executor',                     // только исполнители
          longitude: { [Op.ne]: null },         // долгота не NULL
          latitude: { [Op.ne]: null }           // широта не NULL
        },
        include: [{
          model: Category,
          as: 'categories',
          where: { id: categoryId, deleted: false }, // категория совпадает и не удалена
          attributes: [],        // не нужно возвращать поля категории
          through: { attributes: [] } // не нужны поля промежуточной таблицы users_categories
        }],
        attributes: ['id', 'name', 'ratingAvg', 'ratingCount', 'longitude', 'latitude']
      });

      // Если нет ни одного такого исполнителя – возвращаем сообщение
      if (!potentialExecutors.length) {
        return res.status(200).json({
          message: 'Нет исполнителей, подходящих под категорию заказа',
          offers: []
        });
      }

      // Вычисление общего количества оцененных заказов в системе
      // Общее число заказов со статусом 'rated' (оценённых) – используется для нормализации ratingCount
      const totalRatedOrders = (await Order.count({ where: { status: 'rated' } })) || 1;
      // Если оценённых заказов нет, берём 1, чтобы избежать деления на ноль

      const RADIUS_KM = 25;               // радиус поиска – 25 километров
      const RADIUS_METERS = RADIUS_KM * 1000;

      // Расчёт скоров для каждого исполнителя
      // Для каждого кандидата вычисляем три компонента и итоговый Score
      const offers = potentialExecutors
        .map(executor => {
          // 1. Расстояние между заказчиком и исполнителем (в метрах)
          const distanceMeters = geolib.getDistance(
            { latitude: customerCoords.lat, longitude: customerCoords.lon },
            { latitude: executor.latitude, longitude: executor.longitude }
          );
          // Фильтрация по радиусу: если дальше 25 км – исключаем (возвращаем null)
          if (distanceMeters > RADIUS_METERS) return null;

          // Перевод расстояния в километры
          const distanceKm = distanceMeters / 1000;

          // 2. Proximity_score – близость, формула: 1 / (1 + distance_km)
          // Чем меньше расстояние, тем ближе значение к 1.
          const proximityScore = 1 / (1 + distanceKm);

          // 3. Rating_avg_score – нормализованный средний рейтинг (0..1)
          let ratingAvgScore = executor.ratingAvg / 5;
          // Бонус для новых исполнителей (у которых ещё нет оценок)
          // Добавляем +0.1, чтобы они не получили нулевой вклад в Score
          if (executor.ratingCount === 0) ratingAvgScore += 0.2;

          // 4. Rating_count_score – нормализованное количество оценок исполнителя
          // Относительно общего числа оценённых заказов в системе.
          const ratingCountScore = executor.ratingCount / totalRatedOrders;

          // Весовые коэффициенты (подобраны эмпирически)
          const w1 = 0.5; // важность близости
          const w2 = 0.2; // важность среднего рейтинга
          const w3 = 0.3; // важность количества оценок

          // 5. Итоговый Score = взвешенная сумма трёх компонентов
          const totalScore = w1 * proximityScore + w2 * ratingAvgScore + w3 * ratingCountScore;

          // Возвращаем объект с результатами для данного исполнителя
          return {
            userId: executor.id,
            name: executor.name,
            ratingAvg: executor.ratingAvg,
            ratingCount: executor.ratingCount,
            totalScore: totalScore,
            distanceMeters: distanceMeters,
            proximityScore,
            ratingAvgScore,
            ratingCountScore,
            totalRatedOrders
          };
        })
        .filter(o => o !== null); // Удаляем исключённых (за пределами радиуса)

      // Если после фильтрации по радиусу не осталось ни одного исполнителя
      if (offers.length === 0) {
        return res.status(200).json({
          message: `Нет исполнителей в радиусе ${RADIUS_KM} км`,
          offers: []
        });
      }

      // Сортировка кандидатов по убыванию Score
      // При равенстве Score – по возрастанию userId
      offers.sort((a, b) => {
        if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
        return a.userId - b.userId;
      });

      // Отбор топ-5 исполнителей
      const top5 = offers.slice(0,5);
      const result = top5.map(({ userId, name, ratingAvg, ratingCount, totalScore, distanceMeters, proximityScore, ratingAvgScore, 
      ratingCountScore, totalRatedOrders }) => ({
        userId,
        name,
        ratingAvg,
        ratingCount,
        totalScore,
        distanceMeters,
        proximityScore,
        ratingAvgScore,
        ratingCountScore,
        totalRatedOrders
      }));
      console.log(result)
      // Успешный ответ
      res.status(200).json(result);
    } catch (error) {
      // Логирование и отправка общей ошибки сервера
      console.error('Ошибка при получении предложений:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);
module.exports = router;