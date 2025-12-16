const db = require('../database/db');
const { embedPerfil, embedErro } = require('../utils/embeds');

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(message, client) {
        // Ignorar bots
        if (message.author.bot) return;

        // Comando .p @usuario para ver perfil
        if (message.content.startsWith('.p ')) {
            try {
                // Pegar usuário mencionado
                const user = message.mentions.users.first();
                
                if (!user) {
                    return message.reply({ 
                        embeds: [embedErro('Erro', 'Você precisa mencionar um usuário! Uso: `.p @usuario`')],
                        allowedMentions: { repliedUser: false }
                    });
                }

                // Buscar dados do usuário
                const dados = db.getUsuario(user.id, message.guild.id);

                // Criar embed de perfil
                const embed = embedPerfil(user, dados);

                await message.reply({ 
                    embeds: [embed],
                    allowedMentions: { repliedUser: false }
                });

            } catch (error) {
                console.error('[ERRO] Comando .p:', error);
                message.reply({ 
                    embeds: [embedErro('Erro', 'Ocorreu um erro ao buscar o perfil.')],
                    allowedMentions: { repliedUser: false }
                }).catch(() => {});
            }
        }
    }
};
