module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define(
    "Order",
    {
      id: {
        type: DataTypes.INTEGER, // тип целое число
        primaryKey: true, // первичный ключ
        autoIncrement: true, // автоматическое увеличение
      },
      customerId: {
        type: DataTypes.INTEGER, // тип целое число
        allowNull: false, // не может быть NULL
        references: {
          // внешний ключ
          model: "users", // ссылается на таблицу users
          key: "id", // на колонку id
        },
      },
      executorId: {
        type: DataTypes.INTEGER, // тип целое число
        allowNull: true, // может быть NULL
        references: {
          // внешний ключ
          model: "users", // ссылается на таблицу users
          key: "id", // на колонку id
        },
      },
      categoryId: {
        type: DataTypes.INTEGER, // тип целое число
        allowNull: false, // не может быть NULL
        references: {
          // внешний ключ
          model: "categories", // ссылается на таблицу categories
          key: "id", // на колонку id
        },
      },
      deadline: {
        type: DataTypes.DATE, // тип дата/время
        allowNull: true, // может быть NULL
      },
      description: {
        type: DataTypes.TEXT, // текстовый тип
        allowNull: false, // не может быть NULL
      },
      status: {
        type: DataTypes.ENUM({
         values: ['created', 'assigned', 'cancelled', 'progress', 'completed', 'rated'], // допустимые значения
         name: 'enum_orders_status'   // имя типа в PostgreSQL
      }),
        allowNull: false, // не может быть NULL
        defaultValue: "created", // по умолчанию 'created' (открыт)
      },
      score: {
        type: DataTypes.INTEGER, // целое число
        allowNull: true, // не может быть NULL
        defaultValue: null, // по умолчанию NULL
      },
      review: {
        type: DataTypes.TEXT, // текстовый тип
        allowNull: true, // может быть NULL
      },
    },
    {
      tableName: "orders", // имя таблицы в БД
      underscored: true, // имена полей в snake_case
      timestamps: true, // добавляет created_at, updated_at
    },
  );

  Order.associate = (models) => {
    // Связь с пользователем-заказчиком
    Order.belongsTo(models.User, {
      foreignKey: "customer_id", // внешний ключ
      as: "customer", // псевдоним для связи
    });
    // Связь с пользователем-исполнителем
    Order.belongsTo(models.User, {
      foreignKey: "executor_id", // внешний ключ
      as: "executor", // псевдоним для связи
    });
    // Связь с категорией
    Order.belongsTo(models.Category, {
      foreignKey: "category_id", // внешний ключ
      as: "category", // псевдоним для связи
    });
  };

  return Order;
};
