const express = require('express');
const path = require('path');
const { Order, User, Session, sequelize } = require('./models'); // импорт sequelize
const { Op } = require('sequelize');
const cron = require('node-cron');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const dotenv = require('dotenv');
const { sendEmail } = require('./services/emailService');
const { getOrderRejectedTemplate } = require('./services/emailTemplates');
// const port = 3000;

const app = express();

dotenv.config({path: `${__dirname}/.env`})

app.use(express.json());
app.use(express.urlencoded({ extended: false}));
app.use(express.static(path.join(__dirname, 'public')));

const stream = rfs.createStream("access.log", {
    interval: "1d",
    path: path.join(__dirname, "logs"),
})
app.use(morgan("combined", {
    stream
}))
//Подключение swagger
const setupSwagger = require('./swagger');
setupSwagger(app);



// Подключение роутеров
const authRouter = require('./routes/auth');
const categoryRouter = require('./routes/category');
const orderRouter = require('./routes/order');
const webRouter = require('./routes/web');  
app.use('/auth', authRouter);
app.use('/category', categoryRouter);
app.use('/order', orderRouter);
app.use('/', webRouter);

// Подключение шаблонизатора pug
app.set('view engine', 'pug');
app.set('views', 'views');

// Страница входа (GET)
app.get('/login', (req, res) => {
  res.render('login', { title: 'Вход', error: null });
});

// Редирект с корня на страницу входа
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Синхронизация моделей с БД (только для разработки)
sequelize.sync({ alter: true }) // или { force: true } для пересоздания
  .then(() => {
    console.log('База данных синхронизирована');
  })
  .catch(err => {
    console.error('Ошибка синхронизации БД:', err);
  });

/* cron.schedule('* * * * *', async () => {
  try {
    // Текущее время минус 1 минута
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    
    // Поиск активных сессий, созданных более 1 минуты назад
    const expiredSessions = await Session.findAll({
      where: {
        active: true,
        createdAt: { [Op.lt]: oneMinuteAgo }
      }
    });
    
    if (expiredSessions.length > 0) {
      // Деактивация найденных сессий
      await Session.update(
        { active: false },
        { where: { id: expiredSessions.map(s => s.id) } }
      );
      console.log(`[CRON] Деактивировано ${expiredSessions.length} сессий (время жизни 1 минута).`);
    }
  } catch (error) {
    console.error('[CRON] Ошибка при деактивации сессий:', error.message);
  }
}); */

cron.schedule('0 0 * * *', async () => {
  try {
    // Текущее время минус 24 часа
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Поиск активных сессий, созданных более 24 часов назад
    const expiredSessions = await Session.findAll({
      where: {
        active: true,
        createdAt: { [Op.lt]: oneDayAgo }
      }
    });
    
    if (expiredSessions.length > 0) {
      // Деактивация найденных сессий
      await Session.update(
        { active: false },
        { where: { id: expiredSessions.map(s => s.id) } }
      );
      console.log(`[CRON] Деактивировано ${expiredSessions.length} сессий (время жизни 24 часа).`);
    }
  } catch (error) {
    console.error('[CRON] Ошибка при деактивации сессий:', error.message);
  }
});


/* cron.schedule('* * * * *', async () => {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    // Находим заказы в статусе 'assigned', созданные более 1 минуты назад
    const expiredOrders = await Order.findAll({
      where: {
        status: 'assigned',
        createdAt: { [Op.lt]: oneMinuteAgo }
      }
    });
    if (expiredOrders.length > 0) {
      // Для каждого заказа сбрасываем статус и исполнителя
      for (const order of expiredOrders) {
        order.status = 'created';
        order.executorId = null;
        await order.save();
      }
      console.log(`[CRON] Автоматически отклонено ${expiredOrders.length} заказов (не приняты в течение 1 минуты).`);
    }
  } catch (error) {
    console.error('[CRON] Ошибка при автоматическом отклонении заказов:', error.message);
  }
}); */

cron.schedule('0 0 * * *', async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredOrders = await Order.findAll({
      where: {
        status: 'assigned',
        updatedAt: { [Op.lt]: oneDayAgo }
      }
    });

    if (expiredOrders.length > 0) {
      for (const order of expiredOrders) {
        // Сброс статуса и исполнителя
        order.status = 'created';
        order.executorId = null;
        await order.save();

        // Отправка email заказчику
        const customer = await User.findByPk(order.customerId, { attributes: ['email'] });
        if (customer && customer.email) {
          const html = getOrderRejectedTemplate(order);
          await sendEmail({
            to: customer.email,
            subject: `Статус заказа №${order.id} изменён`,
            html
          }).catch(err => console.error('Ошибка отправки email заказчику:', err));
        }
      }
      console.log(`[CRON] Автоматически отклонено ${expiredOrders.length} заказов (не приняты в течение 24 часов после назначения).`);
    }
  } catch (error) {
    console.error('[CRON] Ошибка при автоматическом отклонении заказов:', error.message);
  }
});

app.listen(process.env.PORT || 3000,() => {
   console.log('Проект работает на порте 3000, для выхода Ctrl + C');
});
