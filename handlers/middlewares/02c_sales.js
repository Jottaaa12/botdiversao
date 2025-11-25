const { parseSaleMessage, parseClosingMessage } = require('../../services/salesService');

module.exports = async (context, next) => {
    const { message, db, senderJid } = context;

    if (message) {
        // Venda
        const saleData = parseSaleMessage(message);
        if (saleData) {
            try {
                // Precisamos do ID do usuário no banco
                let usuario = db.user.obterUsuario(senderJid);
                if (!usuario) {
                    db.user.salvarUsuario(senderJid, context.msg.pushName || null, []);
                    usuario = db.user.obterUsuario(senderJid);
                }

                db.financial.salvarVenda(
                    saleData.cliente,
                    saleData.pedidoId,
                    saleData.dataHora,
                    saleData.itens,
                    saleData.formaPagamento,
                    saleData.valorPago,
                    saleData.troco,
                    saleData.totalGeral,
                    usuario.id
                );
                console.log(`[Sales] Venda registrada: ${saleData.pedidoId}`);
            } catch (error) {
                console.error('[Sales] Erro ao salvar venda:', error);
            }
        }

        // Fechamento
        const closingData = parseClosingMessage(message);
        if (closingData) {
            try {
                let usuario = db.user.obterUsuario(senderJid);
                if (!usuario) {
                    db.user.salvarUsuario(senderJid, context.msg.pushName || null, []);
                    usuario = db.user.obterUsuario(senderJid);
                }

                db.financial.salvarFechamentoCaixa(
                    closingData.data,
                    closingData.operador,
                    closingData.horarioInicio,
                    closingData.horarioFim,
                    closingData.sessao,
                    closingData.vendasDinheiro,
                    closingData.qtdVendasDinheiro,
                    closingData.vendasPix,
                    closingData.qtdVendasPix,
                    closingData.totalVendas,
                    closingData.acaiVendido,
                    closingData.movimentacoes,
                    closingData.totalGeral,
                    closingData.fiados,
                    closingData.saldoInicial,
                    closingData.valorEsperado,
                    closingData.valorContado,
                    closingData.diferenca,
                    closingData.tipoDiferenca,
                    usuario.id
                );
                console.log(`[Sales] Fechamento registrado: ${closingData.data}`);
            } catch (error) {
                console.error('[Sales] Erro ao salvar fechamento:', error);
            }
        }
    }

    await next();
};
