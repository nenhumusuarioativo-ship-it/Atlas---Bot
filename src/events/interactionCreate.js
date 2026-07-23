const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const {
  specialsData,
  teamNamesPT,
  teamFlags,
  getPlayerPosition,
  playerMatchesPosition,
  playerMatchesOvr,
  searchPositions
} = require('../data/database');
const { buildScopeSelectionRow } = require('../commands/jogadores');
const { errorCodes, formatError, logError } = require('../data/errorCodes');
const { BOT_VERSION } = require('../config/version');

function buildPaginationRow(mode, scopeValue, selectedFilter, currentPage, totalPages) {
  const prevPage = Math.max(0, currentPage - 1);
  const nextPage = Math.min(totalPages - 1, currentPage + 1);
  const prevButton = new ButtonBuilder()
    .setCustomId(`page_result:${mode}:${encodeURIComponent(scopeValue)}:${encodeURIComponent(selectedFilter)}:${prevPage}:prev`)
    .setLabel('<')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === 0 || totalPages <= 1);

  const nextButton = new ButtonBuilder()
    .setCustomId(`page_result:${mode}:${encodeURIComponent(scopeValue)}:${encodeURIComponent(selectedFilter)}:${nextPage}:next`)
    .setLabel('>')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages - 1 || totalPages <= 1);

  const searchButton = new ButtonBuilder()
    .setCustomId(`search_again:${mode}`)
    .setLabel('🔍')
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder().addComponents(prevButton, nextButton, searchButton);
}

