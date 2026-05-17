const { Sequelize, DataTypes } = require('sequelize');

// Настройки подключения к БД 
const sequelize = new Sequelize('marketplace', 'postgres', '123', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false, // отключить логи SQL-запросов
});

// Импорт функций моделей
const User = require('./users')(sequelize, DataTypes);
const Order = require('./orders')(sequelize, DataTypes);
const Session = require('./sessions')(sequelize, DataTypes);
const Category = require('./categories')(sequelize, DataTypes);
const UsersCategories = require('./users-categories')(sequelize, DataTypes);

// Ассоциации между моделями
// Собираем все модели в один объект
const models = { User, Order, Session, Category, UsersCategories };
User.associate(models);
Order.associate(models);
Session.associate(models);
Category.associate(models);
UsersCategories.associate(models);

// Экспорт моделей и экземпляра sequelize
module.exports = {
  sequelize,
  User,
  Order,
  Session,
  Category,
  UsersCategories,
};