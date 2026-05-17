// Шаблон для уведомления о создании заказа (получатель – заказчик)
function getOrderCreatedTemplate(order) {
    return `
        <h1>Заказ №${order.id} успешно создан!</h1>
        <p>Вы можете отслеживать его статус в личном кабинете.</p>
    `;
}

// Функция для преобразования статуса из БД в читаемый вид
function formatStatus(status) {
  const statusMap = {
    'created': 'Создан',
    'assigned': 'Назначен',
    'cancelled': 'Отменен',
    'progress': 'В работе',
    'completed': 'Завершен',
    'rated': 'Оценен'
  };
  return statusMap[status] || status; // если статус не найден, возвращаем как есть
}

// Шаблон для уведомления об изменении статуса заказа (получатель – заказчик)
function getOrderStatusUpdateTemplate(order,newStatus) {
    return `
        <h1>Статус заказа №${order.id} изменен</h1>
        <p>Статус вашего заказа изменился на <strong>${newStatus}</strong>.</p>
        <p>Описание: ${order.description}</p>
    `;
}

// Шаблон для уведомления о назначении заказа (получатель – исполнитель)
function getOrderAssignedTemplate(order) {
    return `
        <h1>Вам назначен заказ №${order.id}!</h1>
        <p>Зайдите в личный кабинет для просмотра заказа</p>
        <p>Описание: ${order.description}</p>
    `;
}

// Шаблон для уведомления об отклонении исполнителем заказа (получатель – заказчик)
function getOrderRejectedTemplate(order) {
    return `
        <h1>Статус заказа №${order.id} изменен</h1>
        <p>Исполнитель отказался от исполнения заказа</p>
        <p>Описание: ${order.description}</p>
    `;
}

// Шаблон для уведомления об оценке заказа (получатель – исполнитель)
// Параметры: order, score (оценка), review (отзыв, может быть null)
function getOrderRatedTemplate(order, score, review) {
    // Если отзыв есть – выводим его, иначе сообщаем, что отзыв не оставлен
    const reviewText = review ? `<p>Отзыв: "${review}"</p>` : '<p>Отзыв не оставлен.</p>';
    return `
        <h1>Заказ №${order.id} оценён!</h1>
        <p>Заказчик оценил вашу работу на <strong>${score} из 5</strong>.</p>
        ${reviewText}
        <p>Спасибо за сотрудничество!</p>
    `;
}

// Экспорт всех шаблонов для использования в других модулях
module.exports = { getOrderCreatedTemplate, getOrderStatusUpdateTemplate, getOrderRatedTemplate, getOrderRejectedTemplate, getOrderAssignedTemplate, formatStatus};