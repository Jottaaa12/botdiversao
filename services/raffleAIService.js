const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    // Detecta se a mensagem indica interesse em COMPRAR rifa (não perguntas)
    detectarInteresseRifa: (mensagem) => {
        if (!mensagem) return false;
        const msg = mensagem.toLowerCase();

        // Palavras que indicam PERGUNTAS (não deve iniciar compra)
        const perguntasRifa = /quando.*sorteio|data.*sorteio|que.*dia|que.*hora|horário.*sorteio|quando.*acontece|quando.*será/i;

        // Se for uma pergunta, NÃO inicia compra (deixa para IA responder)
        if (perguntasRifa.test(msg)) {
            return false;
        }

        // Palavras que indicam INTERESSE EM COMPRAR
        const interesseCompra = /quero.*comprar|quero.*participar|quero.*número|comprar.*rifa|participar.*rifa|me.*inscrever|quero.*concorrer|quero.*rifa/i;

        return interesseCompra.test(msg);
    },

    // Extrai números de uma mensagem em linguagem natural
    extrairNumeros: (mensagem) => {
        if (!mensagem) return [];
        // Regex para encontrar números isolados
        const regex = /\b\d+\b/g;
        const matches = mensagem.match(regex);

        if (!matches) return [];

        // Converte para inteiros e remove duplicatas
        return [...new Set(matches.map(n => parseInt(n)))];
    },

    // Inicia o processo de compra (IA detectou interesse)
    async processarInteresse(sock, chatJid, senderJid, db) {
        let rifa = db.raffle.obterRifaAtiva(chatJid);

        // Se não achou rifa no chat atual (ex: PV), tenta buscar qualquer rifa ativa globalmente
        if (!rifa) {
            rifa = db.raffle.obterRifaAtivaGlobal();
        }

        if (!rifa) {
            return `Desculpe, não há nenhuma rifa ativa no momento. Fique ligado para as próximas! 🎟️`;
        }

        // Cria sessão
        db.raffle.criarSessaoCompra(senderJid, rifa.id);

        const disponiveis = db.raffle.obterNumerosDisponiveis(rifa.id);
        const totalDisponiveis = disponiveis.length;

        // Mostra apenas alguns números se houver muitos
        let listaNumeros = disponiveis.join(', ');
        if (totalDisponiveis > 50) {
            listaNumeros = disponiveis.slice(0, 50).join(', ') + `... e mais ${totalDisponiveis - 50}`;
        }

        return `🎟️ *RIFA ATIVA: ${rifa.titulo}* 🎟️

📱 *Prêmio:* ${rifa.premio}
💰 *Valor:* R$ ${rifa.preco_numero.toFixed(2)} por número
🔢 *Disponíveis:* ${totalDisponiveis} números

*Números livres:*
${listaNumeros}

💬 *Como comprar:*
Basta me dizer quais números você quer!
Ex: _"Quero o 5"_ ou _"Quero 8, 9 e 20"_

_Digite *CANCELAR* a qualquer momento para sair._`;
    },

    // Continua o processo baseado no estado da sessão
    async continuarProcessoCompra(sock, chatJid, senderJid, mensagem, msgObject, db, rifaConfirmationSteps) {
        const sessao = db.raffle.obterSessaoCompra(senderJid, null); // null busca qualquer rifa ativa na sessão
        if (!sessao) return null; // Deveria ter sessão se chegou aqui

        // DETECTA COMANDO DE CANCELAMENTO
        const msgLower = mensagem?.toLowerCase() || '';
        const comandosCancelar = ['cancelar', 'sair', 'desistir', 'não quero', 'nao quero', 'parar'];
        if (comandosCancelar.some(cmd => msgLower.includes(cmd))) {
            db.raffle.finalizarSessaoCompra(senderJid, sessao.id_rifa);
            return `❌ Compra cancelada. Seus números foram liberados.\n\nSe mudar de ideia, é só me chamar! 😊`;
        }

        const rifa = db.raffle.obterRifa(sessao.id_rifa);
        if (!rifa || rifa.status !== 'ativa') {
            db.raffle.finalizarSessaoCompra(senderJid, sessao.id_rifa);
            return `⚠️ A rifa que você estava comprando foi encerrada ou cancelada.`;
        }

        // --- ETAPA: INTERESSE (Usuário vai escolher números) ---
        if (sessao.etapa === 'interesse') {
            const numeros = this.extrairNumeros(mensagem);

            if (numeros.length === 0) {
                return `🤔 Não entendi quais números você quer.
Pode repetir? Ex: _"Quero o 10 e o 20"_

_Digite *CANCELAR* para desistir._`;
            }

            // Verifica disponibilidade
            const disponiveis = db.raffle.verificarDisponibilidade(rifa.id, numeros);

            if (!disponiveis) {
                const todosDisponiveis = db.raffle.obterNumerosDisponiveis(rifa.id);
                return `❌ Ops! Um ou mais números que você escolheu *já foram vendidos ou reservados*.

Por favor, escolha outros números.
Disponíveis: ${todosDisponiveis.slice(0, 20).join(', ')}...

_Digite *CANCELAR* para desistir._`;
            }

            // Reserva números
            const nomeUsuario = msgObject.pushName || 'Usuário';
            db.raffle.reservarNumeros(rifa.id, numeros, senderJid, nomeUsuario);

            // Atualiza sessão
            db.raffle.atualizarSessaoCompra(senderJid, rifa.id, {
                etapa: 'aguardando_comprovante',
                numeros_escolhidos: JSON.stringify(numeros)
            });

            const valorTotal = numeros.length * rifa.preco_numero;

            return `✅ *NÚMEROS RESERVADOS!* (10 min)

🎯 *Seus números:* ${numeros.join(', ')}
💰 *Valor Total:* R$ ${valorTotal.toFixed(2)}

📲 *DADOS PARA PAGAMENTO:*
🔑 *PIX:* 88981905006
👤 *Nome:* João Pedro

📸 *AGORA:* Envie a foto do comprovante aqui para eu confirmar!

_Digite *CANCELAR* para desistir._`;
        }

        // --- ETAPA: AGUARDANDO COMPROVANTE ---
        if (sessao.etapa === 'aguardando_comprovante') {
            // Verifica se é imagem/documento
            const isImage = msgObject.message?.imageMessage;
            const isDoc = msgObject.message?.documentMessage;

            if (isImage || isDoc) {
                // Salva comprovante
                try {
                    const buffer = await downloadMediaMessage(
                        msgObject,
                        'buffer',
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );

                    const fileName = `comprovante_${senderJid.split('@')[0]}_${Date.now()}.jpg`;
                    const filePath = path.join(__dirname, '../media/comprovantes', fileName);

                    // Garante que diretório existe
                    if (!fs.existsSync(path.dirname(filePath))) {
                        fs.mkdirSync(path.dirname(filePath), { recursive: true });
                    }

                    fs.writeFileSync(filePath, buffer);

                    // Atualiza sessão
                    db.raffle.atualizarSessaoCompra(senderJid, rifa.id, {
                        tem_comprovante: true,
                        etapa: 'coletando_dados' // Avança etapa
                    });

                    // Verifica se já tem dados salvos
                    const dadosSalvos = db.raffle.obterDadosComprador(senderJid);

                    if (dadosSalvos && dadosSalvos.nome_completo && dadosSalvos.cidade) {
                        // Já tem tudo, finaliza
                        return await this.finalizarCompra(sock, chatJid, senderJid, rifa, sessao, filePath, dadosSalvos, db, rifaConfirmationSteps);
                    }

                    if (dadosSalvos && dadosSalvos.nome_completo) {
                        db.raffle.atualizarSessaoCompra(senderJid, rifa.id, { tem_nome: true });
                        return `✅ Comprovante recebido!
                        
Agora, qual sua *CIDADE*?

_Digite *CANCELAR* para desistir._`;
                    }

                    return `✅ Comprovante recebido!

📝 Para finalizar, preciso de alguns dados.
Qual seu *NOME COMPLETO*?

_Digite *CANCELAR* para desistir._`;

                } catch (err) {
                    console.error('Erro ao baixar comprovante:', err);
                    return `❌ Tive um erro ao baixar seu comprovante. Pode enviar novamente?`;
                }
            } else {
                return `📸 Estou aguardando a foto do *comprovante* de pagamento.
Envie a imagem para continuarmos!

_Digite *CANCELAR* para desistir._`;
            }
        }

        // --- ETAPA: COLETANDO DADOS ---
        if (sessao.etapa === 'coletando_dados') {
            // Se não tem nome, a mensagem atual é o nome
            if (!sessao.tem_nome) {
                const nome = mensagem.trim();
                db.raffle.salvarDadosComprador(senderJid, nome, null);
                db.raffle.atualizarSessaoCompra(senderJid, rifa.id, { tem_nome: true });

                // Verifica se falta cidade
                const dados = db.raffle.obterDadosComprador(senderJid);
                if (!dados.cidade) {
                    return `Obrigado, ${nome.split(' ')[0]}!
                    
Agora, qual sua *CIDADE*?

_Digite *CANCELAR* para desistir._`;
                }

                const comprovantePath = this.buscarUltimoComprovante(senderJid);
                return await this.finalizarCompra(sock, chatJid, senderJid, rifa, sessao, comprovantePath, { nome_completo: nome, cidade: dados.cidade }, db, rifaConfirmationSteps);
            }

            // Se já tem nome mas falta cidade, a mensagem atual é a cidade
            if (sessao.tem_nome && !sessao.tem_cidade) {
                const cidade = mensagem.trim();

                if (cidade.length < 3) {
                    return `⚠️ O nome da cidade parece muito curto. Por favor, digite o nome completo da sua cidade.`;
                }

                // Atualiza cidade (mantendo nome existente)
                const dadosAtuais = db.raffle.obterDadosComprador(senderJid);
                db.raffle.salvarDadosComprador(senderJid, dadosAtuais.nome_completo, cidade);

                const comprovantePath = this.buscarUltimoComprovante(senderJid);
                return await this.finalizarCompra(sock, chatJid, senderJid, rifa, sessao, comprovantePath, { nome_completo: dadosAtuais.nome_completo, cidade: cidade }, db, rifaConfirmationSteps);
            }
        }
    },

    buscarUltimoComprovante(senderJid) {
        const dir = path.join(__dirname, '../media/comprovantes');
        if (!fs.existsSync(dir)) return null;

        const files = fs.readdirSync(dir)
            .filter(f => f.includes(senderJid.split('@')[0]))
            .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        return files.length > 0 ? path.join(dir, files[0].name) : null;
    },

    async finalizarCompra(sock, chatJid, senderJid, rifa, sessao, comprovantePath, dadosUsuario, db, rifaConfirmationSteps) {
        const numeros = JSON.parse(sessao.numeros_escolhidos);
        const valorTotal = numeros.length * rifa.preco_numero;

        // Cria compra pendente
        const compra = db.raffle.criarCompraPendente(
            rifa.id,
            senderJid,
            dadosUsuario.nome_completo,
            dadosUsuario.cidade,
            numeros,
            valorTotal,
            comprovantePath
        );

        // Notifica Admin
        await this.notificarAdmin(sock, compra, rifa, db, rifaConfirmationSteps);

        // Finaliza sessão
        db.raffle.finalizarSessaoCompra(senderJid, rifa.id);

        return `✅ *DADOS RECEBIDOS!*

Seus dados foram enviados para análise.
Assim que eu confirmar o pagamento, você receberá seu bilhete aqui!

📋 *Resumo:*
🔢 Números: ${numeros.join(', ')}
👤 Nome: ${dadosUsuario.nome_completo}
🏙️ Cidade: ${dadosUsuario.cidade}

⏳ Aguarde a confirmação...`;
    },

    async notificarAdmin(sock, compra, rifa, db, rifaConfirmationSteps) {
        // ID do admin (você) - hardcoded por enquanto ou pego do config
        const adminJid = '558881905006@s.whatsapp.net';

        const texto = `🎟️ *NOVA COMPRA DE RIFA* 🎟️

👤 *Comprador:* ${compra.nome_usuario}
🏙️ *Cidade:* ${compra.cidade_usuario}
📱 *WhatsApp:* ${compra.id_usuario.split('@')[0]}

🎯 *Números:* ${JSON.parse(compra.numeros).join(', ')}
💰 *Valor:* R$ ${compra.valor_total.toFixed(2)}
🎟️ *Rifa:* ${rifa.titulo}

📸 *Comprovante:* (abaixo)

━━━━━━━━━━━━━━━━
⚠️ *AÇÃO NECESSÁRIA:*
Responda com *S* para confirmar ou *N* para recusar.`;

        await sock.sendMessage(adminJid, { text: texto });

        if (compra.comprovante_path && fs.existsSync(compra.comprovante_path)) {
            await sock.sendMessage(adminJid, {
                image: { url: compra.comprovante_path },
                caption: 'Comprovante de Pagamento'
            });
        }

        // Adiciona admin ao estado de confirmação se o mapa for passado
        if (rifaConfirmationSteps) {
            rifaConfirmationSteps.set(adminJid, {
                step: 'confirmacao',
                compraId: compra.id
            });
        }
    },

    async processarConfirmacaoAdmin(sock, chatJid, senderJid, acao, db) {
        // Busca a última compra pendente global aguardando
        const pendentes = db.raffle.obterCompraPendenteAguardandoGlobal();

        if (!pendentes) {
            return sock.sendMessage(chatJid, { text: '⚠️ Não encontrei nenhuma compra pendente aguardando confirmação.' });
        }

        const compra = pendentes;
        const numeros = compra.numeros; // Já vem parseado do repositório
        const rifa = db.raffle.obterRifa(compra.id_rifa);

        if (acao === 'confirmar') {
            db.raffle.confirmarCompraPendente(compra.id);
            db.raffle.confirmarCompra(rifa.id, numeros, compra.id_usuario, compra.nome_usuario, compra.cidade_usuario);

            await sock.sendMessage(chatJid, { text: `✅ Compra de ${compra.nome_usuario} confirmada com sucesso!` });

            // Verificar se a rifa tem grupo vinculado
            let mensagemGrupo = '';
            if (rifa.grupo_vinculado_id) {
                try {
                    // Tentar adicionar ao grupo
                    await sock.groupParticipantsUpdate(rifa.grupo_vinculado_id, [compra.id_usuario], "add");
                    mensagemGrupo = `\n\n🤝 Você foi adicionado ao grupo da rifa!`;
                } catch (error) {
                    console.error('Erro ao adicionar usuário ao grupo:', error);
                    // Se falhar (privacidade), enviar link
                    if (rifa.grupo_vinculado_link) {
                        mensagemGrupo = `\n\n🤝 *GRUPO DA RIFA*\n\nNão consegui te adicionar automaticamente (verifique suas configurações de privacidade).\n\nEntre no grupo usando este link:\n${rifa.grupo_vinculado_link}\n\n⚠️ Entre no grupo para confirmar sua vaga e receber atualizações!`;
                    }
                }
            }

            // Notifica usuário
            await sock.sendMessage(compra.id_usuario, {
                text: `🎉 *PAGAMENTO CONFIRMADO!* 🎉

Sua compra na rifa *${rifa.titulo}* foi aprovada!

🎯 *Seus Números:* ${numeros.join(', ')}
🗓️ *Sorteio:* ${new Date(rifa.data_sorteio).toLocaleString('pt-BR')}

Boa sorte! 🍀${mensagemGrupo}`
            });

        } else if (acao === 'recusar') {
            db.raffle.recusarCompraPendente(compra.id);
            db.raffle.liberarNumeros(rifa.id, numeros);

            await sock.sendMessage(chatJid, { text: `❌ Compra de ${compra.nome_usuario} recusada. Números liberados.` });

            // Notifica usuário
            await sock.sendMessage(compra.id_usuario, {
                text: `❌ *COMPRA RECUSADA*

Seu pagamento para a rifa *${rifa.titulo}* não foi confirmado.
Os números foram liberados.

Caso tenha sido um erro, entre em contato com o administrador.`
            });
        }
    }
};
