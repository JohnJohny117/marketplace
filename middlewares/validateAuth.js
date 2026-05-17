// middlewares/validateAuth.js

// Вспомогательная функция для проверки координат
function validateCoordinates(longitude, latitude) {
  // Разрешаем null, undefined или пустую строку (означает отсутствие координат)
  if (longitude == null || latitude == null || longitude === '' || latitude === '') {
    return { correctly: true };
  }
  // преобразование строки в числа (на случай, если придут строки)
  const lon = Number(longitude);
  const lat = Number(latitude);
  if (isNaN(lon) || isNaN(lat)) {
    return { correctly: false, error: 'Долгота и широта должны быть числами' };
  }
  if (lon < -180 || lon > 180) {
    return { correctly: false, error: 'Долгота должна быть в диапазоне от -180 до 180' };
  }
  if (lat < -90 || lat > 90) {
    return { correctly: false, error: 'Широта должна быть в диапазоне от -90 до 90' };
  }
  return { correctly: true };
}

function validateRegistration(req, res, next) {
  const { name, login, email, password, phone, role, longitude, latitude } = req.body;

  // Проверка наличия всех обязательных полей
  if (!name || !login || !email || !password || !phone || !role) {
    return res.status(400).json({
      error: 'Не все обязательные поля заполнены. Требуются: name, login, email, password, phone, role'
    });
  }

  // Проверка ФИО (фамилия, имя, отчество)
  const nameParts = name.trim().split(/\s+/); // разбиваем по пробелам, убирая лишние
  if (nameParts.length !== 3) {
    return res.status(400).json({ error: 'ФИО должно содержать фамилию, имя и отчество (три слова)' });
  }
  // Каждая часть должна состоять только из букв (русских или латинских), дефиса или апострофа
  const namePartRegex = /^[a-zA-Zа-яА-ЯёЁ'-]+$/;
  for (const part of nameParts) {
    if (!namePartRegex.test(part)) {
      return res.status(400).json({ error: 'ФИО может содержать только буквы, дефис и апостроф' });
    }
  }

  // Проверка на отсутствие пробелов в логине
  if (/\s/.test(login)) {
    return res.status(400).json({ error: 'Логин не должен содержать пробелов' });
  }

  // Проверка, что логин не состоит только из запрещённых символов
  const hasValidChar = /[a-zA-Zа-яА-Я0-9]/; // хотя бы одна буква или цифра
  if (!hasValidChar.test(login)) {
    return res.status(400).json({
      error: 'Логин должен содержать хотя бы одну букву или цифру'
    });
  }

  // Проверка допустимых значений роли
  if (!['customer', 'executor'].includes(role)) {
    return res.status(400).json({
      error: 'Роль должна быть либо "customer", либо "executor"'
    });
  }

  // Проверка формата email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Некорректный формат email' });
  }

  // Минимальная длина пароля
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен содержать не менее 6 символов' });
  }

  // Проверка номера телефона (российский формат) – запрещаем любые символы, кроме цифр и плюса
// Плюс может быть только первым символом.
const phoneRegexForbidden = /[^0-9+]/; // если есть символы, кроме цифр и плюса
if (phoneRegexForbidden.test(phone)) {
  return res.status(400).json({ error: 'Номер телефона может содержать только цифры и символ "+" (в начале)' });
}
// Далее проверяем формат (уже без посторонних символов)
const cleaned = phone.replace(/[^\d+]/g, '');
const phoneFormatRegex = /^(\+7|8|7)\d{10}$/;
if (!phoneFormatRegex.test(cleaned)) {
  return res.status(400).json({ error: 'Некорректный формат телефона. Используйте +7 или 8 и 10 цифр' });
}

  // Проверка геолокации (опционально)
  const coordCheck = validateCoordinates(longitude, latitude);
  if (!coordCheck.correctly) {
    return res.status(400).json({ error: coordCheck.error });
  }

  next();
}

function validateLogin(req, res, next) {
  const { login, password, longitude, latitude } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'Необходимо указать логин и пароль' });
  }
  if (typeof login !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Логин и пароль должны быть строками' });
  }
  // Проверка геолокации (опционально)
  const coordCheck = validateCoordinates(longitude, latitude);
  if (!coordCheck.correctly) {
    return res.status(400).json({ error: coordCheck.error });
  }
  next();
}

module.exports = { validateRegistration, validateLogin };