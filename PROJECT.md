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
* **Zapping no Controle Remoto:**
  * Tecla **Cima / Baixo**: Troca de canal imediatamente exibindo o mini-banner inferior de informações (Canal, Logo, Programa Atual e Barra de Progresso do EPG) que some após 4 segundos de inatividade.
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

### 4.9 Player VOD com Seek D-Pad (+/- 10s) e Gestão de Faixas
* **Seek no Controle Remoto:** Teclas Esquerda e Direita efetuam salto de 10 segundos com banner feedback em neon (`-10s` / `+10s`).
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
