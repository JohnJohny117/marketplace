module.exports = (sequelize, DataTypes) => {
  const UsersCategories = sequelize.define(
    "UsersCategory",
    {
      userId: {
        type: DataTypes.INTEGER, // тип целое число
        allowNull: false, // не может быть NULL
        primaryKey: true, // часть составного первичного ключа
        references: {
          // внешний ключ
          model: "users", // ссылается на таблицу users
          key: "id", // на колонку id
        },
      },
      categoryId: {
        type: DataTypes.INTEGER, // тип целое число
        allowNull: false, // не может быть NULL
        primaryKey: true, // часть составного первичного ключа
        references: {
          // внешний ключ
          model: "categories", // ссылается на таблицу categories
          key: "id", // на колонку id
        },
      },
    },
    {
      tableName: "users_categories", // имя таблицы в БД
      underscored: true, // имена полей в snake_case
      timestamps: true, // добавляет created_at, updated_at

      // Составной первичный ключ уже задан через primaryKey:true в полях
    },
  );

  UsersCategories.associate = (models) => {
    // Связь с пользователем: запись принадлежит одному пользователю
    UsersCategories.belongsTo(models.User, {
      foreignKey: "user_id", // внешний ключ
      as: "user", // псевдоним для связи
    });
    // Связь с категорией: запись принадлежит одной категории
    UsersCategories.belongsTo(models.Category, {
      foreignKey: "category_id", // внешний ключ
      as: "category", // псевдоним для связи
    });
  };

  return UsersCategories;
};
