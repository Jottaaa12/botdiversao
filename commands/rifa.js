const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Função auxiliar para gerar resumo da rifa
function gerarResumo(stepData) {
    let resumo = `📝 *RESUMO DA RIFA*
                    
🎟️ Título: ${stepData.data.titulo}
📱 Prêmio: ${stepData.data.premio}
🔢 Números: ${stepData.data.qtdNumeros}
💰 Preço: R$ ${stepData.data.preco.toFixed(2)}
🗓️ Sorteio: ${stepData.data.dataStr}`;

    if (stepData.data.grupoVinculado) {
        resumo += `\n🤝 Grupo: ${stepData.data.grupoVinculado.nome}`;
    } else {
        resumo += `\n🤝 Grupo: Nenhum`;
    }

    resumo += `\n\nTudo certo? Responda com *SIM* para criar ou *CANCELAR* para desistir.`;
    return resumo;
}

module.exports = {
    name: 'rifa',
    aliases: ['r'],
    category: 'admin',
    description: 'Gerenciar rifas (apenas admin)',
    permission: 'admin',

    async execute({ sock, msg, args, senderJid, chatJid, db, isGroup, prefixo, rifaCreationSteps, message }) {
        const subcomando = args[0]?.toLowerCase();

        // --- LÓGICA DE PASSOS INTERATIVOS ---
        if (rifaCreationSteps && rifaCreationSteps.has(senderJid)) {
            const stepData = rifaCreationSteps.get(senderJid);
            const input = message.trim();

            // Cancelar a qualquer momento
            if (input.toLowerCase() === 'cancelar') {
                rifaCreationSteps.delete(senderJid);
                return '❌ Criação de rifa cancelada.';
            }

            switch (stepData.step) {
                case 0: // Recebendo Título
                    stepData.data.titulo = input;
                    stepData.step = 1;
                    rifaCreationSteps.set(senderJid, stepData);
                    return '✅ Título definido!\n\nAgora, digite o *PRÊMIO* da rifa:';

                case 1: // Recebendo Prêmio
                    stepData.data.premio = input;
                    stepData.step = 2;
                    rifaCreationSteps.set(senderJid, stepData);
                    return '✅ Prêmio definido!\n\nAgora, digite a *QUANTIDADE DE NÚMEROS* (ex: 100):';

                case 2: // Recebendo Quantidade
                    const qtd = parseInt(input);
                    if (isNaN(qtd) || qtd <= 0) return '⚠️ Por favor, digite um número válido maior que zero.';
                    stepData.data.qtdNumeros = qtd;
                    stepData.step = 3;
                    rifaCreationSteps.set(senderJid, stepData);
                    return '✅ Quantidade definida!\n\nAgora, digite o *PREÇO DO NÚMERO* (ex: 10.00):';

                case 3: // Recebendo Preço
                    const preco = parseFloat(input.replace(',', '.'));
                    if (isNaN(preco) || preco <= 0) return '⚠️ Por favor, digite um valor válido (ex: 10.50).';
                    stepData.data.preco = preco;
                    stepData.step = 4;
                    rifaCreationSteps.set(senderJid, stepData);
                    return '✅ Preço definido!\n\nAgora, digite a *DATA DO SORTEIO* (formato: DD/MM/YYYY HH:mm):';

                case 4: // Recebendo Data
                    const [dataPart, horaPart] = input.split(' ');
                    if (!dataPart || !horaPart) return '⚠️ Formato inválido! Use DD/MM/YYYY HH:mm (ex: 25/12/2025 20:00).';

                    const [dia, mes, ano] = dataPart.split('/');
                    const [hora, min] = horaPart.split(':');

                    const dataSorteio = new Date(`${ano}-${mes}-${dia}T${hora}:${min}:00`);

                    if (isNaN(dataSorteio.getTime())) return '⚠️ Data inválida! Verifique o formato.';

                    stepData.data.dataSorteio = dataSorteio;
                    stepData.data.dataStr = input;
                    stepData.step = 5;
                    rifaCreationSteps.set(senderJid, stepData);

                    return '✅ Data definida!\n\n🤝 Deseja *VINCULAR UM GRUPO* a esta rifa?\n\nQuando você confirmar uma compra, o bot tentará adicionar o comprador automaticamente ao grupo.\n\nResponda com *S* para SIM ou *N* para NÃO:';

                case 5: // Pergunta sobre vínculo de grupo
                    if (input.toLowerCase() === 's' || input.toLowerCase() === 'sim') {
                        // Buscar grupos disponíveis
                        try {
                            const grupos = await sock.groupFetchAllParticipating();
                            const gruposArray = Object.values(grupos);

                            if (gruposArray.length === 0) {
                                stepData.data.grupoVinculado = null;
                                stepData.step = 7; // Pula para resumo
                                rifaCreationSteps.set(senderJid, stepData);
                                return '⚠️ Você não está em nenhum grupo. Continuando sem vínculo...\n\n' + gerarResumo(stepData);
                            }

                            // Salvar lista de grupos no stepData
                            stepData.data.gruposDisponiveis = gruposArray.map((g, idx) => ({
                                numero: idx + 1,
                                id: g.id,
                                nome: g.subject || 'Sem nome'
                            }));

                            stepData.step = 6;
                            rifaCreationSteps.set(senderJid, stepData);

                            let listaGrupos = '📋 *GRUPOS DISPONÍVEIS:*\n\n';
                            stepData.data.gruposDisponiveis.forEach(g => {
                                listaGrupos += `${g.numero}. ${g.nome}\n`;
                            });
                            listaGrupos += '\n💬 Digite o *NÚMERO* do grupo que deseja vincular:';

                            return listaGrupos;
                        } catch (error) {
                            console.error('Erro ao buscar grupos:', error);
                            stepData.data.grupoVinculado = null;
                            stepData.step = 7;
                            rifaCreationSteps.set(senderJid, stepData);
                            return '⚠️ Erro ao buscar grupos. Continuando sem vínculo...\n\n' + gerarResumo(stepData);
                        }
                    } else if (input.toLowerCase() === 'n' || input.toLowerCase() === 'não' || input.toLowerCase() === 'nao') {
                        stepData.data.grupoVinculado = null;
                        stepData.step = 7; // Pula para resumo
                        rifaCreationSteps.set(senderJid, stepData);
                        return gerarResumo(stepData);
                    } else {
                        return '⚠️ Responda com *S* para SIM ou *N* para NÃO.';
                    }

                case 6: // Seleção do grupo
                    const numeroGrupo = parseInt(input);
                    if (isNaN(numeroGrupo) || numeroGrupo < 1 || numeroGrupo > stepData.data.gruposDisponiveis.length) {
                        return `⚠️ Número inválido! Digite um número entre 1 e ${stepData.data.gruposDisponiveis.length}.`;
                    }

                    const grupoSelecionado = stepData.data.gruposDisponiveis[numeroGrupo - 1];

                    // Obter link de convite do grupo
                    try {
                        const inviteCode = await sock.groupInviteCode(grupoSelecionado.id);
                        stepData.data.grupoVinculado = {
                            id: grupoSelecionado.id,
                            nome: grupoSelecionado.nome,
                            link: `https://chat.whatsapp.com/${inviteCode}`
                        };
                    } catch (error) {
                        console.error('Erro ao obter link do grupo:', error);
                        stepData.data.grupoVinculado = {
                            id: grupoSelecionado.id,
                            nome: grupoSelecionado.nome,
                            link: null
                        };
                    }

                    stepData.step = 7;
                    rifaCreationSteps.set(senderJid, stepData);
                    return gerarResumo(stepData);

                case 7: // Confirmação final
                    if (input.toLowerCase() === 'sim' || input.toLowerCase() === 's') {
                        try {
                            db.raffle.criarRifa(
                                stepData.chatJid,
                                stepData.data.titulo,
                                `Rifa criada por ${senderJid}`,
                                stepData.data.premio,
                                stepData.data.preco,
                                stepData.data.qtdNumeros,
                                stepData.data.dataSorteio.toISOString(),
                                senderJid,
                                stepData.data.grupoVinculado?.id || null,
                                stepData.data.grupoVinculado?.link || null
                            );
                            rifaCreationSteps.delete(senderJid);

                            let mensagemSucesso = `✅ *RIFA CRIADA COM SUCESSO!* 🚀\n\nA IA já está pronta para vender!`;
                            if (stepData.data.grupoVinculado) {
                                mensagemSucesso += `\n\n🤝 Grupo vinculado: *${stepData.data.grupoVinculado.nome}*\nCompradores serão adicionados automaticamente!`;
                            }
                            return mensagemSucesso;
                        } catch (error) {
                            console.error(error);
                            rifaCreationSteps.delete(senderJid);
                            return '❌ Erro ao salvar rifa no banco de dados.';
                        }
                    } else {
                        return '⚠️ Responda com *SIM* para confirmar ou *CANCELAR* para desistir.';
                    }
            }
            return;
        }

        if (!subcomando) {
            return sock.sendMessage(chatJid, {
                text: `🎟️ *COMANDOS DE RIFA* 🎟️

Use: *${prefixo}rifa [comando]*

🛠️ *Admin:*
• *criar* - Criar nova rifa (interativo)
• *ver* - Ver status da rifa ativa
• *sortear* - Realizar sorteio manual
• *cancelar* - Cancelar rifa ativa
• *stats* - Ver estatísticas
• *confirmar [ID] @user* - Confirmar pagamento manualmente
`
            });
        }

        // !rifa criar
        if (subcomando === 'criar') {
            const rifaAtiva = db.raffle.obterRifaAtiva(chatJid);
            if (rifaAtiva) {
                return sock.sendMessage(chatJid, {
                    text: `⚠️ Já existe uma rifa ativa neste grupo!\n\nUse *${prefixo}rifa ver* para detalhes ou *${prefixo}rifa cancelar* para encerrar.`
                });
            }

            // Iniciar fluxo interativo
            if (rifaCreationSteps) {
                rifaCreationSteps.set(senderJid, {
                    step: 0,
                    chatJid, // Salva o grupo onde começou
                    data: {}
                });
                return sock.sendMessage(chatJid, {
                    text: `🎟️ *CRIANDO NOVA RIFA* 🎟️\n\nVamos lá! Primeiro, digite o *TÍTULO* da rifa (ex: Rifa do iPhone):`
                });
            } else {
                return sock.sendMessage(chatJid, { text: '❌ Erro interno: Sistema de passos não inicializado.' });
            }
        }

        // !rifa ver
        if (subcomando === 'ver') {
            const rifa = db.raffle.obterRifaAtiva(chatJid);
            if (!rifa) return sock.sendMessage(chatJid, { text: '⚠️ Nenhuma rifa ativa neste grupo.' });

            const disponiveis = db.raffle.obterNumerosDisponiveis(rifa.id);
            const vendidos = rifa.quantidade_numeros - disponiveis.length;
            const porcentagem = ((vendidos / rifa.quantidade_numeros) * 100).toFixed(1);

            return sock.sendMessage(chatJid, {
                text: `🎟️ *STATUS DA RIFA* 🎟️

📌 *${rifa.titulo}*
📱 Prêmio: ${rifa.premio}
💰 Preço: R$ ${rifa.preco_numero.toFixed(2)}

📊 *Vendas:*
• Vendidos: ${vendidos}/${rifa.quantidade_numeros} (${porcentagem}%)
• Disponíveis: ${disponiveis.length}

🗓️ Sorteio: ${new Date(rifa.data_sorteio).toLocaleString('pt-BR')}
🆔 ID: ${rifa.id}`
            });
        }

        // !rifa cancelar
        if (subcomando === 'cancelar') {
            const rifa = db.raffle.obterRifaAtiva(chatJid);
            if (!rifa) return sock.sendMessage(chatJid, { text: '⚠️ Nenhuma rifa ativa para cancelar.' });

            db.raffle.atualizarStatusRifa(rifa.id, 'cancelada');
            return sock.sendMessage(chatJid, { text: '✅ Rifa cancelada com sucesso.' });
        }

        // !rifa sortear
        if (subcomando === 'sortear') {
            const rifa = db.raffle.obterRifaAtiva(chatJid);
            if (!rifa) return sock.sendMessage(chatJid, { text: '⚠️ Nenhuma rifa ativa para sortear.' });

            const ganhador = db.raffle.realizarSorteio(rifa.id);

            if (!ganhador) {
                return sock.sendMessage(chatJid, { text: '⚠️ Não foi possível realizar o sorteio (nenhum número vendido?).' });
            }

            await sock.sendMessage(chatJid, {
                text: `🎉 *TEMOS UM GANHADOR!* 🎉

🎟️ Rifa: ${rifa.titulo}
📱 Prêmio: ${rifa.premio}

🎲 *NÚMERO SORTEADO: ${ganhador.numero}*

🏆 *Parabéns, ${ganhador.nome_comprador}!* 👏👏👏`
            });

            if (ganhador.id_comprador) {
                try {
                    await sock.sendMessage(ganhador.id_comprador, {
                        text: `🏆 *PARABÉNS! VOCÊ GANHOU!* 🏆\n\nVocê foi o ganhador da rifa *${rifa.titulo}* com o número *${ganhador.numero}*!\n\nEntre em contato com o administrador para receber seu prêmio!`
                    });
                } catch (e) {
                    console.error('Erro ao notificar ganhador no PV:', e);
                }
            }
        }

        // !rifa stats
        if (subcomando === 'stats') {
            const rifa = db.raffle.obterRifaAtiva(chatJid);
            if (!rifa) return sock.sendMessage(chatJid, { text: '⚠️ Nenhuma rifa ativa neste grupo.' });

            // Busca números vendidos e reservados
            const stmt = db.connection.prepare('SELECT status FROM numeros_rifa WHERE id_rifa = ?');
            const numeros = stmt.all(rifa.id);

            // Busca compras pendentes aguardando confirmação
            const pendentesStmt = db.connection.prepare('SELECT COUNT(*) as count FROM compras_pendentes WHERE id_rifa = ? AND status = ?');
            const pendentesCount = pendentesStmt.get(rifa.id, 'aguardando').count;

            let vendidos = 0;
            let reservados = 0;
            let disponiveis = 0;

            for (const n of numeros) {
                if (n.status === 'vendido') {
                    vendidos++;
                } else if (n.status === 'reservado') {
                    reservados++;
                } else {
                    disponiveis++;
                }
            }

            const preco = rifa.preco_numero;
            const arrecadacaoConfirmada = vendidos * preco;
            const arrecadacaoPotencial = reservados * preco;
            const totalGeral = arrecadacaoConfirmada + arrecadacaoPotencial;

            return sock.sendMessage(chatJid, {
                text: `📊 *ESTATÍSTICAS DA RIFA* 📊
                
🎟️ *${rifa.titulo}*

🔢 *Números:*
✅ Vendidos: ${vendidos}
⏳ Reservados: ${reservados}
🆓 Disponíveis: ${disponiveis}
∑ Total: ${rifa.quantidade_numeros}

📝 *Pendências:*
⚠️ Aguardando Confirmação: ${pendentesCount}
(Use *${prefixo}rifa pendentes* para ver detalhes)

💰 *Financeiro:*
💵 Arrecadado: R$ ${arrecadacaoConfirmada.toFixed(2)}
💸 Potencial (Reservas): R$ ${arrecadacaoPotencial.toFixed(2)}
📈 Total Previsto: R$ ${totalGeral.toFixed(2)}`
            });
        }

        // !rifa pendentes
        if (subcomando === 'pendentes') {
            const rifa = db.raffle.obterRifaAtiva(chatJid);
            if (!rifa) return sock.sendMessage(chatJid, { text: '⚠️ Nenhuma rifa ativa neste grupo.' });

            const stmt = db.connection.prepare('SELECT * FROM compras_pendentes WHERE id_rifa = ? AND status = ? ORDER BY criado_em DESC');
            const pendentes = stmt.all(rifa.id, 'aguardando');

            if (pendentes.length === 0) {
                return sock.sendMessage(chatJid, { text: '✅ Nenhuma compra pendente de confirmação no momento.' });
            }

            let texto = `📝 *COMPRAS AGUARDANDO CONFIRMAÇÃO* 📝\n\n`;

            for (const p of pendentes) {
                const nums = JSON.parse(p.numeros).join(', ');
                texto += `🆔 *ID: ${p.id}*\n👤 ${p.nome_usuario}\n📱 ${p.id_usuario.split('@')[0]}\n🔢 Números: ${nums}\n💰 R$ ${p.valor_total.toFixed(2)}\n\n`;
            }

            texto += `Use *${prefixo}rifa confirmar [ID]* para aprovar uma compra.`;

            return sock.sendMessage(chatJid, { text: texto });
        }

        // !rifa confirmar [ID] ou @user
        if (subcomando === 'confirmar') {
            const arg = args[1];
            if (!arg) {
                return sock.sendMessage(chatJid, { text: `⚠️ Uso correto:\n*${prefixo}rifa confirmar [ID]* (para confirmar por ID)\n*${prefixo}rifa confirmar @usuario* (para confirmar a última do usuário)` });
            }

            const raffleAIService = require('../services/raffleAIService');

            // Caso 1: Confirmação por ID numérico
            if (/^\d+$/.test(arg)) {
                const idCompra = parseInt(arg);
                const compra = db.raffle.obterCompraPendente(idCompra);

                if (!compra) {
                    return sock.sendMessage(chatJid, { text: `⚠️ Compra com ID ${idCompra} não encontrada.` });
                }

                if (compra.status !== 'aguardando') {
                    return sock.sendMessage(chatJid, { text: `⚠️ Esta compra já está com status: ${compra.status}` });
                }

                // Processa confirmação
                const rifa = db.raffle.obterRifa(compra.id_rifa);
                db.raffle.confirmarCompraPendente(compra.id);
                db.raffle.confirmarCompra(rifa.id, compra.numeros, compra.id_usuario, compra.nome_usuario, compra.cidade_usuario);

                await sock.sendMessage(chatJid, { text: `✅ Compra #${compra.id} de ${compra.nome_usuario} confirmada com sucesso!` });

                // Notifica usuário
                try {
                    await sock.sendMessage(compra.id_usuario, {
                        text: `🎉 *PAGAMENTO CONFIRMADO!* 🎉\n\nSua compra na rifa *${rifa.titulo}* foi aprovada!\n\n🎯 *Seus Números:* ${compra.numeros.join(', ')}\n🗓️ *Sorteio:* ${new Date(rifa.data_sorteio).toLocaleString('pt-BR')}\n\nBoa sorte! 🍀`
                    });
                } catch (e) {
                    console.error('Erro ao notificar usuário:', e);
                }
                return;
            }

            // Caso 2: Confirmação por Menção (lógica antiga)
            const mentionedJid = arg.includes('@') ? arg.replace('@', '') + '@s.whatsapp.net' : (msg.message?.extendedTextMessage?.contextInfo?.participant || null);

            if (!mentionedJid) {
                return sock.sendMessage(chatJid, { text: `⚠️ Mencione o usuário ou digite o ID da compra.` });
            }

            await raffleAIService.processarConfirmacaoAdmin(sock, chatJid, mentionedJid, 'confirmar', db);
            return sock.sendMessage(chatJid, { text: `✅ Processo de confirmação manual iniciado para @${mentionedJid.split('@')[0]}.`, mentions: [mentionedJid] });
        }
    }
};
