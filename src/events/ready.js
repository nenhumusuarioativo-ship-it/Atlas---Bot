const { Routes } = require('discord.js');
const { BOT_VERSION } = require('../config/version');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`Bot online como: ${client.user.tag} - ${BOT_VERSION}`);

    if (!client.rest || !client.commandsData) {
      console.warn('Não há dados de comandos ou REST configurados para registrar Slash Commands.');
      return;
    }

    try {
      await client.rest.put(Routes.applicationCommands(client.application?.id || client.user?.id), {
        body: client.commandsData
      });
      console.log('Comandos slash registrados com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar comandos slash:', error);
    }
  }
};
