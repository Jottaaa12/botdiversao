// Função para converter formato de data DD/MM/YYYY HH:MM para YYYY-MM-DD HH:MM
function convertDateFormat(dateStr) {
    // "16/11/2025 19:55" -> "2025-11-16 19:55"
    const parts = dateStr.split(' ');
    if (parts.length === 2) {
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
            return `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')} ${parts[1]}`;
        }
    }
    return dateStr; // fallback
}

// Função para parsear mensagem de venda
function parseSaleMessage(message) {
    if (!message.includes('VENDA REALIZADA')) {
        return null;
    }

    const lines = message.split('\n');
    let cliente = '';
    let pedidoId = null;
    let dataHora = '';
    let itens = [];
    let formaPagamento = '';
    let valorPago = 0;
    let troco = 0;
    let totalGeral = 0;

    let currentSection = '';

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.includes('Cliente:')) {
            const index = trimmed.indexOf('Cliente:') + 'Cliente:'.length;
            cliente = trimmed.substring(index).trim().replace(/^\*|\*$/g, '').trim();
        } else if (trimmed.includes('Pedido:')) {
            const index = trimmed.indexOf('Pedido:') + 'Pedido:'.length;
            pedidoId = parseInt(trimmed.substring(index).trim().replace(/^\*|\*$/g, '').trim());
        } else if (trimmed.includes('Data/Hora:')) {
            const index = trimmed.indexOf('Data/Hora:') + 'Data/Hora:'.length;
            dataHora = trimmed.substring(index).trim().replace(/^\*|\*$/g, '').trim();
        } else if (trimmed.includes('ITENS')) {
            currentSection = 'itens';
        } else if (trimmed.includes('PAGAMENTO')) {
            currentSection = 'pagamento';
        } else if (trimmed.includes('TOTAL GERAL:')) {
            const index = trimmed.indexOf('TOTAL GERAL:') + 'TOTAL GERAL:'.length;
            const totalStr = trimmed.substring(index).replace('R$', '').trim().replace(/^\*|\*$/g, '').trim();
            totalGeral = parseFloat(totalStr.replace(',', '.'));
        } else if (currentSection === 'itens' && trimmed.startsWith('-')) {
            // Parse item: "AÇAI NO KG (0.248 kg) - R$ 12.40"
            const itemText = trimmed.substring(1).trim();
            const parts = itemText.split(' - R$ ');
            if (parts.length === 2) {
                const descricao = parts[0].trim();
                const preco = parseFloat(parts[1].replace(',', '.'));
                itens.push({ descricao, preco });
            }
        } else if (currentSection === 'pagamento') {
            if (trimmed.includes('Forma:')) {
                const index = trimmed.indexOf('Forma:') + 'Forma:'.length;
                formaPagamento = trimmed.substring(index).trim().replace(/^\*|\*$/g, '').trim();
            } else if (trimmed.includes('Valor Pago:')) {
                const index = trimmed.indexOf('Valor Pago:') + 'Valor Pago:'.length;
                const valorStr = trimmed.substring(index).replace('R$', '').trim().replace(/^\*|\*$/g, '').trim();
                valorPago = parseFloat(valorStr.replace(',', '.'));
            } else if (trimmed.includes('Troco:')) {
                const index = trimmed.indexOf('Troco:') + 'Troco:'.length;
                const trocoStr = trimmed.substring(index).replace('R$', '').trim().replace(/^\*|\*$/g, '').trim();
                troco = parseFloat(trocoStr.replace(',', '.'));
            }
        }
    }

    // Validar se todos os campos essenciais foram encontrados
    if (!cliente || !pedidoId || !dataHora || itens.length === 0 || !formaPagamento || totalGeral === 0) {
        return null;
    }

    // Converter formato da data para YYYY-MM-DD HH:MM
    dataHora = convertDateFormat(dataHora);

    return {
        cliente,
        pedidoId,
        dataHora,
        itens,
        formaPagamento,
        valorPago,
        troco,
        totalGeral
    };
}

