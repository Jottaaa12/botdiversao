const db = require('../database');

// Função auxiliar para extrair a data no formato YYYY-MM-DD da data_hora
function extractDateFromDataHora(dataHora) {
    if (!dataHora) return null;

    // Verificar se já está no formato YYYY-MM-DD
    if (dataHora.startsWith(new Date().getFullYear().toString())) {
        return dataHora.split(' ')[0];
    }

    // Formato DD/MM/YYYY
    const parts = dataHora.split(' ');
    if (parts.length > 0) {
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const month = dateParts[1].padStart(2, '0');
            const year = dateParts[2];
            return `${year}-${month}-${day}`;
        }
    }

    return null;
}

function execute() {
    // Mostrar vendas de hoje
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hoje = `${year}-${month}-${day}`; // YYYY-MM-DD
    const todasVendas = db.obterTodasVendas();
    const vendas = todasVendas.filter(v => {
        const vendaDate = extractDateFromDataHora(v.data_hora);
        return vendaDate === hoje;
    });

    if (vendas.length === 0) {
        return `Nenhuma venda registrada para hoje (${hoje}).`;
    }

    let resposta = `📊 VENDAS DE HOJE (${hoje}):\n\n`;
    let totalDia = 0;

    vendas.forEach(venda => {
        resposta += `🆔 Pedido: ${venda.pedido_id}\n`;
        resposta += `👤 Cliente: ${venda.cliente}\n`;
        resposta += `💰 Total: R$ ${venda.total_geral.toFixed(2)}\n`;
        resposta += `💳 Pagamento: ${venda.forma_pagamento}\n`;
        resposta += `🗓 Hora: ${venda.data_hora.split(' ')[1] || venda.data_hora}\n\n`;
        totalDia += venda.total_geral;
    });

    resposta += `💵 TOTAL DO DIA: R$ ${totalDia.toFixed(2)}\n`;
    resposta += `📈 Quantidade de vendas: ${vendas.length}`;

    return resposta;
}

module.exports = {
    name: 'vendas_hoje',
    description: 'Mostra um relatório de todas as vendas registradas no dia de hoje.',
    category: 'adm',
    permission: 'admin',
    execute,
};
