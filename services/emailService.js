// Подключение библиотеки для работы с электронной почтой (отправка через SMTP)
const nodemailer = require('nodemailer');
// Загрузка переменных окружения из файла .env (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS)
require('dotenv').config();

// Настройка транспортного объекта, который будет отправлять письма через указанный SMTP-сервер
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // Адрес SMTP-сервера
    port: process.env.EMAIL_PORT, // Порт подключения 
    secure: true, // Использовать защищённое соединение (SSL/TLS) – true для порта 465
    auth: {
        user: process.env.EMAIL_USER, // Логин от почтового ящика (отправитель)
        pass: process.env.EMAIL_PASS, // Пароль или пароль приложения (для безопасности)
    },
});

// Асинхронная функция для отправки электронного письма
// Параметры: получатель (to), тема (subject), HTML-содержимое (html)
async function sendEmail({ to, subject, html }) {
    try {
        // Выполнение отправки через настроенный transporter
        const info = await transporter.sendMail({
            from: `"Маркетплейс Услуг" <${process.env.EMAIL_USER}>`, // Отправитель (имя и адрес)
            to, // Кому (строка или массив)
            subject, // Тема письма
            html,// Тело письма в формате HTML
        });
        // Возврат объекта с признаком успеха
        return { success: true };
    } catch (error) {
        // Логирование ошибки отправки (сетевая проблема, неверные учётные данные и т.п.)
        console.error('Отправка электронной почты не удалась', error);
        // Возврат объекта с ошибкой, чтобы не прерывать основной процесс приложения
        return { success: false, error: error.message };
    }
}

// Экспорт функции для использования в других модулях (например, в маршрутах auth или order)
module.exports = { sendEmail };