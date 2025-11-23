const db = require('../database');

function execute() {
        // Mostrar relatório de fechamentos de caixa
        const fechamentos = db.financial.obterTodosFechamentos();

        if (fechamentos.length === 0) {
                return 'Nenhum fechamento de caixa registrado.';
        }

        // Ordenar por data decrescente
        fechamentos.sort((a, b) => new Date(b.data.split('/').reverse().join('-')) - new Date(a.data.split('/').reverse().join('-')));

        let resposta = `📋 RELATÓRIO DE FECHAMENTOS DE CAIXA:

`;

        fechamentos.forEach(fechamento => {
                resposta += `📅 Data: ${fechamento.data}
`;
                resposta += `👤 Operador: ${fechamento.operador}
`;
                resposta += `🆔 Sessão: ${fechamento.sessao}
`;
                resposta += `💰 Total Vendas: R$ ${fechamento.total_vendas.toFixed(2)}
`;
                resposta += `💵 Dinheiro: R$ ${fechamento.vendas_dinheiro.toFixed(2)} (${fechamento.qtd_vendas_dinheiro} vendas)
`;
                resposta += `📱 PIX: R$ ${fechamento.vendas_pix.toFixed(2)} (${fechamento.qtd_vendas_pix} vendas)
`;
                resposta += `⚖ Açaí Vendido: ${fechamento.acai_vendido.toFixed(3)} kg
`;
                resposta += `💵 Total Geral: R$ ${fechamento.total_geral.toFixed(2)}
`;
                if (fechamento.diferenca !== 0) {
                        resposta += `⚠ Diferença: ${fechamento.tipo_diferenca === 'sobra' ? '+' : '-'}R$ ${Math.abs(fechamento.diferenca).toFixed(2)}
`;
                }
                resposta += `
`;
        });

        return resposta;
}

module.exports = {
        name: 'relatorio_fechamentos',
        description: 'Mostra um relatório de todos os fechamentos de caixa registrados.',
        category: 'adm',
        permission: 'admin',
        execute,
        aliases: ['fechamentos'],
};
