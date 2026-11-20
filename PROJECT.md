# Axi Player TV (Android TV & Google TV Edition)

## 1. Visão Geral
O **Axi Player TV** é a versão dedicada para televisores inteligentes do ecossistema Axi Player, especialmente otimizado para **Google TV (TCL, Philips, Sony), Android TV (Mi Box, Fire TV Stick, Chromecast com Google TV)** e TV Boxes.

Diferente do app mobile, o **Axi Player TV** é construído desde a raiz para:
* **Orientação Exclusiva em Paisagem (Landscape 16:9 - 1080p / 4K UHD)**.
* **Navegação 100% por Controle Remoto (D-Pad: Cima, Baixo, Esquerda, Direita, OK/Select, Voltar)**.
* **Compatibilidade Nativa Leanback**: Aparece na grade principal de aplicativos da Google TV com banner panorâmico oficial (16:9).
* **Player Imersivo com OSD Multicamadas (On-Screen Display)**: O vídeo nunca para de tocar enquanto o usuário navega por categorias, canais e guia de programação (EPG).

---

## 2. Repositórios e Versionamento

* **Autor / Criador:** **Luirton Gurgel** ([GitHub: @luirton](https://github.com/luirton))
* **GitHub Oficial:** [https://github.com/luirton/AxiPlayerTV.git](https://github.com/luirton/AxiPlayerTV.git)
* **GitLab Oficial:** [https://gitlab.com/luirton/AxiPlayerTV.git](https://gitlab.com/luirton/AxiPlayerTV.git)
* **Package / Bundle ID:** `com.axiplayertv.app`
* **Nome de Exibição:** `Axi Player TV`
* **EAS Project ID:** `2eacb59e-51b4-44fd-bdfd-19dcd2d4da4d`

---

## 3. Arquitetura e Decisões Técnicas

| Componente | Especificação TV |
| :--- | :--- |
| **Framework Base** | **React Native + Expo SDK 58** (Expo Router, TypeScript) |
| **Orientação** | Fixa em **`landscape`** (16:9 horizontal) |
| **Modo Android TV** | `android.software.leanback = true`, `android.hardware.touchscreen = false` |
| **Launcher Android** | `android.intent.category.LEANBACK_LAUNCHER` + Banner 320x180 (16:9) |
| **Tráfego de Rede** | HTTP/HTTPS Cleartext habilitado (`networkSecurityConfig`) para compatibilidade universal com provedores IPTV |
| **Motor de Foco** | Sistema de foco D-pad com elevação de escala (scale 1.05x), borda viva em gradiente Neon Cyan e Purple (`#00E5FF` / `#A855F7`) e glow suave |
| **Identidade Visual** | **Axi Neon Cyan & Purple/Magenta** (`#00E5FF`, `#A855F7`, `#D946EF`, fundo `#070A12`) |
| **Engine de Vídeo** | `expo-video` (ExoPlayer nativo no Android) otimizado para reprodução contínua e zapping instantâneo |
| **Backend & Dados** | Conexão direta com APIs Xtream Codes e listas M3U/M3U8 com persistência local via AsyncStorage |

---

## 4. Design e Telas (Baseado nas Fotos Oficiais)

### 4.0 Nova Tela de Login Panorâmica Split-Screen (2 Colunas 16:9)
* **Coluna Esquerda:**
  * Emblema 3D translúcido com animação de pulso neon (`assets/emblem_transparent.png`).
  * Título oficial: **AxiPlayer TV** (Android TV & Google TV Edition).
  * Card com guia de navegação por controle remoto (D-Pad + tecla OK).
  * Autoria oficial: **Created by Luirton Gurgel** com link para o GitHub (@luirton).
* **Coluna Direita:**
  * Seletor de abas amigável para controle remoto:
    1. **Link da Lista (M3U / HLS / Curto):** Parser em tempo real que extrai credenciais de URLs de IPTV completas ou links curtos com detecção visual imediata e fallback inteligente (correção de porta `:80` e download M3U).
    2. **Servidor / Usuário:** Conexão manual via Xtream Codes API com tratamento automático de URLs e portas.
  * **Seção de Listas Conectadas Anteriormente (Multi-Contas):**
    * Cards focáveis para reconexão rápida em 1 clique e botão de exclusão da lista.

### 4.1 Nova Splash Screen Dinâmica 16:9 (`app/index.tsx`)
* Animação do emblema 3D translúcido com escala suave e pulso neon contínuo.
* Feedback de status de inicialização em tempo real: *"Iniciando..."*, *"Verificando perfil salvo..."*, *"Carregando lista IPTV..."*, *"Pronto!"*.
* Rodapé de autoria oficial: *"Axi Player TV • Created by Luirton Gurgel"*.

### 4.2 Menu Lateral Retrátil (Sidebar Retrátil)
* **Estado Recolhido:** Faixa vertical estreita à esquerda exibindo apenas o emblema neon e ícones elegantes:
  * 🔍 Busca Global
  * 🏠 Início (Home)
  * 📺 TV Ao Vivo (Live Streams)
  * 🎬 Filmes (VOD)
  * 🍿 Séries
  * ⚙️ Ajustes / Configurações
* **Estado Expandido:** Ao focar à esquerda no controle remoto, o menu desliza suavemente sobre o conteúdo, revelando textos e status da lista com fundo semi-transparente Dark OLED (`rgba(7, 10, 18, 0.98)`).

### 4.3 Dashboard TV (Home)
* **Hero Spotlight Dinâmico:** Destaque em widescreen 16:9 com pôster em alta definição, classificação indicativa, nota TMDB, ano, sinopse e botão *"ASSISTIR AGORA"* com foco preferencial.
* **Carrosséis Horizontais de Conteúdo:**
  * **⭐ Meus Canais Favoritos:** Carrossel dinâmico dos canais de TV favoritados pelo usuário.
  * **▶ Continuar Assistindo:** Histórico com barra de progresso visual de reprodução.
  * **🕒 Assistir Depois:** Lista salva de filmes e séries para assistir mais tarde.
  * **⚡ Plataformas de Streaming:** Carrossel de marcas (Netflix, Prime Video, Disney+, Max, etc.) com modal D-pad para alternar entre Filmes e Séries.
  * **📺 Canais Ao Vivo em Destaque:** Lista dos canais retornados pelo provedor IPTV.
  * **🎬 Filmes em Lançamento:** Catálogo de filmes recentes.
  * **🍿 Séries em Destaque:** Catálogo de séries populares.

### 4.4 Módulo TV Ao Vivo com OSD Translúcido (Live OSD)
* **Reprodução Contínua em Tela Cheia:** Ao abrir o módulo, o último canal assistido toca em tela cheia no fundo.
* **Painel Duplo Sobreposto (Split OSD):**
  * Pressionar **OK** ou **Esquerda** abre a gaveta de categorias e canais sobreposta à esquerda:
    * Coluna 1: Categorias (ex: Esportes, Filmes, Notícias, Variedades).
    * Coluna 2: Lista de canais da categoria selecionada com logo, número e programa atual (EPG).
  * O vídeo continua rodando ao fundo sem interrupção.
* **Guia Lateral de Zapping & Painel Dinâmico de Detalhes (Padrão TiviMate):**
  * **Foco Natural e Eliminação de Alvos Invisíveis:** Removida a antiga técnica de botões invisíveis com timers. Agora, o foco do D-Pad navega diretamente e suavemente na lista de canais sem perda de foco e sem ping-pong entre canais.
  * **Painel Dinâmico de Detalhes em Tempo Real:** Conforme o usuário sobe ou desce no D-Pad na lista de canais, a Coluna 3 atualiza instantaneamente com o logo grande, nome, status e guia EPG do canal focado (`previewChannel`).
  * **Favoritar no Guia (⭐):**
    * *Botão Dedicado:* Na Coluna 3 de Detalhes, botão em destaque `[ ⭐ Adicionar aos Favoritos ]` / `[ Remover dos Favoritos ]` acessível com seta para a direita.
    * *Atalho Long Press:* Segurar a tecla OK por 800ms em qualquer canal da lista alterna o status de favorito na hora com a estrela dourada `★`.
  * **Reprodução e Expansão:** Pressionar OK em qualquer canal sintoniza a transmissão e fecha o guia para tela cheia. Pressionar OK ou as setas na tela cheia reabre o guia com o foco posicionado no canal que está tocando.

  * **Eliminação Total da Imagem de Alvo na Abertura:** Remoção nativa em styles.xml, colors.xml (#070A12), substituição dos drawables de splash por imagens limpas e remoção do glowHalo no app/index.tsx.


* **Tecla Voltar (Back Button):**
  * Se o menu OSD estiver aberto: Fecha o menu OSD e mantém o vídeo em tela cheia.
  * Se já estiver em tela cheia: Exibe diálogo de confirmação "Deseja sair para o menu principal?".

### 4.5 Novo Catálogo em Grade (Grid) de Filmes e Séries (Padrão Imagem 3)
* **Barra de Categorias no TOPO:**
  * O carrossel horizontal de categorias fica posicionado no topo absoluto da tela tanto em filmes quanto em séries, eliminando o antigo banner vertical volumoso.
  * Cabeçalho completo com botão circular Voltar `[ ← ]`, nome da categoria ativa, contagem total de títulos (`2.090 títulos`) e botões de ordenação:
    * `[ Padrão ]`
    * `[ A-Z ]`
    * `[ Z-A ]`
* **Painel de Preview Compacto do Item Focado:**
  * Abaixo da barra de categorias, um painel compacto (~115dp) exibe dinamicamente o backdrop do item com degradê escuro, título grande, badge `[ FILME ]` ou `[ SÉRIE ]`, nota `★ 8.4`, formato `4K UHD`, ano e sinopse em 2 linhas.
* **Grade (Grid) com Rolagem Vertical:**
  * Grade em 6 colunas ocupando todo o restante da tela, permitindo visualizar de 12 a 18 pôsteres simultaneamente na TV com rolagem vertical suave via D-Pad.
  * Posters enriquecidos via `EnrichedPosterImage` com tratamento de falhas e badges visuais.
  * Ao navegar com as teclas direcionais (Cima/Baixo/Esquerda/Direita), o preview compacto superior atualiza dinamicamente em tempo real.
  * Ao pressionar **OK** em qualquer card da grade, abre imediatamente a **Tela de Detalhes Cinematográfica (Imagem 4)**.

### 4.8 Nova Tela de Detalhes Cinematográfica da Mídia (Padrão Imagem 4)
* **Visualização Imersiva em Tela Cheia:**
  * Tela modal nativa cobrindo 100% da área da TV (inclusive sobrepondo a sidebar), isolando o foco D-Pad e eliminando fugas de navegação.
  * **Correção da Navegação D-Pad (Imagem 2):** Ao estar posicionado no botão circular Voltar `[ < ]` e pressionar a tecla **PARA BAIXO**, o foco desce estritamente para o botão de ação principal `[ ▶ Assistir ]`, sem qualquer fuga para a barra lateral.
* **Backdrop Panorâmico e Identidade:**
  * Imagem backdrop em alta definição no topo com degradê suave para o fundo dark `#070A12`.
  * Título grande em negrito 32px (`fontWeight: '900'`) e linha de metadados: `Ano • Categoria • Duração • ⭐ Nota`.
* **Botão Principal Neon de Destaque:**
  * Botão largo com gradiente Neon Cyan/Purple (`#00E5FF` a `#A855F7`) **`[ ▶ Assistir ]`** (ou `[ ▶ Assistir T1:E1 ]` para séries), com foco preferencial automático (`hasTVPreferredFocus={true}`).
* **Sinopse Completa e Ações Rápidas:**
  * Sinopse completa com tipografia nítida e confortável para leitura na sala.
  * Linha de botões de ação:
    * `[ + Minha lista ]` / `[ ✓ Na lista ]` (armazenamento persistente)
    * `[ 🕒 Assistir depois ]` / `[ ✓ Salvo ]`
    * `[ ⭐ Favoritar ]` / `[ ⭐ Favoritado ]`
* **Para Séries: Temporadas e Episódios:**
  * Seletor horizontal de Temporadas: `[ Temporada 1 (10) ]`, `[ Temporada 2 (8) ]`...
  * Carrossel horizontal de cards de episódios com miniaturas enriquecidas, número do episódio (`EP. 01`), duração, título e sinopse. Pressionar OK em qualquer episódio inicia sua reprodução imediatamente.
* **Seção "Você também pode gostar":**
  * Carrossel horizontal no rodapé com até 14 títulos recomendados da mesma categoria. Clicar em qualquer recomendado atualiza a tela de detalhes instantaneamente.

### 4.9 Player VOD com Seek Contínuo ao Segurar (+/- 10s e Aceleração Progressiva) e Gestão de Faixas
* **Seek Simples e Contínuo ao Segurar (Fast-Forward / Rewind Dinâmico):**
  * **Toque Rápido (< 300ms):** Salto padrão de 10 segundos (`+10s` / `-10s`).
  * **Segurar o Botão (Hold):** Ao segurar o botão de avançar ou retroceder no controle remoto ou tela, engata avanço contínuo com aceleração progressiva (5s -> 15s -> 30s -> 60s por tick) enquanto o botão estiver pressionado, exibindo a minutagem em tempo real e aplicando ao soltar.
* **Play / Pause:** Tecla central OK pausa e retoma o vídeo instantaneamente.
* **Seletor de Áudio e Legendas:** Modais dedicados para troca de faixas de áudio e legendas nativas do stream.
* **Tratamento Inteligente da Tecla Voltar:** Fecha o OSD/modais sem parar a reprodução; se o OSD já estiver oculto, exibe diálogo com a posição salva para continuar depois.
* **Salvamento de Posição:** Persistência periódica do progresso para a fila de "Continuar Assistindo".

### 4.6 Teclado Virtual TV & Busca Global (`app/(tv)/search.tsx`)
* Teclado virtual completo otimizado para o D-Pad do controle remoto com teclas alfanuméricas e ações rápidas (`ESPAÇO`, `APAGAR`, `LIMPAR`).
* Campo de busca em tempo real com retorno integrado de canais ao vivo e filmes VOD.

### 4.7 Configurações do App (`app/(tv)/settings.tsx`)
* Card de Perfil Ativo com status de conexão.
* Preferências de transmissão e motor de decodificação de vídeo.
* Card oficial de autoria: **Luirton Gurgel** (GitHub: github.com/luirton).
* Ações de limpeza de cache de EPG e desconexão de conta.

---

## 5. Estrutura de Diretórios do `axi-player-tv`

```text
axi-player-tv/
├── android/                   # Código nativo Android TV gerado pelo prebuild
├── app/                       # Rotas da aplicação (Expo Router)
│   ├── _layout.tsx            # Provedor global de foco e orientação Landscape
│   ├── index.tsx              # Splash Screen dinâmica animada 16:9
│   ├── login.tsx              # Tela de login split-screen (2 colunas) D-Pad friendly
│   ├── (tv)/
│   │   ├── _layout.tsx        # Shell da TV com Sidebar Retrátil
│   │   ├── home.tsx           # Dashboard principal com carrosséis e hero banner
│   │   ├── live.tsx           # TV ao Vivo com OSD sobreposto e zapping
│   │   ├── movies.tsx         # Catálogo de Filmes em Paisagem
│   │   ├── series.tsx         # Catálogo de Séries com temporadas
│   │   ├── search.tsx         # Teclado virtual TV e busca global
│   │   └── settings.tsx       # Configurações do app e autoria
│   └── player/
│       └── [id].tsx           # Player de reprodução avançado para TV
├── assets/
│   ├── emblem_transparent.png # Emblema 3D neon oficial
│   ├── splash_screen.png      # Fundo oficial splash widescreen
│   ├── icon.png               # Ícone oficial True-PNG
│   ├── splash-icon.png        # Ícone de splash screen
│   └── android-icon-foreground.png
├── plugins/
│   ├── withAndroidTV.js       # Plugin nativo Leanback Launcher e touchscreen=false
│   ├── withAndroidTV/
│   │   └── app.plugin.js      # Wrapper de exportação do plugin para Expo CLI
│   ├── withCleartextTraffic.js# Plugin para tráfego HTTP/IPTV irrestrito
│   └── withCleartextTraffic/
│       └── app.plugin.js      # Wrapper de exportação do plugin para Expo CLI
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   └── FocusableItem.tsx
│   │   ├── home/
│   │   │   └── StreamingBrands.tsx
│   │   └── tv/
│   │       ├── FocusableCard.tsx       # Card com elevação e borda Cyan neon
│   │       ├── FocusableButton.tsx     # Botão com gradiente Cyan/Purple e glow
│   │       ├── TVSidebar.tsx           # Menu retrátil lateral com novo emblema
│   │       ├── TVLiveOSD.tsx           # Sobreposição de canais e EPG ao vivo
│   │       └── TVHeader.tsx            # Cabeçalho com hora, data e status
│   ├── services/
│   │   ├── epgParser.ts
│   │   ├── linkParser.ts               # Parser inteligente de links IPTV/M3U
│   │   ├── m3uParser.ts                # Leitor e analisador M3U/M3U8
│   │   ├── parentalControl.ts          # Controle parental com PIN
│   │   ├── permissions.ts              # Gerenciador de permissões Android
│   │   ├── storage.ts                  # Persistência AsyncStorage
│   │   └── xtreamClient.ts             # Cliente Xtream Codes API
│   ├── theme/
│   │   └── colors.ts                   # Paleta oficial Cinema OLED e Neon Cyan/Purple
│   └── types/
│       └── iptv.ts                     # Interfaces TypeScript IPTV
├── app.json                   # Manifesto Expo configurado para Android TV
├── eas.json                   # Configuração EAS Build (Cloud e Local)
├── package.json               # Dependências do projeto (com expo-font)
└── tsconfig.json              # Configuração TypeScript
```

---

## 6. Checklist de Implementação

- [x] Repositório oficial GitHub configurado: `luirton/AxiPlayerTV`
- [x] Arquivo de documentação arquitetural criado (`PROJECT.md`)
- [x] Criação do projeto base `axi-player-tv`
- [x] Configuração do `app.json` com `isTV: true`, `orientation: "landscape"` e plugin Leanback
- [x] Implementação do Plugin Expo para Leanback Launcher e Cleartext Traffic
- [x] Migração e adaptação dos serviços de conexão Xtream Codes e M3U
- [x] Desenvolvimento dos componentes focáveis de controle remoto (`FocusableCard`, `FocusableButton`)
- [x] Implementação da Sidebar Retrátil com navegação D-Pad
- [x] Implementação da tela de TV Ao Vivo com player contínuo e OSD translúcido (`TVLiveOSD` + zapping)
- [x] Implementação dos catálogos de Filmes e Séries em modo Paisagem (Backdrop dinâmico, temporadas e episódios)
- [x] Configuração de push duplo para GitHub e GitLab
- [x] Migração para nova identidade visual Neon Cyan & Purple/Magenta e novos assets de alta definição
- [x] Nova Splash Screen dinâmica 16:9 com animação de emblema e status de carregamento
- [x] Nova tela de Login split-screen (2 colunas) com Smart Link (M3U/HLS/Curto), dados Xtream e Multi-contas
- [x] Dashboard TV integrado com Canais Favoritos, Continuar Assistindo, Assistir Depois e Marcas de Streaming
- [x] Ajustes nos plugins customizados com `expo/config-plugins` e criação de `app.plugin.js`
- [x] Configuração de `"appVersionSource": "remote"` no `eas.json` para builds EAS

---

## 7. Diário de Bordo & Registro de Conversas

### Sessão: 16 de Novembro de 2026
* **Alinhamento Inicial:**
  * O usuário solicitou replicar todas as melhorias do aplicativo mobile (`axi-player`) no projeto de TV (`axi-player-tv`), consultando antes qualquer dúvida.
  * Foi realizado o alinhamento sobre a estrutura panorâmica split-screen (2 colunas) para o Login e a atualização imediata dos assets e paleta de cores.
* **Execução das Melhorias:**
  * Cópia dos novos assets true-PNG e emblema 3D neon para a pasta `assets/`.
  * Atualização de `src/theme/colors.ts` para Neon Cyan (`#00E5FF`) e Purple (`#A855F7`).
  * Criação da Splash Screen animada 16:9 (`app/index.tsx`) com feedback de carregamento em tempo real.
  * Refatoração da tela de Login (`app/login.tsx`) em 2 colunas com suporte a Smart Link, dados Xtream, detecção de credenciais em tempo real, multi-tentativas com fallback e lista de contas salvas.
  * Integração de carrosséis de Favoritos, Continuar Assistindo, Assistir Depois e Marcas de Streaming no Dashboard (`app/(tv)/home.tsx`).
  * Inclusão do rodapé e card de autoria oficial *"Created by Luirton Gurgel"* com links para o GitHub.
  * Compilação TypeScript validada com 0 erros (`npx tsc --noEmit`).
* **Sincronização e Push:**
  * Commit realizado: `f00c4a1`
  * Enviado via push duplo para o GitHub (`origin main`) e GitLab (`gitlab main`).
* **Suporte a Build EAS / WSL:**
  * O usuário informou erro de resolução de plugin (`Cannot find module '@expo/config-plugins'`) e aviso de `appVersionSource` ao rodar na WSL.
  * Corrigido import dos plugins para `expo/config-plugins`, criados os arquivos `app.plugin.js`, configurado `appVersionSource: "remote"` no `eas.json` e adicionado `expo-font`.
  * Novo commit: `b59887b` enviado com sucesso para o GitHub e GitLab.

### Sessão: 17 de Novembro de 2026
* **Portabilidade de Melhorias e Redesign de Filmes/Séries:**
  * **Categorias no TOPO (Imagem 1 & 3):** Reposicionamento do carrossel horizontal de categorias no topo absoluto da tela tanto em filmes quanto em séries (`app/(tv)/movies.tsx` e `app/(tv)/series.tsx`), eliminando o antigo layout vertical truncado.
  * **Novo Catálogo em Grade (Grid) 16:9 (Imagem 3):**
    * Cabeçalho de categoria com botão circular Voltar `[ ← ]`, título em caixa alta, contagem total de títulos (`2.090 títulos`) e botões de ordenação (`Padrão`, `A-Z`, `Z-A`).
    * Painel de preview compacto superior com backdrop dinâmico, nota `★`, formato e sinopse em 2 linhas do item focado.
    * Grade vertical com 6 colunas, exibindo múltiplos títulos simultaneamente e permitindo navegação suave pelo D-Pad.
  * **Nova Tela de Detalhes Cinematográfica (Imagem 4):**
    * Ao clicar em qualquer filme ou série, abre a tela de detalhes imersiva em tela cheia (modal nativo isolado).
    * Botão largo com gradiente Neon Cyan/Purple `[ ▶ Assistir ]` com foco preferencial automático (`hasTVPreferredFocus={true}`).
    * Sinopse completa, botões de ação rápida (`[ + Minha lista ]`, `[ 🕒 Assistir depois ]`, `[ ⭐ Favoritar ]`).
    * Para séries: seletor de temporadas e carrossel horizontal de episódios com miniaturas e metadados.
    * Seção "Você também pode gostar" com carrossel de títulos recomendados da mesma categoria.
  * **Correção da Navegação D-Pad (Imagem 2):**
    * Resolvido o problema de fuga de foco para o menu lateral (TVSidebar) ao pressionar a tecla "Para Baixo" a partir do botão Voltar `[ < ]`. Com a tela de detalhes em janela modal nativa e o botão `[ ▶ Assistir ]` posicionado logo abaixo do cabeçalho, o foco desce estritamente para o botão de ação.
  * **Enriquecimento de Metadados e Pôsteres:**
    * Criação de `src/services/metadataEnricher.ts` com busca automática no IMDb (`v3.sg.media-imdb.com`), Cinemeta e iTunes Brasil com fallback e cache em memória/AsyncStorage.
    * Criação de `src/components/common/EnrichedPosterImage.tsx` com estilo de foco neon e fallback automático em caso de URLs IPTV quebradas.
  * **Blindagem do XtreamClient & Otimização de Performance:**
    * Implementado `apiCache` com TTL de 10 min para prevenir OOM e re-download de JSONs de 25MB+.
    * Timeouts diferenciados (12s para categoria, 45s geral com retorno `[]` gracioso).
    * Fallback automático para a primeira categoria em caso de falha em `getSeries()`.
    * Carga sob demanda no boot de Filmes, Séries e Início (`home.tsx`), abrindo as telas em menos de 300ms.
  * **Player VOD com Seek D-Pad (+/- 10s):**
    * Mapeamento de teclas direcionais Esquerda/Direita para avanço e recuo de 10s com banner feedback neon, play/pause na tecla OK, seletor de trilhas de áudio e legendas, e diálogo de saída com salvamento de progresso.
  * **Gerenciador de Recarregamento de Lista (3 a 5 dias):**
    * Opções de intervalo configuráveis no menu de Ajustes (`settings.tsx`), exibição do tempo da última sincronização e botão para forçar atualização imediata.
  * Compilação TypeScript validada com **0 erros** (`tsc --noEmit`).

### Sessão: 18 de Novembro de 2026
* **Refatoração Completa com Base no Feedback Real na TCL TV (9 Imagens):**
  * **Imagem 1 (Navegação de Canais ao Vivo):**
    * Implementada ponte vertical de navegação D-Pad em tela cheia (`dpadTargetHidden` superior/inferior + `centerFocusRef`).
    * Teclas direcionais ▲ (Cima) e ▼ (Baixo) efetuam zapping sequencial imediato de canais com abertura do banner OSD.
    * Inclusão dos botões focáveis no banner OSD: `[ Anterior (▲) ]`, `[ Guia (OK) ]`, `[ ⭐ Favorito ]` e `[ Próximo (▼) ]`.
  * **Imagem 2 & 9 (Novo Player de Vídeo VOD Padrão Imagem 9):**
    * Remoção da captura de foco do container raiz que bloqueava a navegação do D-Pad para os controles inferiores.
    * Layout 100% fiel à Imagem 9:
      * Barra superior com botão Voltar `←`, título centralizado e grupo de 5 ícones: Informações `(i)`, Favorito `♡`, Legendas `[CC]`, Áudio `🎵` e Proporção/Tela Cheia `⛶`.
      * Slider vertical de Brilho com ícone de Sol na lateral esquerda.
      * Slider vertical de Volume com ícone de Alto-Falante na lateral direita.
      * Controles centrais circulares: `-10s` (sentido anti-horário), botão gigante central de Play/Pause (foco preferencial) e `+10s` (sentido horário).
      * Barra inferior com tempo decorrido, linha de progresso azul e thumb circular azul (scrubber) e tempo total.
  * **Imagem 3 (Redesign da Home Screen):**
    * Destaque (Spotlight) redesenhado em layout lado a lado: pôster menor com badge "DESTAQUE" à esquerda e título, badges 4K/nota/ano, sinopse e botões de ação à direita.
    * Substituição da lista de streaming por carrossel de **Categorias** reais carregadas dinamicamente via Xtream Codes.
    * Ao clicar em qualquer filme ou no banner de destaque, agora abre a tela de descrição/detalhes em vez de ir direto para o player.
  * **Imagens 4, 7 e 8 (Tela de Detalhes Cinematográfica com Versões Alternativas):**
    * Criação do componente isolado e reutilizável `TVMovieDetailsModal.tsx` fiel à Imagem 8:
      * Cabeçalho com botão `[ ← Voltar ]`.
      * Título em caixa alta, sinopse, chips de gênero e botões de ação: `[ ▶ Assistir ]` (Amarelo vibrante), `[ 🕒 Assistir Depois ]`, `[ 📺 Trailer ]` e avaliação `★ | Ano`.
      * Container inferior com abas: `[ Elenco ]`, `[ Sinopse ]` e `[ Versões (X) ]`.
      * Aba **Versões**: busca automática de versões adicionais do mesmo filme em outras categorias da lista IPTV (ex: Pedidos, Lançamentos, 4K), com badge `VOCÊ ESTÁ AQUI` na versão atual e aviso orientador: *"O mesmo título em outras versões da sua lista. Se uma não abrir, tente outra."* (solucionando o travamento da Imagem 7).
  * **Imagens 5 e 6 (Correção de Foco e Indicador Visual de Seleção):**
    * Criação do componente `FocusablePill.tsx` com controle de estado `isFocused` individual.
    * Destaque de alto contraste para Android TV: borda dourada/amarela (`#FFD700`, 3px), escala ampliada (`scale: 1.08`), elevação e cores ativas contrastantes para categorias e botões de ordenação (`Padrão`, `A-Z`, `Z-A`) em Filmes e Séries.
  * **Limpeza de Código Morto:**
    * Removidos arquivos obsoletos não utilizados: `StreamingBrands.tsx`, `FocusableItem.tsx` e `FloatingTabBar.tsx`, além de pastas vazias.
  * Compilação TypeScript validada com **0 erros** (`npx tsc --noEmit`).

* **Ajustes da Segunda Rodada de Feedback (Imagens 1 a 5):**
  * **Imagem 1 (TV Ao Vivo - Remoção de Hotspot & Voltar Abre Guia):**
    * Removido o `hotspotBar` (retângulo superior direito com setas de toque e botão lista).
    * Tecla Voltar (`hardwareBackPress`) durante o vídeo em tela cheia agora abre imediatamente a gaveta completa de canais (`isDrawerOpen: true`).
  * **Imagem 2 (TV Ao Vivo - Clique Direto & Voltar para Home):**
    * Ao clicar em qualquer canal na lista do guia, sintoniza e fecha imediatamente a gaveta para tela cheia (`setIsDrawerOpen(false)`).
    * Tecla Voltar quando o guia de canais estiver aberto redireciona para a Home (`/(tv)/home`).
  * **Imagem 3 (Layout da Tela de Séries):**
    * Redesenhada a tela de detalhes de séries no layout lado a lado com pôster e badge `DESTAQUE` à esquerda, e à direita: badges 4K UHD, nota IMDb, ano, sinopse, tags de gênero, botão `[ ▶ Assistir T1:E1 ]`, ações e trailer.
    * Aba `TEMPORADAS & EPISÓDIOS` com `FocusablePill` amarelo nas temporadas e cards horizontais de episódios.
  * **Imagem 4 (Layout de Detalhes de Filmes & Versões Alternativas):**
    * Redesenhado o modal de filmes (`TVMovieDetailsModal.tsx`) em layout lado a lado com botão `[ ▶ Assistir ]` amarelo de alto contraste e aba `Versões (X)` abaixo com pesquisa cruzada no catálogo.
  * **Imagem 5 (Remoção do Preview Compacto no Topo do Catálogo):**
    * Removido o bloco de preview compacto (`compactPreviewContainer`) tanto do catálogo de Filmes (`movies.tsx`) quanto de Séries (`series.tsx`), deixando o grid de títulos limpo e direto.
  * **Padronização Visual do Botão Voltar:**
    * Criado o componente `TVBackButton.tsx` padronizando todos os botões de retorno do app com a seta `arrow-back` e destaque amarelo `#FFD700`.
  * **Sistema de Estilo e Cores Unificado (tvTheme.ts):**
    * Criado o arquivo central de design system `src/theme/tvTheme.ts` e exportado através de `src/theme/index.ts` e `colors.ts`.
    * **Aplicação Rigorosa das Cores Oficiais do Sistema (Axi Neon Cyan & Purple):**
      * Eliminados os tons isolados de amarelo e laranja em botões de ação e pílulas.
      * **Botões Assistir:** Tanto em Filmes quanto em Séries e Home, utilizam a cor oficial do sistema **Axi Neon Cyan (`#00E5FF`)** com texto de alto contraste Dark OLED (`#070A12`) e anel de foco branco/cyan com escala de elevação `1.08`.
      * **Seletor de Temporadas (`FocusablePill`):** Segue as cores oficiais do sistema em Cyan `#00E5FF` quando ativo/selecionado com texto `#070A12` e fundo Dark Navy `#151C30` quando inativo.
      * **Botões de Ordenação ("Padrão", "A-Z", "Z-A"):** Removido o tom laranja e padronizado com o Neon Cyan `#00E5FF` do sistema.
      * **Botão "Guia (OK)" no OSD de TV ao Vivo:** Ajustado para o Neon Cyan `#00E5FF` oficial do sistema.
      * **Badges de Destaque:** Padronizados com o Roxo Neon Axi (`#A855F7`).
      * Estrelas de avaliação (`⭐`) mantêm dourado apenas para o ícone de nota IMDb/TMDB.
  * Compilação TypeScript validada com **0 erros** (`npx tsc --noEmit`).

* **Ajustes da Terceira Rodada de Feedback (Continuar Assistindo, Scrubber Draggable & Fallback de Versão):**
  * **Botão "Continuar Assistindo" em Branco Exclusivo no Modal de Saída do Player:**
    * **Modal de Saída do Player (`app/player/[id].tsx`):** O botão "Continuar Assistindo" destacado no diálogo de confirmação de saída foi mantido com fundo branco sólido (`#FFFFFF`) e texto em preto negrito (`#000000`) para alto contraste na TV.
    * **Botões "Assistir" nas Telas (Filmes, Séries e Home):** Todos os botões primários de reprodução ("Assistir", "Assistir T1:E1" e "ASSISTIR AGORA") retornaram à sua cor **azulada oficial do sistema (Axi Neon Cyan `#00E5FF`)** com texto escuro e ícone escuro `#070A12`.
  * **Sistema Centralizado de Design e Classes de Estilo (`src/theme/tvTheme.ts`):**
    * Criado o Design System oficial em `src/theme/tvTheme.ts` contendo:
      * `tvColors`: Paleta de cores oficial (Dark OLED `#070A12`, Neon Cyan `#00E5FF`, Neon Purple `#A855F7`, textos, bordas e badges).
      * `tvStyles`: Classes centrais reutilizáveis como `watchButton` (botão azulado oficial), `watchButtonFocused`, `watchButtonText`, `dialogBtnContinueWhite`, `actionIconBtn`, `trailerButton`, `badge4K` e `badgeDestaque`.
      * `tvTypography`, `tvSpacing` e `tvRadius`.
    * Integrado diretamente nos componentes e telas: `TVMovieDetailsModal.tsx`, `app/(tv)/series.tsx`, `app/(tv)/home.tsx`, `TVBackButton.tsx` e `FocusablePill.tsx`.
  * **Avançar o Filme Arrastando o Progresso (Scrubber Draggable via PanResponder):**
    * Implementado controle interativo de seek na timeline do player VOD (`app/player/[id].tsx`) usando `PanResponder`.
    * Suporta arrasto touch/mouse/pointer com cálculo em tempo real de `(touchX / width) * duration`.
    * Feedback visual instantâneo durante o arrasto: atualização da barra de progresso, posição do thumb e tooltip flutuante estilizado exibindo o tempo alvo (`[ hh:mm:ss ]`). Ao soltar (release), o player salta imediatamente para o tempo selecionado via `player.seekBy` / `player.currentTime`.
  * **Detecção Automática de Falha de Carregamento & Sugestão de Próxima Versão:**
    * Criado o serviço `src/services/iptvVersions.ts` para normalização de títulos e busca cruzada de filmes com nomes semelhantes em todas as categorias da lista IPTV.
    * No player (`app/player/[id].tsx`), implementado monitoramento de status com watchdog timer (15s de buffering/erro). Caso o stream falhe:
      * Dispara busca automática por versões alternativas do mesmo filme.
      * Se houver outra versão disponível: exibe modal informando o problema e sugerindo a próxima versão com botão `[ ▶ Tentar Próxima Versão ]` em branco de 1-clique.
      * Se não houver outra versão: exibe modal informativo "Conteúdo Indisponível" com opção de retornar ao catálogo.
  * Compilação TypeScript validada com **0 erros** (`npx tsc --noEmit`).

* **Limpeza Geral de Código Morto e Otimização Arquitetural:**
  * **Serviços Obsoletos Removidos:**
    * `src/services/parentalControl.ts`: Utilitário não integrado ao fluxo de TV.
    * `src/services/permissions.ts`: Módulo de permissões de armazenamento do app mobile, desnecessário na TV.
    * `src/services/uiState.ts`: Singleton legado de orientação/fullscreen para mobile.
  * **Otimização de Catálogo (Filmes & Séries):**
    * Removidos imports não utilizados (`Modal`, `Dimensions`, `LinearGradient`, `FocusableButton`, `EnrichedPosterImage` em `movies.tsx`).
    * Removidos estados e timers desnecessários de preview que disparavam chamadas de rede no evento `onFocus` (`previewMeta`, `debounceTimerRef`).
    * Eliminadas mais de 280 linhas de regras de estilos legados não utilizados (`compactPreviewContainer`, `previewMetaRow`, `detailsScreenContainer`, `primaryWatchButton`, etc.).
  * **Resumo Arquitetural das Telas:**
    1. **`app/index.tsx` (Splash Screen):** Inicialização widescreen 16:9, validação de perfil ativo e redirecionamento automático com autoria oficial.
    2. **`app/login.tsx` (Login Split-Screen 16:9):** Conexão por Link IPTV (M3U/HLS/Encurtador) ou Servidor/Usuário/Senha Xtream Codes, com gerenciamento multi-contas.
    3. **`app/(tv)/_layout.tsx` (Shell com Sidebar Retrátil):** Sidebar retrátil de alta ergonomia D-Pad com atalhos para Busca, Home, Ao Vivo, Filmes, Séries e Ajustes.
    4. **`app/(tv)/home.tsx` (Dashboard TV):** Spotlight de destaque cinematográfico, carrossel de categorias reais, canais favoritos, histórico "Continuar Assistindo" com barra de progresso e lançamentos.
    5. **`app/(tv)/live.tsx` (TV Ao Vivo com OSD Split):** Reprodução contínua em tela cheia ao fundo, zapping vertical direto via D-Pad (▲/▼), gaveta split de categorias/canais e botão Voltar contextual.
    6. **`app/(tv)/movies.tsx` (Catálogo de Filmes Grid):** Barra superior de categorias com filtros de ordenação e grid focável de alta performance que abre o modal de detalhes.
    7. **`app/(tv)/series.tsx` (Catálogo de Séries com Temporadas):** Grid de séries, modal de detalhes completo lado a lado com seletor de temporadas e cards horizontais de episódios.
    8. **`app/(tv)/search.tsx` (Busca Global com Teclado TV):** Teclado virtual na tela adaptado para D-Pad com busca simultânea em canais ao vivo e catálogo VOD.
    9. **`app/(tv)/settings.tsx` (Ajustes & Gerenciador de Lista):** Dados da conta, sincronização programada da lista (3 a 5 dias), recarregamento forçado, limpeza de cache e nova seção **"MINHAS LISTAS & COLEÇÕES"** com grid focável e modal gerenciador de 4 abas (*Favoritos*, *Continuar Assistindo*, *Minha Lista*, *Assistir Depois*) com ações de reproduzir e excluir.
    10. **`app/player/[id].tsx` (Player Widescreen Imersivo):** ExoPlayer nativo com timeline interativa, avanço arrastável (draggable scrubber com tooltip de tempo flutuante), controles de volume/brilho, detecção de falha de carregamento com fallback automático para versão alternativa e modal de saída com botão branco de alto contraste.
  * Compilação TypeScript validada com **0 erros** (`npx tsc --noEmit`).


### Sessão: 19 de Novembro de 2026
* **Estabilização da TV ao Vivo, Refinamento de Foco e Limpeza dos Players:**
  * **Correção do Zapping Automático na TV ao Vivo (`live.tsx` e `TVLiveOSD.tsx`):**
    * Identificada a causa raiz da troca automática e contínua de canais: quando o banner de zapping auto-fechava (timer de 4.5s) e desmontava da árvore de visualizações, o foco no Android TV era perdido e caía involuntariamente no primeiro alvo focalizável do topo (`dpadTargetHidden`), disparando repetidamente o evento `onFocus` (`handleZapping('prev')`).
    * Implementada trava temporal de navegação D-Pad (`timeSinceCenter < 300ms`) e debounce de 600ms em `handleZapping`. O zapping agora só é aceito se o usuário tiver navegado intencionalmente a partir do centro da tela.
    * Removido `hasPreferredFocus={true}` forçado do botão "Guia (OK)" no OSD, evitando o roubo e perda de foco na desmontagem do banner.
    * O foco primário no player em tela cheia agora permanece estável e contínuo no alvo central.
  * **Correção Visual do CSS de Foco das Categorias no Home (`TVCategoryBrandCard.tsx`):**
    * Substituído o antigo visual lavado em cinza translúcido (`rgba(255,255,255,0.12)`) por preenchimento vibrante na cor de destaque da marca (`accentColor`) ao focar.
    * Borda de alto contraste branco sólido (`#FFFFFF`, 2.5px), elevação 14 e cálculo inteligente de contraste de texto (`isLightColor` para escolher entre texto escuro `#070A12` ou branco `#FFFFFF`).
    * Ajustado `paddingVertical` do carrossel no Home para evitar cortes de sombra e borda nos cards escalados (1.06x).
  * **Correção do Layout de Seleção D-Pad nos Modais de Saída e Confirmação (`player/[id].tsx` e `live.tsx`):**
    * Identificado que o padrão `style={({ focused }: any) => ...}` não recebia o estado de foco no React Native core, mantendo botões estáticos durante a navegação.
    * Criado o componente dedicado `FocusableDialogButton` com controle de estado `isFocused` local via `onFocus`/`onBlur`.
    * **"Continuar Assistindo":** Fundo branco sólido com anel de foco em Neon Cyan (`#00E5FF`, 2.5px), elevação 14, scale 1.08x e texto em preto negrito.
    * **"Salvar e Sair":** Fundo Neon Cyan (`#00E5FF`) com texto escuro e borda branca de destaque no foco.
    * Aplicado também aos diálogos de erro, trilhas de áudio e legendas.
  * **Remoção de Funções Inoperantes de Brilho e Volume no Player (`player/[id].tsx`):**
    * Removidos os estados `volume` e `brightness`, funções `handleAdjustVolume` e `handleAdjustBrightness`, camada de escurecimento simulado e sliders verticais laterais (esquerdo e direito), despoluindo a tela e eliminando armadilhas de foco nas laterais do player VOD.
  * Compilação TypeScript validada com **0 erros** (`npx tsc --noEmit`).


### Sessão: 20 de Novembro de 2026
* **Restauração da Barra de Ações do Player TV ao Vivo & Clique Direto da Gaveta:**
  * **Restauração da Navegação e Layout de Seleção na Barra OSD (`TVLiveOSD.tsx`):**
    * Restabelecida a navegação fluida por D-Pad entre os 4 botões da barra inferior: `[ Anterior (▲) ]`, `[ Guia (OK) ]`, `[ ⭐ Favorito ]` e `[ Próximo (▼) ]`.
    * Aplicado o layout oficial de seleção nos botões com preenchimento em Neon Cyan (`#00E5FF`), borda de alto contraste branco sólido (`#FFFFFF`, 2.5px), texto e ícone em preto de alta legibilidade (`#070A12`, 900), elevação `14` e escala `1.10x`.
    * O foco agora se posiciona inteligentemente no botão acionado (`initialBannerFocus`), permitindo que cliques sucessivos em `Anterior` ou `Próximo (Avança)` troquem de canal continuamente sem travar após uma única troca.
    * A camada de captura de tela cheia agora é desativada quando a barra de zapping está aberta (`!isZappingBannerOpen`), permitindo que o foco caia livremente sobre os botões da barra.
  * **Clique Direto da Lista de Categoria > Canal para o Player:**
    * Ao selecionar qualquer canal na lista de `Categorias > Canais` dentro da gaveta, o aplicativo fecha imediatamente o menu (`setIsDrawerOpen(false)`), suprime a sobreposição do banner e sintoniza a transmissão diretamente em tela cheia no player.
  * **Correção da Tecla Voltar (Back):**
    * Pressionar Voltar enquanto a barra de zapping estiver visível agora apenas fecha a barra, mantendo a reprodução contínua em tela cheia (adicionado `return true;`), sem reabrir a gaveta.
  * Compilação TypeScript validada com **0 erros** (`npx tsc --noEmit`).