// Função para parsear mensagem de fechamento de caixa
function parseClosingMessage(message) {
    if (!message.includes('❌ FECHAMENTO DE CAIXA ❌')) {
        return null;
    }

    const lines = message.split('\n');
    let data = '';
    let operador = '';
    let horarioInicio = '';
    let horarioFim = '';
    let sessao = '';
    let vendasDinheiro = 0;
    let qtdVendasDinheiro = 0;
    let vendasPix = 0;
    let qtdVendasPix = 0;
    let totalVendas = 0;
    let acaiVendido = 0;
    let movimentacoes = [];
    let totalGeral = 0;
    let fiados = [];
    let saldoInicial = 0;
    let valorEsperado = 0;
    let valorContado = 0;
    let diferenca = 0;
    let tipoDiferenca = '';

    let currentSection = '';

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('📅 Data:')) {
            data = trimmed.replace('📅 Data:', '').trim();
        } else if (trimmed.startsWith('👤 Operador:')) {
            operador = trimmed.replace('👤 Operador:', '').trim();
        } else if (trimmed.startsWith('🕐 Horário:')) {
            const horarioStr = trimmed.replace('🕐 Horário:', '').trim();
            const partes = horarioStr.split(' às ');
            if (partes.length === 2) {
                horarioInicio = partes[0].trim();
                horarioFim = partes[1].trim();
            }
        } else if (trimmed.startsWith('🆔 Sessão:')) {
            sessao = trimmed.replace('🆔 Sessão:', '').trim();
        } else if (trimmed.startsWith('VENDAS REALIZADAS:')) {
            currentSection = 'vendas';
        } else if (trimmed.startsWith('💰 TOTAL DAS VENDAS:')) {
            const totalStr = trimmed.replace('💰 TOTAL DAS VENDAS:', '').replace('R$', '').trim();
            totalVendas = parseFloat(totalStr.replace(',', '.'));
        } else if (trimmed.startsWith('⚖ Açaí Vendido:')) {
            const acaiStr = trimmed.replace('⚖ Açaí Vendido:', '').replace('kg', '').trim();
            acaiVendido = parseFloat(acaiStr.replace(',', '.'));
        } else if (trimmed.startsWith('💸 MOVIMENTAÇÕES DE CAIXA:')) {
            currentSection = 'movimentacoes';
        } else if (trimmed.startsWith('💵 TOTAL GERAL')) {
            currentSection = 'total_geral';
        } else if (trimmed.startsWith('📝 FIADO (CRÉDITO):')) {
            currentSection = 'fiados';
        } else if (trimmed.startsWith('💵 RESUMO FINAL:')) {
            currentSection = 'resumo';
        } else if (currentSection === 'vendas' && trimmed.startsWith('• Dinheiro:')) {
            const dinheiroStr = trimmed.replace('• Dinheiro:', '').replace('R$', '').trim();
            const partes = dinheiroStr.split('(');
            if (partes.length === 2) {
                vendasDinheiro = parseFloat(partes[0].trim().replace(',', '.'));
                qtdVendasDinheiro = parseInt(partes[1].replace('vendas)', '').trim());
            }
        } else if (currentSection === 'vendas' && trimmed.startsWith('• PIX:')) {
            const pixStr = trimmed.replace('• PIX:', '').replace('R$', '').trim();
            const partes = pixStr.split('(');
            if (partes.length === 2) {
                vendasPix = parseFloat(partes[0].trim().replace(',', '.'));
                qtdVendasPix = parseInt(partes[1].replace('vendas)', '').trim());
            }
        } else if (currentSection === 'movimentacoes' && trimmed.startsWith('•')) {
            const movText = trimmed.substring(1).trim();
            if (movText !== 'Nenhuma movimentação registrada.') {
                movimentacoes.push({ descricao: movText });
            }
        } else if (currentSection === 'total_geral' && trimmed.includes('Vendas ± Movimentações):')) {
            const totalStr = trimmed.split(':')[1].replace('R$', '').trim();
            totalGeral = parseFloat(totalStr.replace(',', '.'));
        } else if (currentSection === 'fiados' && trimmed.startsWith('•')) {
            const fiadoText = trimmed.substring(1).trim();
            const partes = fiadoText.split(': R$ ');
            if (partes.length === 2) {
                const cliente = partes[0].trim();
                const valor = parseFloat(partes[1].replace(',', '.'));
                fiados.push({ cliente, valor });
            }
        } else if (currentSection === 'resumo' && trimmed.startsWith('• Saldo Inicial:')) {
            const saldoStr = trimmed.replace('• Saldo Inicial:', '').replace('R$', '').trim();
            saldoInicial = parseFloat(saldoStr.replace(',', '.'));
        } else if (currentSection === 'resumo' && trimmed.startsWith('• Valor Esperado:')) {
            const esperadoStr = trimmed.replace('• Valor Esperado:', '').replace('R$', '').trim();
            valorEsperado = parseFloat(esperadoStr.replace(',', '.'));
        } else if (currentSection === 'resumo' && trimmed.startsWith('• Valor Contado:')) {
            const contadoStr = trimmed.replace('• Valor Contado:', '').replace('R$', '').trim();
            valorContado = parseFloat(contadoStr.replace(',', '.'));
        } else if (currentSection === 'resumo' && trimmed.startsWith('⚠ Diferença:')) {
            const diferencaStr = trimmed.replace('⚠ Diferença:', '').trim();
            if (diferencaStr.includes('Sobra:')) {
                tipoDiferenca = 'sobra';
                const valorStr = diferencaStr.replace('Sobra:', '').replace('+R$', '').trim();
                diferenca = parseFloat(valorStr.replace(',', '.'));
            } else if (diferencaStr.includes('Falta:')) {
                tipoDiferenca = 'falta';
                const valorStr = diferencaStr.replace('Falta:', '').replace('-R$', '').trim();
                diferenca = -parseFloat(valorStr.replace(',', '.'));
            }
        }
    }

    // Validar se todos os campos essenciais foram encontrados
    if (!data || !operador || !sessao || totalVendas === 0) {
        return null;
    }

    return {
        data,
        operador,
        horarioInicio,
        horarioFim,
        sessao,
        vendasDinheiro,
        qtdVendasDinheiro,
        vendasPix,
        qtdVendasPix,
        totalVendas,
        acaiVendido,
        movimentacoes,
        totalGeral,
        fiados,
        saldoInicial,
        valorEsperado,
        valorContado,
        diferenca,
        tipoDiferenca
    };
}

module.exports = { parseSaleMessage, parseClosingMessage };
