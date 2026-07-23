const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { BOT_VERSION } = require('../config/version');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra os comandos e recursos disponíveis'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('Ajuda do Atlas Bot')
      .setDescription(`Comandos e recursos disponíveis • ${BOT_VERSION}`)
      .addFields(
        {
          name: 'Jogadores',
          value: [
            '`/jogadores` abre a busca de jogadores especiais.',
            '• Buscar por seleção e visualizar os jogadores disponíveis.',
            '• Buscar posição em todas as seleções.',
            '• Buscar por OVR global usando MIN e MAX.',
            '• Paginar resultados e iniciar uma nova busca pela lupa.',
            '• Ao informar apenas MIN, o MAX padrão é 120.',
            '• Ao informar apenas MAX, o MIN padrão é 50.'
          ].join('\n')
        },
        {
          name: 'Música',
          value: [
            '`/play musica:<nome ou link>` toca ou adiciona uma música à fila.',
            '`/queue` mostra a música atual e as próximas da fila.',
            '`/skip` pula a música atual.',
            '`/stop` limpa a fila e desconecta o bot.',
            'Os comandos de música exigem que você esteja em um canal de voz.'
          ].join('\n')
        }
      )
      .setFooter({ text: 'Atlas Bot' });

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
