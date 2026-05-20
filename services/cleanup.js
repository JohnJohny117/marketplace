const { Session, Order, User } = require('../models');
const { Op } = require('sequelize');
const { sendEmail } = require('./emailService');
const { getOrderRejectedTemplate } = require('./emailTemplates');

// Деактивация сессий старше 24 часов
async function deactivateExpiredSessions() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredSessions = await Session.findAll({
      where: { active: true, createdAt: { [Op.lt]: oneDayAgo } }
    });
    if (expiredSessions.length > 0) {
      await Session.update(
        { active: false },
        { where: { id: expiredSessions.map(s => s.id) } }
      );
      console.log(`[CLEANUP] Деактивировано ${expiredSessions.length} сессий (старше 24 часов).`);
    }
  } catch (error) {
    console.error('[CLEANUP] Ошибка деактивации сессий:', error.message);
  }
}

// Отклонение заказов в статусе 'assigned' старше 24 часов (по updatedAt)
async function rejectExpiredOrders() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredOrders = await Order.findAll({
      where: { status: 'assigned', updatedAt: { [Op.lt]: oneDayAgo } }
    });
    if (expiredOrders.length > 0) {
      for (const order of expiredOrders) {
        order.status = 'created';
        order.executorId = null;
        await order.save();
        const customer = await User.findByPk(order.customerId, { attributes: ['email'] });
        if (customer?.email) {
          const html = getOrderRejectedTemplate(order);
          await sendEmail({
            to: customer.email,
            subject: `Статус заказа №${order.id} изменён`,
            html
          }).catch(err => console.error('Ошибка отправки email:', err));
        }
      }
      console.log(`[CLEANUP] Отклонено ${expiredOrders.length} заказов (не приняты 24 часа).`);
    }
  } catch (error) {
    console.error('[CLEANUP] Ошибка отклонения заказов:', error.message);
  }
}

module.exports = { deactivateExpiredSessions, rejectExpiredOrders };