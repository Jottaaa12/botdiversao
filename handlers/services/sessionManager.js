const roletaRussaGames = new Map();
const forcaGames = new Map();
const joinInProgress = new Map();
const autoRespostaSteps = new Map();
const agendamentoSteps = new Map();
const listaHorarioSteps = new Map();
const listaAberturaSteps = new Map();
const rifaCreationSteps = new Map();
const rifaConfirmationSteps = new Map();
const pedidosCasamento = new Map();
const messageStore = new Map();
const commandDeduplication = new Map();
const txpvConfirmations = new Map();

// Helper para obter a sessão ativa de qualquer tipo (para o middleware)
function getInteractiveSession(userId) {
    if (autoRespostaSteps.has(userId)) return { type: 'autoresposta', data: autoRespostaSteps.get(userId), map: autoRespostaSteps };
    if (agendamentoSteps.has(userId)) return { type: 'agendar', data: agendamentoSteps.get(userId), map: agendamentoSteps };
    if (listaHorarioSteps.has(userId)) return { type: 'lista_horario', data: listaHorarioSteps.get(userId), map: listaHorarioSteps };
    if (listaAberturaSteps.has(userId)) return { type: 'lista_abertura', data: listaAberturaSteps.get(userId), map: listaAberturaSteps };
    if (rifaCreationSteps.has(userId)) return { type: 'rifa', data: rifaCreationSteps.get(userId), map: rifaCreationSteps };
    if (rifaConfirmationSteps.has(userId)) return { type: 'rifa_confirmation', data: rifaConfirmationSteps.get(userId), map: rifaConfirmationSteps };
    if (txpvConfirmations.has(userId)) return { type: 'txpv', data: txpvConfirmations.get(userId), map: txpvConfirmations };
    // Adicionar outros se necessário
    return null;
}

module.exports = {
    roletaRussaGames,
    forcaGames,
    joinInProgress,
    autoRespostaSteps,
    agendamentoSteps,
    listaHorarioSteps,
    listaAberturaSteps,
    rifaCreationSteps,
    rifaConfirmationSteps,
    pedidosCasamento,
    messageStore,
    commandDeduplication,
    txpvConfirmations,
    getInteractiveSession
};
