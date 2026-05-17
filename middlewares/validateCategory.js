const { Category } = require('../models');

function validateCategoryAdd(req, res, next) {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Название категории обязательно и не может быть пустым' });
  }
  req.body.title = title.trim();
  next();
}

function validateCategoryEdit(req, res, next) {
  let { id, title } = req.body;
  id = parseInt(id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID категории должен быть числом' });
  }
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Название категории обязательно и не может быть пустым' });
  }
  req.body.id = id;
  req.body.title = title.trim();
  next();
}

function validateCategoryDelete(req, res, next) {
  let { id } = req.body;
  id = parseInt(id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID категории должен быть числом' });
  }
  req.body.id = id;
  next();
}

// проверка существования категории и что она не удалена
async function checkCategoryExists(req, res, next) {
  try {
    const { categoryId } = req.body;
    const category = await Category.findOne({
      where: { id: categoryId, deleted: false }
    });

    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена или удалена' });
    }
    
    req.category = category; // можно использовать дальше
    next();
  } catch (err) {
    next(err);
  }
}

function validateCategorySelection(req, res, next) {
  const categories = req.body;

  if (!Array.isArray(categories)) {
    return res.status(400).json({ error: 'Тело запроса должно быть массивом объектов с полем id' });
  }

  if (categories.length === 0) {
    req.validatedCategories = [];
    return next();
  }

  for (let i = 0; i < categories.length; i++) {
    const item = categories[i];
    if (!item || typeof item !== 'object' || !('id' in item)) {
      return res.status(400).json({ error: `Элемент ${i} должен быть объектом с полем id` });
    }
    const id = item.id;
    if (typeof id !== 'number' || isNaN(id) || id <= 0 || !Number.isInteger(id)) {
      return res.status(400).json({ error: `id категории в элементе ${i} должен быть положительным целым числом` });
    }
  }

  req.validatedCategories = categories;
  next();
}

module.exports = {
  validateCategoryAdd,
  validateCategoryEdit,
  validateCategoryDelete,
  checkCategoryExists,
  validateCategorySelection,
};