function buildPositionSelectionRow() {
  const positionMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_position_global:${BOT_VERSION}`)
    .setPlaceholder('Posição')
    .addOptions(searchPositions.map((position) => ({
      label: position,
      value: position,
      description: `Buscar ${position} em todas as seleções`
    })));

  return new ActionRowBuilder().addComponents(positionMenu);
}

function buildOvrSearchModal() {
  const minimumOvr = new TextInputBuilder()
    .setCustomId('ovr_min')
    .setLabel('OVR MIN')
    .setPlaceholder('Ex.: 105')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMinLength(1)
    .setMaxLength(3);
  const maximumOvr = new TextInputBuilder()
    .setCustomId('ovr_max')
    .setLabel('OVR MAX')
    .setPlaceholder('Ex.: 110')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMinLength(1)
    .setMaxLength(3);

  return new ModalBuilder()
    .setCustomId('search_ovr_modal')
    .setTitle('Buscar jogadores por OVR')
    .addComponents(
      new ActionRowBuilder().addComponents(minimumOvr),
      new ActionRowBuilder().addComponents(maximumOvr)
    );
}

function getPlayersForContext(mode, scopeValue, selectedFilter) {
  const playersList = [];
  const years = Object.keys(specialsData).sort((a, b) => Number(a) - Number(b));

  if (mode === 'global' || mode === 'ovr') {
    for (const year of years) {
      for (const [teamKey, teamData] of Object.entries(specialsData[year])) {
        if (!teamData) continue;

        for (const [playerKey, player] of Object.entries(teamData)) {
          const matchesFilter = mode === 'ovr'
            ? playerMatchesOvr(player, ...selectedFilter.split('-').map(Number))
            : playerMatchesPosition(player, selectedFilter);

          if (matchesFilter) {
            playersList.push({ year, teamKey, playerKey, ...player });
          }
        }
      }
    }
  } else {
    for (const year of years) {
      const teamData = specialsData[year][scopeValue];
      if (!teamData) continue;

      for (const [playerKey, player] of Object.entries(teamData)) {
        const matchesFilter = mode === 'ovr'
          ? playerMatchesOvr(player, ...selectedFilter.split('-').map(Number))
          : true;

        if (matchesFilter) playersList.push({ year, playerKey, ...player });
      }
    }
  }

  return playersList;
}

function buildResultEmbeds(playersList, mode, scopeValue) {
  return playersList.slice(0, 10).map((player) => {
    const position = getPlayerPosition(player);
    const teamName = mode === 'global' ? (teamNamesPT[player.teamKey] || player.teamKey) : null;
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({ name: player.playerKey })
      .setTitle(`${player.year} • ${mode === 'global' ? `${teamName} • ` : ''}${player.tier}`)
      .addFields(
        { name: 'Posição', value: position, inline: true },
        { name: 'OVR', value: `${player.ovr}`, inline: true }
      );

    if (player.imageUrl && !player.imageUrl.includes('URL_DA_FOTO_AQUI')) {
      embed.setThumbnail(player.imageUrl);
    }

    return embed;
  });
}

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        logError(errorCodes.COMMAND_EXECUTION, `Falha no comando ${interaction.commandName}`, error);

        const response = {
          content: formatError(errorCodes.COMMAND_EXECUTION, 'Ocorreu um erro ao executar este comando. Tente novamente mais tarde.')
        };

        if (interaction.deferred || interaction.replied) {
          try {
            await interaction.editReply(response);
          } catch (editError) {
            console.error('Não foi possível editar a resposta da interação:', editError);
          }
        } else {
          try {
            await interaction.reply(response);
          } catch (replyError) {
            console.error('Não foi possível responder à interação:', replyError);
          }
        }
      }
    }

    if (interaction.isStringSelectMenu()
      && (interaction.customId === 'select_scope' || interaction.customId === `select_scope:${BOT_VERSION}`)) {
      try {
        const selectedScope = String(interaction.values[0] || '').trim();

        if (selectedScope === 'search_ovr') {
          return interaction.showModal(buildOvrSearchModal());
        }

        await interaction.deferUpdate();

        if (selectedScope === 'all_teams') {
          return interaction.editReply({
            content: 'Escolha a posição para buscar em todas as seleções.',
            components: [buildPositionSelectionRow()],
            embeds: []
          });
        }

        const selectedTeam = selectedScope;
        const teamExists = Object.values(specialsData).some((yearData) => yearData[selectedTeam]);

        if (!teamExists) {
          logError(
            errorCodes.INVALID_SCOPE,
            'Seleção recebida não existe nos dados',
            null,
            `valor_recebido=${JSON.stringify(selectedScope)}`
          );
          return interaction.editReply({
            content: formatError(errorCodes.INVALID_SCOPE, 'A seleção escolhida não está disponível. Tente novamente.'),
            components: [buildScopeSelectionRow()],
            embeds: []
          });
        }

        const teamName = teamNamesPT[selectedTeam] || selectedTeam;
        const playersList = getPlayersForContext('team', selectedTeam, 'all');

        if (!playersList.length) {
          return interaction.editReply({
            content: `Nenhum jogador especial encontrado para ${teamName}.`,
            embeds: []
          });
        }

        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(playersList.length / pageSize));
        const page = 0;
        const pagePlayers = playersList.slice(page * pageSize, (page + 1) * pageSize);
        const embeds = buildResultEmbeds(pagePlayers, 'team', selectedTeam);
        const paginationRow = buildPaginationRow('team', selectedTeam, 'all', page, totalPages);

        await interaction.editReply({
          content: `**Jogadores da seleção ${teamName} ${teamFlags[selectedTeam] || ''}**\nPágina 1/${totalPages}`,
          components: [paginationRow],
          embeds
        });
      } catch (error) {
        logError(errorCodes.INTERACTION_RESPONSE_FAILURE, 'Falha ao processar seleção de escopo', error);

        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: formatError(errorCodes.INTERACTION_RESPONSE_FAILURE, 'Falha ao carregar o resultado da busca.'),
              components: [],
              embeds: []
            });
          } else {
            await interaction.reply({
              content: formatError(errorCodes.INTERACTION_RESPONSE_FAILURE, 'Falha ao carregar o resultado da busca.'),
              flags: 64
            });
          }
        } catch (replyError) {
          console.error('Não foi possível informar a falha da busca:', replyError?.stack || replyError);
        }
      }
    }

    if (interaction.isStringSelectMenu()
      && (interaction.customId === 'select_position_global'
        || interaction.customId === `select_position_global:${BOT_VERSION}`)) {
      try {
        await interaction.deferUpdate();
        const selectedPosition = interaction.values[0];

        if (!searchPositions.includes(selectedPosition)) {
          return interaction.editReply({
            content: formatError(errorCodes.INVALID_POSITION, 'A posição escolhida não está disponível. Tente novamente.'),
            components: [buildPositionSelectionRow()],
            embeds: []
          });
        }

        const playersList = getPlayersForContext('global', null, selectedPosition);

        if (!playersList.length) {
          return interaction.editReply({
            content: `Nenhum jogador encontrado para a posição ${selectedPosition}.`,
            embeds: []
          });
        }

        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(playersList.length / pageSize));
        const page = 0;
        const pagePlayers = playersList.slice(page * pageSize, (page + 1) * pageSize);
        const embeds = buildResultEmbeds(pagePlayers, 'global', selectedPosition);
        const paginationRow = buildPaginationRow('global', 'all_teams', selectedPosition, page, totalPages);

        await interaction.editReply({
          content: `**Busca por posição:** ${selectedPosition}\nPágina 1/${totalPages}`,
          components: [paginationRow],
          embeds
        });
      } catch (error) {
        logError(errorCodes.INTERACTION_RESPONSE_FAILURE, 'Falha ao processar busca global por posição', error);

        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: formatError(errorCodes.INTERACTION_RESPONSE_FAILURE, 'Falha ao aplicar a busca por posição.'),
              components: [],
              embeds: []
            });
          } else {
            await interaction.reply({
              content: formatError(errorCodes.INTERACTION_RESPONSE_FAILURE, 'Falha ao aplicar a busca por posição.'),
              flags: 64
            });
          }
        } catch (replyError) {
          console.error('Não foi possível informar a falha da busca global:', replyError?.stack || replyError);
        }
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'search_ovr_modal') {
      try {
        const minimumValue = interaction.fields.getTextInputValue('ovr_min').trim();
        const maximumValue = interaction.fields.getTextInputValue('ovr_max').trim();
        const minimumOvr = minimumValue ? Number(minimumValue) : 50;
        const maximumOvr = maximumValue ? Number(maximumValue) : 120;

        if (!Number.isInteger(minimumOvr) || !Number.isInteger(maximumOvr)
          || minimumOvr < 1 || maximumOvr > 200 || minimumOvr > maximumOvr) {
          return interaction.reply({
            content: formatError(errorCodes.INVALID_OVR_RANGE, 'Informe um intervalo de OVR válido entre 1 e 200.'),
            flags: 64
          });
        }

        await interaction.deferReply({ flags: 64 });
        const selectedOvr = `${minimumOvr}-${maximumOvr}`;
        const playersList = getPlayersForContext('ovr', null, selectedOvr);

        if (!playersList.length) {
          return interaction.editReply({
            content: formatError(errorCodes.EMPTY_SEARCH_RESULT, `Nenhum jogador encontrado entre OVR ${minimumOvr} e ${maximumOvr}.`)
          });
        }

        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(playersList.length / pageSize));
        const embeds = buildResultEmbeds(playersList.slice(0, pageSize), 'global', null);
        const paginationRow = buildPaginationRow('ovr', 'all_teams', selectedOvr, 0, totalPages);

        return interaction.editReply({
          content: `**Busca por OVR:** ${minimumOvr} a ${maximumOvr}\nPágina 1/${totalPages}`,
          components: [paginationRow],
          embeds
        });
      } catch (error) {
        logError(errorCodes.OVR_SEARCH_FAILURE, 'Falha ao processar busca por OVR', error);
        return interaction.reply({ content: formatError(errorCodes.OVR_SEARCH_FAILURE, 'Falha ao aplicar a busca por OVR.'), flags: 64 });
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('search_again')) {
      try {
        await interaction.deferUpdate();

        await interaction.editReply({
          content: `Escolha uma opção para pesquisar jogadores. - ${BOT_VERSION}`,
          components: [buildScopeSelectionRow()],
          embeds: []
        });
      } catch (error) {
        logError(errorCodes.INTERACTION_RESPONSE_FAILURE, 'Falha ao abrir nova busca', error);
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('page_result:')) {
      try {
        await interaction.deferUpdate();
        const [_, mode, encodedScope, encodedPosition, targetPage] = interaction.customId.split(':');
        const scopeValue = decodeURIComponent(encodedScope || 'all_teams');
        const selectedFilter = decodeURIComponent(encodedPosition || 'all');
        const page = Number(targetPage || 0);
        const playersList = getPlayersForContext(mode, scopeValue === 'all_teams' ? null : scopeValue, selectedFilter);

        if (!playersList.length) {
          return interaction.editReply({
            content: formatError(errorCodes.EMPTY_SEARCH_RESULT, 'Nenhum jogador encontrado para esta página.'),
            embeds: []
          });
        }

        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(playersList.length / pageSize));
        const safePage = Math.min(Math.max(0, page), totalPages - 1);
        const pagePlayers = playersList.slice(safePage * pageSize, (safePage + 1) * pageSize);
        const embeds = buildResultEmbeds(pagePlayers, mode, scopeValue === 'all_teams' ? null : scopeValue);
        const paginationRow = buildPaginationRow(mode, scopeValue === 'all_teams' ? 'all_teams' : scopeValue, selectedFilter, safePage, totalPages);

        let content = '';
        if (mode === 'global' || mode === 'ovr') {
          content = mode === 'ovr'
            ? `**Busca por OVR:** ${selectedFilter.replace('-', ' a ')}\nPágina ${safePage + 1}/${totalPages}`
            : `**Busca por posição:** ${selectedFilter}\nPágina ${safePage + 1}/${totalPages}`;
        } else {
          const teamName = teamNamesPT[scopeValue] || scopeValue;
          content = `**Jogadores da seleção ${teamName} ${teamFlags[scopeValue] || ''}**\nPágina ${safePage + 1}/${totalPages}`;
        }

        await interaction.editReply({
          content,
          components: [paginationRow],
          embeds
        });
      } catch (error) {
        logError(errorCodes.PAGINATION_FAILURE, 'Falha ao navegar pelas páginas', error);

        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: formatError(errorCodes.PAGINATION_FAILURE, 'Falha ao navegar pelas páginas.'),
              embeds: []
            });
          } else {
            await interaction.reply({
              content: formatError(errorCodes.PAGINATION_FAILURE, 'Falha ao navegar pelas páginas.'),
              flags: 64
            });
          }
        } catch (replyError) {
          logError(
            errorCodes.INTERACTION_RESPONSE_FAILURE,
            'Não foi possível informar a falha da paginação',
            replyError
          );
        }
      }
    }
  }
};
