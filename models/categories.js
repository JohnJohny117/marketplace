module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    "Category",
    {
      id: {
        type: DataTypes.INTEGER, // тип целое число
        primaryKey: true, // первичный ключ
        autoIncrement: true, // автоматическое увеличение
      },
      title: {
        type: DataTypes.TEXT, // текстовый тип
        allowNull: false, // не может быть NULL
        unique: true, // уникальное значение
      },
      deleted: {
        type: DataTypes.BOOLEAN, // логический тип
        allowNull: false, // не может быть NULL
        defaultValue: false, // по умолчанию false (не удалена)
      },
    },
    {
      tableName: "categories", // имя таблицы в БД
      underscored: true, // имена полей в snake_case
      timestamps: true, // добавляет created_at, updated_at
    },
  );

  Category.associate = (models) => {
    // Связь с заказами: одна категория имеет много заказов
    Category.hasMany(models.Order, {
      foreignKey: "category_id", // внешний ключ в модели Order
      as: "orders", // псевдоним для связи
    });
    // Связь многие-ко-многим с пользователями через таблицу users_categories
    Category.belongsToMany(models.User, {
      through: models.UsersCategories, // промежуточная модель
      foreignKey: "category_id", // внешний ключ на категорию
      otherKey: "user_id", // внешний ключ на пользователя
      as: "users", // псевдоним для связи
    });
  };

  return Category;
};
