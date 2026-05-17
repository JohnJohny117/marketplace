module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define(
    "Session",
    {
      id: {
        type: DataTypes.UUID, // тип UUID
        primaryKey: true, // первичный ключ
        defaultValue: DataTypes.UUIDV4, // генерировать UUID автоматически (версия 4)
      },
      userId: {
        type: DataTypes.INTEGER, // целое число
        allowNull: false, // не может быть NULL
        references: {
          model: 'users',   // имя таблицы, на которую ссылаемся
          key: 'id'         // поле в таблице users
        }
      },
      active: {
        type: DataTypes.BOOLEAN, // логическое значение
        allowNull: false, // не может быть NULL
        defaultValue: true, // по умолчанию true (активна)
      },
    },
    {
      tableName: "sessions", // имя таблицы в БД
      underscored: true, // имена полей в snake_case
      timestamps: true, // добавляет created_at, updated_at
    },
  );

  // Ассоциация: сессия принадлежит пользователю
  Session.associate = (models) => {
    Session.belongsTo(models.User, {
      foreignKey: 'userId',  // поле в модели Session
      as: 'user'             // псевдоним для включения в запросы
    });
  };

  return Session;
};
