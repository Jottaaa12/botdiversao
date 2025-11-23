const db = require('../database');
const { generateFinancialReport } = require('../services/geminiService');

function verificarAlertas(dados) {
    const alertas = [];
    const categorias = {};

    // Agrupar por categoria
    dados.forEach(d => {
        if (!categorias[d.categoria]) {
            categorias[d.categoria] = [];
        }
        categorias[d.categoria].push(d.valor);
    });

    // Verificar anomalias para cada categoria
    Object.keys(categorias).forEach(cat => {
        const valores = categorias[cat].sort((a, b) => a - b);
        if (valores.length >= 3) {
            const media = valores.reduce((a, b) => a + b, 0) / valores.length;
            const ultimo = valores[valores.length - 1];
            const penultimo = valores[valores.length - 2];

            // Alerta se último valor é 20% menor que o penúltimo
            if (penultimo > 0 && ultimo < penultimo * 0.8) {
                alertas.push(`⚠️ ${cat}: Queda significativa de R$${penultimo} para R$${ultimo} (${((ultimo / penultimo - 1) * 100).toFixed(1)}%)`);
            }

            // Alerta se valor está abaixo da média
            if (ultimo < media * 0.7) {
                alertas.push(`⚠️ ${cat}: Valor atual R$${ultimo} está ${((media / ultimo - 1) * 100).toFixed(1)}% abaixo da média (R$${media.toFixed(2)})`);
            }
        }
    });

    return alertas;
}

async function execute({ args }) {
    // Comando /relatorio [periodo]
    const periodo = args[0] || null;

    let dados;
    if (periodo) {
        dados = db.financial.obterDadosFinanceirosPorPeriodo(periodo);
    } else {
        dados = db.financial.obterTodosDadosFinanceiros();
    }

    if (dados.length === 0) {
        return 'Nenhum dado financeiro encontrado para gerar relatório.';
    }

    // Verificar alertas antes de gerar relatório
    const alertas = verificarAlertas(dados);
    let resposta = '';
    if (alertas.length > 0) {
        resposta += '🚨 ALERTAS DETECTADOS:\n' + alertas.join('\n') + '\n\n';
    }

    // Gerar relatório com Gemini
    const relatorio = await generateFinancialReport(dados, periodo);
    resposta += relatorio;
    return resposta;
}

module.exports = {
    name: 'relatorio',
    description: 'Gera um relatório financeiro com base nos dados salvos, opcionalmente filtrando por período.',
    category: 'adm',
    permission: 'admin',
    execute,
};
