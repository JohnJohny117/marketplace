module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER, // тип целое число
        primaryKey: true, // первичный ключ
        autoIncrement: true, // автоматическое увеличение
      },
      name: {
        type: DataTypes.TEXT, // текстовый тип
        allowNull: false, // не может быть NULL
      },
      email: {
        type: DataTypes.TEXT, // текстовый тип
        allowNull: false, // не может быть NULL
      },
       login: {
        type: DataTypes.TEXT, // текстовый тип
        allowNull: false, // не может быть NULL
        unique: true, // уникальное значение
      },
      passwordHash: {
        type: DataTypes.TEXT, // текстовый тип
        allowNull: false, // не может быть NULL
      },
      longitude: {
        //долгота
        type: DataTypes.REAL, // вещественное число
        allowNull: true, // может быть NULL
      },
      latitude: {
        //широта
        type: DataTypes.REAL, // вещественное число
        allowNull: true, // может быть NULL
      },
      phone: {
        type: DataTypes.STRING(12), // строка фиксированной длины
        allowNull: false, //  не может быть NULL
      },
      role: {
        type: DataTypes.ENUM({
         values: ['customer', 'executor', 'admin'], // допустимые значения
         name: 'enum_users_role'   // имя типа в PostgreSQL
      }),
        allowNull: false, // не может быть NULL
        defaultValue: 'customer', // по умолчанию 'customer'
      },
      ratingAvg: {
        type: DataTypes.REAL, // целое число
        allowNull: false, // не может быть NULL
        defaultValue: 0.0, // по умолчанию 0
      },
      ratingCount: {
        type: DataTypes.INTEGER, // целое число
        allowNull: false, // не может быть NULL
        defaultValue: 0, // по умолчанию 0
      },
    },
    {
      tableName: "users", // имя таблицы в БД
      underscored: true, // имена полей в snake_case
      timestamps: true, // добавляет created_at, updated_at
    },
  );

  User.associate = (models) => {
    // Связь с заказами: пользователь как заказчик имеет много заказов
    User.hasMany(models.Order, {
      foreignKey: "customer_id", // внешний ключ в модели Order
      as: "customerOrders", // псевдоним для связи
    });
    // Связь с заказами: пользователь как исполнитель имеет много заказов
    User.hasMany(models.Order, {
      foreignKey: "executor_id", // внешний ключ в модели Order
      as: "executorOrders", // псевдоним для связи
    });
    // Связь многие-ко-многим с категориями через промежуточную таблицу
    User.belongsToMany(models.Category, {
      through: models.UsersCategories, // промежуточная модель
      foreignKey: "user_id", // внешний ключ на пользователя
      otherKey: "category_id", // внешний ключ на категорию
      as: "categories", // псевдоним для связи
    });
    // Связь с сессиями: пользователь может иметь много сессий
     User.hasMany(models.Session, {
      foreignKey: 'userId',  // поле в модели Session
      as: 'sessions'         // псевдоним
    });
  };

  return User;
};
