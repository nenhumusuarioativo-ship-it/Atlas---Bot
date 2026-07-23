const errorCodes = {
  COMMAND_EXECUTION: 100,
  INVALID_SCOPE: 101,
  INVALID_POSITION: 102,
  INVALID_OVR_RANGE: 103,
  EMPTY_SEARCH_RESULT: 104,
  PAGINATION_FAILURE: 105,
  INTERACTION_RESPONSE_FAILURE: 106,
  OVR_SEARCH_FAILURE: 107
};

function formatError(code, message) {
  return `${code} - ${message}`;
}

function logError(code, context, error, details = '') {
  const suffix = details ? ` ${details}` : '';
  console.error(`[Erro ${code}] ${context}.${suffix}`, error?.stack || error || 'Sem detalhes');
}

module.exports = {
  errorCodes,
  formatError,
  logError
};
