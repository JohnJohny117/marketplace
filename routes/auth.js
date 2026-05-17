const express = require('express');
const bcrypt = require('bcrypt');
const { User, Session, sequelize } = require('../models'); 
const { validateRegistration, validateLogin } = require('../middlewares/validateAuth');
const { validateSession } = require('../middlewares/validateSession');

const router = express.Router();

// POST /auth/regUser - регистрация нового пользователя
router.post('/regUser', validateRegistration, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, login, email, password, phone, role, longitude, latitude } = req.body;

    // Проверка уникальности логина
    const existingUser = await User.findOne({ where: { login }, transaction });
    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
    }

    // Хэширование пароля
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    // Создание пользователя
    const newUser = await User.create({
      name,
      login,
      email,
      passwordHash: passwordHash,
      phone,
      role,
      longitude: longitude || null,
      latitude: latitude || null
    }, { transaction });

    // Создание сессии 
    const session = await Session.create({
      userId: newUser.id,   
      active: true
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      sessionId: session.id,
      role: newUser.role
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Ошибка при регистрации:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

// POST /auth/login - вход пользователя
router.post('/login', validateLogin, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { login, password, longitude, latitude } = req.body;

    const user = await User.findOne({ where: { login }, transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await transaction.rollback();
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

     // Если передана геолокация — обновляем координаты пользователя
    if (longitude !== undefined && latitude !== undefined) {
      user.longitude = longitude;
      user.latitude = latitude;
      await user.save({ transaction });
    }

    // Создание сессии 
    const session = await Session.create({
      userId: user.id,      
      active: true
    }, { transaction });

    await transaction.commit();

    res.status(200).json({
      sessionId: session.id,
      role: user.role
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Ошибка при входе:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

// POST /auth/logout/:sessionId - выход пользователя (деактивация сессии)
router.post('/logout/:sessionId', validateSession(), async (req, res) => {
  try {
    req.session.active = false;
    await req.session.save();
    res.status(200).json({ message: 'Выход выполнен успешно' });
  } catch (error) {
    console.error('Ошибка при выходе:', error.message);
    res.status(500).json({ error: `Внутренняя ошибка сервера: ${error.message}` });
  }
});

module.exports = router;