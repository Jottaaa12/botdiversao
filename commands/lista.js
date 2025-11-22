const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'lista',
    aliases: ['l'],
    category: 'grupo',
    description: 'Gerencia a lista de presença do grupo',
    permission: 'user',
    async execute({ sock, chatJid, args, senderJid, db, isGroup, permissionLevel }) {
        // Verifica se é um grupo
        if (!isGroup) {
            await sock.sendMessage(chatJid, {
                text: '❌ Este comando só pode ser usado em grupos.'
            });
            return;
        }

        const subcomando = args[0] ? args[0].toLowerCase() : null;
        const restoArgs = args.slice(1).join(' ');

        // --- SUBCOMANDO: AJUDA ---
        if (subcomando === 'ajuda' || subcomando === 'help') {
            const textoAjuda = `📋 *COMANDOS DA LISTA* 📋

Aqui estão os comandos que você pode usar:

🔹 *!lista* (ou *!l*)
Mostra a lista atual. Se não houver, cria uma nova.

🔹 *!lista [seu nome]*
Adiciona você à lista com o nome informado.
_Ex: !lista João_

🔹 *!lista sair*
Remove você da lista.

🔹 *!lista add [nome]*
Adiciona outra pessoa à lista (para quem não está no grupo).
_Ex: !lista add Maria_

🔹 *!lista chamar [opcional: alvo] [opcional: mensagem]*
Marca participantes com uma mensagem personalizada.
_Ex: !lista chamar (marca todos, msg padrão)_
_Ex: !lista chamar Vamos jogar! (marca todos, msg "Vamos jogar!")_
_Ex: !lista chamar João Corre! (marca João, msg "Corre!")_

🔹 *!lista editar [número] [novo_nome]*
Edita o nome de um membro da lista.
_Ex: !lista editar 3 João Silva_

🔹 *!lista limpar*
Remove todos os membros mas mantém a lista ativa (Admin/Criador).

🔹 *!lista stats*
Mostra estatísticas de uso das listas no grupo.

🔹 *!lista ajuda*
Mostra esta mensagem de ajuda.

🔹 *!lista remover [número/nome]*
Remove alguém da lista (Apenas Admin/Criador).

🔹 *!lista fechar*
Encerra a lista atual (Apenas Admin/Criador).`;

            await sock.sendMessage(chatJid, { text: textoAjuda });
            return;
        }

        // --- SUBCOMANDO: SAIR ---
        if (subcomando === 'sair') {
            const listaAtiva = db.obterListaAtiva(chatJid);
            if (!listaAtiva) {
                await sock.sendMessage(chatJid, { text: '❌ Não há nenhuma lista ativa no momento.' });
                return;
            }

            const removeu = db.removerMembroLista(listaAtiva.id, senderJid);
            if (removeu.changes > 0) {
                await sock.sendMessage(chatJid, { text: '✅ Você saiu da lista.' });
                // Mostra a lista atualizada
                return this.mostrarLista(sock, chatJid, db);
            } else {
                await sock.sendMessage(chatJid, { text: '❌ Você não estava na lista.' });
                return;
            }
        }

        // --- SUBCOMANDO: CHAMAR ---
        if (subcomando === 'chamar') {
            const listaAtiva = db.obterListaAtiva(chatJid);
            if (!listaAtiva) {
                await sock.sendMessage(chatJid, { text: '❌ Não há nenhuma lista ativa no momento.' });
                return;
            }

            const membros = db.obterMembrosLista(listaAtiva.id);
            if (membros.length === 0) {
                await sock.sendMessage(chatJid, { text: '❌ A lista está vazia.' });
                return;
            }

            const argsChamar = args.slice(1);
            let mentions = [];
            let mensagemFinal = '';

            // Lógica de detecção de alvo vs mensagem
            let alvo = null;
            let mensagemPersonalizada = '';
            let chamarTodos = false;

            if (argsChamar.length === 0) {
                // Sem argumentos -> Chamar todos com mensagem padrão
                chamarTodos = true;
            } else {
                const primeiroArg = argsChamar[0];

                if (primeiroArg.toLowerCase() === 'todos' || primeiroArg.toLowerCase() === 'all') {
                    // Explícito chamar todos
                    chamarTodos = true;
                    mensagemPersonalizada = argsChamar.slice(1).join(' ');
                } else {
                    // Tenta encontrar membro pelo primeiro argumento
                    // Tenta por número
                    if (/^\d+$/.test(primeiroArg)) {
                        const index = parseInt(primeiroArg) - 1;
                        if (index >= 0 && index < membros.length) {
                            alvo = membros[index];
                        }
                    }

                    // Se não achou por número, tenta por nome (busca exata ou parcial no início)
                    if (!alvo) {
                        const termoBusca = primeiroArg.toLowerCase();
                        alvo = membros.find(m => {
                            let nome = m.id_usuario;
                            if (m.id_usuario.includes('@s.whatsapp.net')) {
                                const u = db.obterUsuario(m.id_usuario);
                                if (u && u.nome) nome = u.nome;
                            }
                            return nome.toLowerCase().includes(termoBusca);
                        });
                    }

                    if (alvo) {
                        // Encontrou um alvo específico
                        mensagemPersonalizada = argsChamar.slice(1).join(' ');
                    } else {
                        // Não encontrou alvo -> Assume que tudo é mensagem para TODOS
                        chamarTodos = true;
                        mensagemPersonalizada = argsChamar.join(' ');
                    }
                }
            }

            // Constrói a mensagem e menções
            if (chamarTodos) {
                mentions = membros
                    .filter(m => m.id_usuario.includes('@s.whatsapp.net'))
                    .map(m => m.id_usuario);

                if (mentions.length === 0) {
                    await sock.sendMessage(chatJid, { text: '❌ Ninguém na lista pode ser marcado (apenas nomes manuais?).' });
                    return;
                }

                const msgTexto = mensagemPersonalizada || 'O evento está começando/chegou a hora!';
                mensagemFinal = `📢 *ATENÇÃO PESSOAL DA LISTA!* 📢\n\n${msgTexto}`;

            } else if (alvo) {
                if (alvo.id_usuario.includes('@s.whatsapp.net')) {
                    mentions = [alvo.id_usuario];
                    const nomeDisplay = alvo.id_usuario.split('@')[0];
                    const msgTexto = mensagemPersonalizada || 'Você foi chamado(a)!';
                    mensagemFinal = `📢 *ATENÇÃO @${nomeDisplay}!* 📢\n\n${msgTexto}`;
                } else {
                    // Nome manual
                    const msgTexto = mensagemPersonalizada || 'Você foi chamado(a)!';
                    mensagemFinal = `📢 *ATENÇÃO ${alvo.id_usuario}!* 📢\n\n${msgTexto}`;
                }
            }

            await sock.sendMessage(chatJid, {
                text: mensagemFinal,
                mentions: mentions
            });
            return;
        }

        // --- SUBCOMANDO: ADD (Adicionar terceiro) ---
        if (subcomando === 'add') {
            if (!restoArgs) {
                await sock.sendMessage(chatJid, { text: '❌ Digite o nome da pessoa para adicionar.\nEx: !l add Maria' });
                return;
            }

            let listaAtiva = db.obterListaAtiva(chatJid);
            if (!listaAtiva) {
                // Cria lista se não existir
                const tituloPadrao = db.obterTituloPadraoLista(chatJid) || 'Lista Geral';
                db.criarLista(chatJid, tituloPadrao, senderJid);
                listaAtiva = db.obterListaAtiva(chatJid);
            }

            const nomeAdicionado = restoArgs;
            try {
                db.adicionarMembroLista(listaAtiva.id, nomeAdicionado);
                await sock.sendMessage(chatJid, { text: `✅ ${nomeAdicionado} adicionado(a) à lista!` });
                return this.mostrarLista(sock, chatJid, db);
            } catch (error) {
                if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    await sock.sendMessage(chatJid, { text: `❌ ${nomeAdicionado} já está na lista!` });
                } else {
                    console.error(error);
                    await sock.sendMessage(chatJid, { text: '❌ Erro ao adicionar nome.' });
                }
                return;
            }
        }

        // --- SUBCOMANDO: REMOVER (Remove membro específico) ---
        if (subcomando === 'remover' || subcomando === 'remove' || subcomando === 'delete') {
            // Verifica permissão (Admin, Criador da lista ou Dono do bot)
            const isAdmin = await this.verificarPermissao(sock, chatJid, senderJid, db);
            const isOwner = permissionLevel === 'owner';
            const listaParaRemover = db.obterListaAtiva(chatJid);

            if (!listaParaRemover) {
                await sock.sendMessage(chatJid, { text: '❌ Não há nenhuma lista ativa no momento.' });
                return;
            }

            // Permite que o criador da lista também remova
            const isCriador = listaParaRemover.criado_por === senderJid;

            if (!isAdmin && !isCriador && !isOwner) {
                await sock.sendMessage(chatJid, { text: '❌ Apenas administradores ou o criador da lista podem remover membros.' });
                return;
            }

            if (!restoArgs) {
                await sock.sendMessage(chatJid, { text: '❌ Digite o número ou nome da pessoa para remover.\nEx: !l remover 2\nEx: !l remover João' });
                return;
            }

            const membros = db.obterMembrosLista(listaParaRemover.id);
            let alvo = null;

            // Tenta por número
            if (/^\d+$/.test(restoArgs)) {
                const index = parseInt(restoArgs) - 1;
                if (index >= 0 && index < membros.length) {
                    alvo = membros[index];
                }
            }

            // Tenta por nome
            if (!alvo) {
                const termoBusca = restoArgs.toLowerCase();
                alvo = membros.find(m => {
                    let nome = m.id_usuario;
                    if (m.id_usuario.includes('@s.whatsapp.net')) {
                        const u = db.obterUsuario(m.id_usuario);
                        if (u && u.nome) nome = u.nome;
                    }
                    return nome.toLowerCase().includes(termoBusca);
                });
            }

            if (alvo) {
                db.removerMembroLista(listaParaRemover.id, alvo.id_usuario);
                await sock.sendMessage(chatJid, { text: `✅ Membro removido da lista.` });
                return this.mostrarLista(sock, chatJid, db);
            } else {
                await sock.sendMessage(chatJid, { text: '❌ Membro não encontrado na lista.' });
                return;
            }
        }

        // --- SUBCOMANDO: FECHAR (Excluir lista) ---
        if (subcomando === 'fechar' || subcomando === 'excluir' || subcomando === 'excluir_tudo' || subcomando === 'encerrar') {
            // Verifica permissão (Admin, Criador da lista ou Dono do bot)
            const isAdmin = await this.verificarPermissao(sock, chatJid, senderJid, db);
            const isOwner = permissionLevel === 'owner';
            const listaParaFechar = db.obterListaAtiva(chatJid);

            if (!listaParaFechar) {
                await sock.sendMessage(chatJid, { text: '❌ Não há nenhuma lista ativa no momento.' });
                return;
            }

            // Permite que o criador da lista também feche
            const isCriador = listaParaFechar.criado_por === senderJid;

            if (!isAdmin && !isCriador && !isOwner) {
                await sock.sendMessage(chatJid, { text: '❌ Apenas administradores ou o criador da lista podem encerrar a lista.' });
                return;
            }

            if (db.encerrarLista) {
                db.encerrarLista(listaParaFechar.id);
            } else {
                // Fallback se o método não existir (embora devesse)
                console.error('Método encerrarLista não encontrado no db');
            }

            await sock.sendMessage(chatJid, { text: '✅ Lista encerrada com sucesso!' });
            return;
        }

        // --- SUBCOMANDO: LIMPAR (Remove todos os membros, mantém lista ativa) ---
        if (subcomando === 'limpar' || subcomando === 'clear' || subcomando === 'zerar') {
            // Verifica permissão (Admin, Criador da lista ou Dono do bot)
            const isAdmin = await this.verificarPermissao(sock, chatJid, senderJid, db);
            const isOwner = permissionLevel === 'owner';
            const listaParaLimpar = db.obterListaAtiva(chatJid);

            if (!listaParaLimpar) {
                await sock.sendMessage(chatJid, { text: '❌ Não há nenhuma lista ativa no momento.' });
                return;
            }

            const isCriador = listaParaLimpar.criado_por === senderJid;

            if (!isAdmin && !isCriador && !isOwner) {
                await sock.sendMessage(chatJid, { text: '❌ Apenas administradores ou o criador da lista podem limpar a lista.' });
                return;
            }

            // Remove todos os membros mas mantém a lista
            const membrosAntigos = db.obterMembrosLista(listaParaLimpar.id);
            if (membrosAntigos.length === 0) {
                await sock.sendMessage(chatJid, { text: '❌ A lista já está vazia.' });
                return;
            }

            db.prepare('DELETE FROM membros_lista WHERE id_lista = ?').run(listaParaLimpar.id);

            await sock.sendMessage(chatJid, { text: `✅ Lista limpa! ${membrosAntigos.length} membro(s) removido(s).\n\nA lista continua ativa e pronta para novos membros.` });
            return this.mostrarLista(sock, chatJid, db);
        }

        // --- SUBCOMANDO: EDITAR (Edita nome de um membro) ---
        if (subcomando === 'editar' || subcomando === 'edit' || subcomando === 'renomear') {
            const listaParaEditar = db.obterListaAtiva(chatJid);

            if (!listaParaEditar) {
                await sock.sendMessage(chatJid, { text: '❌ Não há nenhuma lista ativa no momento.' });
                return;
            }

            if (args.length < 2) {
                await sock.sendMessage(chatJid, { text: '❌ Use: !lista editar [número] [novo_nome]\n\nExemplo: !l editar 3 João Silva' });
                return;
            }

            const numero = parseInt(args[0]);
            const novoNome = args.slice(1).join(' ');

            if (isNaN(numero) || numero < 1) {
                await sock.sendMessage(chatJid, { text: '❌ Número inválido. Use o número do membro na lista.' });
                return;
            }

            const membros = db.obterMembrosLista(listaParaEditar.id);
            if (numero > membros.length) {
                await sock.sendMessage(chatJid, { text: `❌ Não existe membro número ${numero} na lista.` });
                return;
            }

            const membroParaEditar = membros[numero - 1];

            // Atualiza o nome do usuário no banco
            db.atualizarNomeUsuario(membroParaEditar.id_usuario, novoNome);

            await sock.sendMessage(chatJid, { text: `✅ Nome atualizado com sucesso!\n\n${numero}. ${novoNome}` });
            return this.mostrarLista(sock, chatJid, db);
        }

        // --- SUBCOMANDO: STATS (Estatísticas da lista) ---
        if (subcomando === 'stats' || subcomando === 'estatisticas' || subcomando === 'info') {
            // Busca todas as listas já criadas neste grupo (ativas e inativas)
            const todasListas = db.prepare('SELECT * FROM listas_grupo WHERE id_grupo = ? ORDER BY criado_em DESC').all(chatJid);

            if (todasListas.length === 0) {
                await sock.sendMessage(chatJid, { text: '📊 *ESTATÍSTICAS DE LISTAS*\n\n❌ Nenhuma lista foi criada neste grupo ainda.' });
                return;
            }

            const listaAtiva = todasListas.find(l => l.ativa);
            const totalListas = todasListas.length;

            // Conta participações únicas
            const participacoesUnicas = new Map();
            let totalParticipacoes = 0;

            for (const lista of todasListas) {
                const membros = db.obterMembrosLista(lista.id);
                totalParticipacoes += membros.length;

                for (const membro of membros) {
                    const count = participacoesUnicas.get(membro.id_usuario) || 0;
                    participacoesUnicas.set(membro.id_usuario, count + 1);
                }
            }

            // Top 3 participantes
            const ranking = Array.from(participacoesUnicas.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            let statsMsg = '📊 *ESTATÍSTICAS DE LISTAS*\n\n';
            statsMsg += `📋 Total de listas criadas: *${totalListas}*\n`;
            statsMsg += `👥 Total de participações: *${totalParticipacoes}*\n`;
            statsMsg += `🎯 Participantes únicos: *${participacoesUnicas.size}*\n`;

            if (listaAtiva) {
                const membrosAtivos = db.obterMembrosLista(listaAtiva.id);
                statsMsg += `✅ Lista ativa agora: *${membrosAtivos.length} membro(s)*\n`;
            } else {
                statsMsg += `❌ Nenhuma lista ativa no momento\n`;
            }

            if (ranking.length > 0) {
                statsMsg += '\n🏆 *TOP PARTICIPANTES:*\n';
                for (let i = 0; i < ranking.length; i++) {
                    const [userId, count] = ranking[i];
                    const usuario = db.obterUsuario(userId);
                    const nome = usuario?.nome || userId.split('@')[0];
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    statsMsg += `${medal} ${nome} - ${count} participaç${count > 1 ? 'ões' : 'ão'}\n`;
                }
            }

            await sock.sendMessage(chatJid, { text: statsMsg });
            return;
        }

        // --- COMANDO PRINCIPAL: ENTRAR OU MOSTRAR ---

        let listaAtiva = db.obterListaAtiva(chatJid);
        const nomeEntrada = args.join(' ');

        if (nomeEntrada) {
            // É uma tentativa de entrar na lista
            if (!listaAtiva) {
                // Cria lista
                const tituloPadrao = db.obterTituloPadraoLista(chatJid) || 'Lista Geral';
                db.criarLista(chatJid, tituloPadrao, senderJid);
                listaAtiva = db.obterListaAtiva(chatJid);
            }

            // Atualiza o nome do usuário no banco global se for um JID
            if (senderJid.includes('@s.whatsapp.net')) {
                db.atualizarNomeUsuario(senderJid, nomeEntrada);
            }

            try {
                const resultado = db.adicionarMembroLista(listaAtiva.id, senderJid);
                if (!resultado) {
                    await sock.sendMessage(chatJid, { text: '⚠️ Você já está na lista! Use *!lista sair* se quiser sair.' });
                } else {
                    await sock.sendMessage(chatJid, { text: `✅ Você entrou na lista como "${nomeEntrada}"!` });
                }
            } catch (e) {
                console.error(e);
            }

            return this.mostrarLista(sock, chatJid, db);

        } else {
            // Apenas "!lista" -> Mostrar lista
            if (!listaAtiva) {
                const tituloPadrao = db.obterTituloPadraoLista(chatJid) || 'Lista Geral';
                db.criarLista(chatJid, tituloPadrao, senderJid);
                listaAtiva = db.obterListaAtiva(chatJid);

                // Adiciona automaticamente quem criou a lista
                const usuario = db.obterUsuario(senderJid);
                const nomeUsuario = usuario && usuario.nome ? usuario.nome : senderJid.split('@')[0];
                db.adicionarMembroLista(listaAtiva.id, senderJid);

                await sock.sendMessage(chatJid, { text: `🆕 Nova lista iniciada!\n✅ ${nomeUsuario} foi adicionado(a) à lista.` });
            }
            return this.mostrarLista(sock, chatJid, db);
        }
    },

    // Função auxiliar para verificar permissão de admin
    async verificarPermissao(sock, chatJid, senderJid, db) {
        try {
            const groupMetadata = await sock.groupMetadata(chatJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (e) {
            console.error('Erro ao verificar permissão:', e);
            return false;
        }
    },

    // Função auxiliar para formatar e mostrar a lista
    async mostrarLista(sock, chatJid, db) {
        const listaAtiva = db.obterListaAtiva(chatJid);
        if (!listaAtiva) return;

        const membros = db.obterMembrosLista(listaAtiva.id);
        const total = membros.length;

        // Formata a data
        const dataCriacao = new Date(listaAtiva.data_criacao).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        let texto = `📋 *${listaAtiva.titulo.toUpperCase()}*\n`;
        texto += `📅 ${dataCriacao}\n\n`;

        if (total === 0) {
            texto += '_A lista está vazia._\n';
        } else {
            for (let i = 0; i < membros.length; i++) {
                const m = membros[i];
                let nomeExibicao = m.id_usuario;

                // Se for JID, tenta pegar o nome do banco
                if (m.id_usuario.includes('@s.whatsapp.net')) {
                    const usuario = db.obterUsuario(m.id_usuario);
                    if (usuario && usuario.nome) {
                        nomeExibicao = usuario.nome;
                    } else {
                        // Tenta pegar do contato ou formata o número
                        nomeExibicao = m.id_usuario.split('@')[0];
                    }
                }

                texto += `${i + 1}. ${nomeExibicao}\n`;
            }
        }

        texto += `\n━━━━━━━━━━━━━━━━━━━\n`;
        texto += `ℹ️ *!l [nome]* para entrar\n`;
        texto += `ℹ️ *!l sair* para sair\n`;
        texto += `ℹ️ *!l ajuda* para ver mais opções`;

        await sock.sendMessage(chatJid, { text: texto });
    }
};
