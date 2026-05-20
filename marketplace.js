const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { Order, User, Session, sequelize } = require('./models'); // импорт sequelize
const { Op } = require('sequelize');
const cron = require('node-cron');
const { deactivateExpiredSessions, rejectExpiredOrders } = require('./services/cleanup');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const dotenv = require('dotenv');
const { sendEmail } = require('./services/emailService');
const { getOrderRejectedTemplate } = require('./services/emailTemplates');
// const port = 3000;

const app = express();

dotenv.config({path: `${__dirname}/.env`})

app.use(cookieParser());
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
sequelize.sync() // или { force: true } для пересоздания
  .then(() => {
    console.log('База данных синхронизирована');
  })
  .catch(err => {
    console.error('Ошибка синхронизации БД:', err);
  });

// Сразу при старте очищаем всё, что протухло
deactivateExpiredSessions().catch(console.error);
rejectExpiredOrders().catch(console.error);

// Ежедневный cron (в полночь)
cron.schedule('0 0 * * *', () => {
  deactivateExpiredSessions().catch(console.error);
  rejectExpiredOrders().catch(console.error);
});

app.listen(process.env.PORT || 3000,() => {
   console.log('Проект работает на порте 3000, для выхода Ctrl + C');
});
