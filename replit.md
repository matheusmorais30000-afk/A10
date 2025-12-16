# Bot Discord - Gerenciamento de Partidas Free Fire

## Visão Geral
Bot completo para gerenciamento de partidas competitivas de Free Fire (Apostas/Wagers) com sistema de filas, ranking, tickets e mediação.

## Estrutura do Projeto
```
├── index.js                    # Arquivo principal do bot
├── src/
│   ├── commands/               # Comandos slash
│   │   ├── config.js           # Painel administrativo
│   │   ├── pix.js              # Registro de chave PIX
│   │   ├── black.js            # Gerenciar blacklist
│   │   ├── vencedor.js         # Definir vencedor/perdedor
│   │   ├── id.js               # Enviar ID/senha da sala
│   │   └── filas.js            # Configurar filas de partida
│   ├── events/                 # Eventos do Discord
│   │   ├── ready.js            # Evento de inicialização
│   │   ├── interactionCreate.js # Handler de interações
│   │   └── messageCreate.js    # Comando .p para perfil
│   ├── database/               # Banco de dados SQLite
│   │   └── db.js               # Funções do banco
│   └── utils/                  # Utilitários
│       ├── embeds.js           # Criação de embeds
│       ├── permissions.js      # Verificação de permissões
│       └── qrcode.js           # Geração de QR Code PIX
├── data.db                     # Banco de dados SQLite
└── temp/                       # Arquivos temporários (QR Codes)
```

## Comandos Disponíveis
- `/config` - Painel de configuração (Admin)
- `/pix` - Registrar chave PIX (Mediador)
- `/black` - Gerenciar blacklist (Analista/Mediador)
- `/vencedor @ganhador @perdedor` - Registrar resultado (Mediador)
- `/id [sala] [senha]` - Enviar ID da partida (Mediador)
- `/filas` - Configurar categorias de filas (Admin)
- `.p @usuario` - Ver perfil do jogador

## Hierarquia de Cargos
1. **Analista (SS)** - Nível mais alto
2. **Mediador** - Intermediário das partidas
3. **Suporte** - Responsável por tickets
4. **Blacklist** - Usuários bloqueados

## Banco de Dados
O bot utiliza SQLite (better-sqlite3) com as seguintes tabelas:
- `config` - Configurações do servidor
- `usuarios` - Perfis, vitórias, derrotas, coins
- `blacklist` - Usuários banidos
- `partidas` - Partidas ativas
- `filas` - Filas configuradas
- `tickets` - Sistema de tickets

## Modalidades de Partida
- **Mobile** - Jogadores de celular
- **Emulador** - Jogadores de emulador
- **Tático** - Modo tático
- **Misto** - Mobile + Emulador

## Variáveis de Substituição nas Embeds
- `{{MODALIDADE}}` - Mobile, Emulador, Tático, Misto
- `{{TIPO}}` - 1v1, 2v2, 3v3, 4v4
- `{{PREÇO}}` - Valor da aposta

## Requisitos
- Node.js 18+
- Token do bot Discord (DISCORD_TOKEN)

## Configuração Inicial
1. Use `/config` para configurar valores, cargos e canais de log
2. Use `/filas` para criar os canais de partida
3. Mediadores devem registrar PIX com `/pix`

## Alterações Recentes
- Criação inicial do bot completo
- Sistema de filas com matchmaking automático
- Sistema de pagamento PIX com QR Code
- Sistema de ranking e tickets
- **Melhoria de navegação**: Adicionados botões de "Voltar" em todo o bot (/visual e /config)
- **Interface mais limpa**: Menus agora editam a mesma mensagem ao invés de criar novas (usando update())
