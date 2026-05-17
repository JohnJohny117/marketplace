const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Marketplace',
      version: '1.0.0',
    },
    // можно добавить теги здесь, но они автоматически соберутся из YAML
  },
  apis: ['./swagger/**/*.yaml'], // читаем все YAML-файлы в папке swagger
};

const specs = swaggerJsdoc(options);

module.exports = (app) => {
  app.use('/doc', swaggerUi.serve, swaggerUi.setup(specs));
};