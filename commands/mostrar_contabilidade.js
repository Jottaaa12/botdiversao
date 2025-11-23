const db = require('../database');

function execute() {
    // Mostrar contabilidade do mês atual
    const mesAtual = new Date().toISOString().substring(0, 7);
    const contab = db.financial.obterContabilidadeMes(mesAtual);
    if (contab) {
        return `Contabilidade ${mesAtual}:\nVendas: R$${contab.vendas}\nCustos: R$${contab.custos}\nLucros: R$${contab.lucros}`;
    } else {
        return `Nenhum dado de contabilidade encontrado para ${mesAtual}.`;
    }
}

module.exports = {
    name: 'mostrar_contabilidade',
    description: 'Mostra os dados de contabilidade para o mês atual.',
    category: 'adm',
    permission: 'admin',
    execute,
    aliases: ['ver_contabilidade'],
};
