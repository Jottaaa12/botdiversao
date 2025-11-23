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

function execute({ args }) {
    // Comando /vendas_dia DD/MM/YYYY
    const partes = args[0].split('/');
    if (partes.length !== 3) {
        return 'Uso: /vendas_dia DD/MM/YYYY\nEx: /vendas_dia 15/11/2023';
    }

    const dia = partes[0].padStart(2, '0');
    const mes = partes[1].padStart(2, '0');
    const ano = partes[2];

    const dataBusca = `${ano}-${mes}-${dia}`;
    const todasVendas = db.financial.obterTodasVendas();
    const vendas = todasVendas.filter(v => {
        const vendaDate = extractDateFromDataHora(v.data_hora);
        return vendaDate === dataBusca;
    });

    if (vendas.length === 0) {
        return `Nenhuma venda registrada para ${dia}/${mes}/${ano}.`;
    }

    let resposta = `📊 VENDAS DO DIA ${dia}/${mes}/${ano}:\n\n`;
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
    name: 'vendas_dia',
    description: 'Mostra um relatório de todas as vendas registradas em um dia específico.',
    category: 'adm',
    permission: 'admin',
    execute,
};
