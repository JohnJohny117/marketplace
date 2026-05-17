const express = require('express');
const { Category, User, UsersCategories, sequelize } = require('../models');
const { validateSession } = require('../middlewares/validateSession');
const {
  validateCategoryAdd,
  validateCategoryEdit,
  validateCategoryDelete,
  validateCategorySelection,
} = require('../middlewares/validateCategory');

const router = express.Router();



// GET /:sessionId – получение всех неудалённых категорий
router.get('/:sessionId', validateSession(), async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { deleted: false },
      through: { attributes: [] }, // без возврата полей из users_categories
      attributes: ['id', 'title'], // выбор только нужных полей
    });
    res.json(categories);

  } catch (error) {
    console.error('Ошибка при получении категорий:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

// POST /add/:sessionId – добавление новой категории (или восстановление удалённой)
router.post('/add/:sessionId', validateSession('admin'), validateCategoryAdd, async (req, res) => {
  try {
    const { title } = req.body;

    // Проверка, есть ли удалённая категория с таким названием
    const deletedCategory = await Category.findOne({
      where: { title, deleted: true }
    });
    if (deletedCategory) {
      // Восстанавливаем удалённую категорию
      deletedCategory.deleted = false;
      await deletedCategory.save();
      return res.status(201).json(deletedCategory);
    }

    // Проверка, нет ли активной категории с таким названием
    const existingCategory = await Category.findOne({
      where: { title, deleted: false }
    });
    if (existingCategory) {
      return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    }

    // Создание новой категории
    const newCategory = await Category.create({ title });
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Ошибка при добавлении категории:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

// POST /edit/:sessionId – редактирование категории
router.post('/edit/:sessionId', validateSession('admin'), validateCategoryEdit, async (req, res) => {
  try {
    const { id, title } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    if (category.deleted) {
      return res.status(410).json({ error: 'Категория удалена и не может быть изменена' });
    }

    // Если название меняется, делаем проверку уникальности
    if (category.title === title) {
      return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    }

    category.title = title;
    await category.save();
    res.json(category);

  } catch (error) {
    console.error('Ошибка при редактировании категории:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

// POST /delete/:sessionId –удаление категории
router.post('/delete/:sessionId', validateSession('admin'), validateCategoryDelete, async (req, res) => {
  try {
    const { id } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    if (category.deleted) {
      return res.status(410).json({ error: 'Категория уже удалена' });
    }

    category.deleted = true;
    await category.save();
    res.json({ message: 'Категория помечена как удалённая', category });

  } catch (error) {
    console.error('Ошибка при удалении категории:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

// POST /select/:sessonId – выбор категорий исполнителем
router.post(
  '/select/:sessionId',
  validateSession('executor'),
  validateCategorySelection,
  async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const userId = req.session.userId;
      const categories = req.body; // Напрямую массив

      // Проверка существования категорий
      if (categories && categories.length > 0) {
        // Извлекаем массив идентификаторов категорий из переданных объектов
        const categoryIds = categories.map(c => c.id);

        // Запрашиваем все категории из БД, у которых id входит в переданный массив,
        // и которые не помечены как удаленные (deleted = false).
        // Атрибуты выбираем только id для экономии ресурсов.
        const existingCategories = await Category.findAll({
          where: { id: categoryIds, deleted: false },
          attributes: ['id'],
          transaction, // выполняем запрос в рамках текущей транзакции
        });
        // Сравниваем количество найденных категорий с количеством переданных id.
        // Если они не совпадают, значит, хотя бы одна категория не существует или удалена.
        if (existingCategories.length !== categoryIds.length) {
          // Откатываем транзакцию, так как данные не согласованы
          await transaction.rollback();
          // Возвращаем ошибку клиенту
          return res.status(400).json({ error: 'Одна или несколько категорий не найдены или удалены' });
        }
      }

      // Удаление старых связей
      await UsersCategories.destroy({
        where: { user_id: userId },
        transaction,
      });

      // Добавление новых связей
      if (categories && categories.length > 0) { 
        // Преобразуем массив объектов [{id: 1}, {id: 2}] в массив записей для таблицы users_categories
        // Каждая запись содержит id пользователя (исполнителя) и id категории
        const newAssociations = categories.map(c => ({
          user_id: userId,
          category_id: c.id,
        }));
        await UsersCategories.bulkCreate(newAssociations, { transaction });
        //bulkCreate выполняет массовую вставку всех записей одним запросом (эффективнее, чем вставлять по одному).
      }

      await transaction.commit();
      res.status(200).json({ message: 'Категории успешно обновлены' });

    } catch (error) {
      await transaction.rollback();
      console.error('Ошибка при выборе категорий:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);

// GET /selected/:sessionId – получение выбранных исполнителем категорий
router.get(
  '/selected/:sessionId',
  validateSession('executor'), // проверка сессии и роли executor
  async (req, res) => {
    try {
      const userId = req.session.userId; // id из сессии

      // Получаем пользователя с его категориями (только неудалённые)
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Category,
            as: 'categories',
            where: { deleted: false },
            through: { attributes: [] }, // без возврата полей из users_categories
            attributes: ['id', 'title'], // выбор только нужных полей
          },
        ],
      });

      let categories;
      if (user && user.categories) {
        categories = user.categories;
      } else {
        categories = [];
      } // массив категорий
      res.status(200).json(categories);

    } catch (error) {
      console.error('Ошибка при получении категорий исполнителя:', error.message);
      res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
    }
  }
);


module.exports = router;