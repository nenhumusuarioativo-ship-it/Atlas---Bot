const { ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder } = require('discord.js');
const { getTeamsWithYears, teamNamesPT, teamFlags } = require('../data/database');
const { BOT_VERSION } = require('../config/version');

function buildScopeSelectionRow() {
  const teamsMap = getTeamsWithYears();
  const options = [
    {
      label: 'Buscar por OVR',
      value: 'search_ovr',
      description: 'Pesquisar jogadores por OVR',
      emoji: '⭐'
    },
    {
      label: 'Todas as seleções',
      value: 'all_teams',
      description: 'Buscar uma posição em todas as seleções',
      emoji: '🌍'
    }
  ];

  for (const [teamKey, yearsSet] of Object.entries(teamsMap)) {
    const sortedYears = Array.from(yearsSet).sort((a, b) => a - b).join(', ');
    const label = teamNamesPT[teamKey] || teamKey;
    const emoji = teamFlags[teamKey] || '🏳️';

    options.push({
      label,
      value: teamKey,
      description: sortedYears.length > 50 ? `${sortedYears.substring(0, 47)}...` : sortedYears,
      emoji
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_scope:${BOT_VERSION}`)
    .setPlaceholder('Seleção ou busca global')
    .addOptions(options.slice(0, 25));

  return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jogadores')
    .setDescription('Exibe o menu de seleção dos jogadores especiais'),
  buildScopeSelectionRow,

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const row = buildScopeSelectionRow();

    await interaction.editReply({
      content: `Escolha uma opção para pesquisar jogadores. - ${BOT_VERSION}`,
      components: [row]
    });
  }
};
