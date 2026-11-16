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

* **GitHub:** [https://github.com/luirton/AxiPlayerTV.git](https://github.com/luirton/AxiPlayerTV.git)
* **GitLab:** `https://gitlab.com/luirton/AxiPlayerTV.git`
* **Package / Bundle ID:** `com.axiplayertv.app`
* **Nome de Exibição:** `Axi Player TV`

---

## 3. Arquitetura e Decisões Técnicas

| Componente | Especificação TV |
| :--- | :--- |
| **Framework Base** | **React Native + Expo SDK 58** (Expo Router, TypeScript) |
| **Orientação** | Fixa em **`landscape`** (16:9 horizontal) |
| **Modo Android TV** | `android.software.leanback = true`, `android.hardware.touchscreen = false` |
| **Launcher Android** | `android.intent.category.LEANBACK_LAUNCHER` + Banner 320x180 (16:9) |
| **Tráfego de Rede** | HTTP/HTTPS Cleartext habilitado (`networkSecurityConfig`) para compatibilidade universal com provedores IPTV |
| **Motor de Foco** | Sistema de foco D-pad com elevação de escala (scale 1.05x), borda viva em gradiente âmbar/laranja (`#FFA000` / `#FF6A00`) e glow suave |
| **Engine de Vídeo** | `expo-video` (ExoPlayer nativo no Android) otimizado para reprodução contínua e zapping instantâneo |
| **Backend & Dados** | Conexão direta com APIs Xtream Codes e listas M3U/M3U8 com persistência local via AsyncStorage |

---

## 4. Design e Telas (Baseado nas Fotos Oficiais)

### 4.1 Menu Lateral Retrátil (Sidebar Retrátil)
* **Estado Recolhido:** Faixa vertical estreita à esquerda exibindo apenas ícones elegantes:
  * 👤 Perfil / Conexão
  * 🔍 Busca Global
  * 🏠 Início (Home)
  * 📺 TV Ao Vivo (Live Streams)
  * 🎬 Filmes (VOD)
  * 🍿 Séries
  * ⭐ Favoritos
  * ⚙️ Configurações
* **Estado Expandido:** Ao pressionar **Esquerda** no controle remoto, o menu desliza suavemente sobre o conteúdo, revelando os textos e status da lista com fundo semi-transparente Dark OLED (`rgba(10, 10, 10, 0.95)`).

### 4.2 Dashboard TV (Home)
* **Hero Banner Dinâmico:** Destaque em widescreen 16:9 com pôster em alta definição, classificação indicativa, nota TMDB, ano e sinopse.
* **Fileiras Horizontais de Carrossel (Rows):**
  * Fileira 1: Continuar Assistindo (retoma de onde parou)
  * Fileira 2: Canais Mais Assistidos / Favoritos
  * Fileira 3: Filmes em Lançamento
  * Fileira 4: Séries em Destaque

### 4.3 Módulo TV Ao Vivo com OSD Translúcido (Live OSD)
* **Reprodução Contínua em Tela Cheia:** Ao abrir o módulo, o último canal assistido toca em tela cheia no fundo.
* **Painel Duplo Sobreposto (Split OSD):**
  * Pressionar **OK** ou **Esquerda** abre a gaveta de categorias e canais sobreposta à esquerda:
    * Coluna 1: Categorias (ex: Esportes, Filmes, Notícias, Variedades).
    * Coluna 2: Lista de canais da categoria selecionada com logo, número e programa atual (EPG).
  * O vídeo continua rodando ao fundo ou em mini janela PIP fluida.
* **Zapping no Controle Remoto:**
  * Tecla **Cima / Baixo**: Troca de canal imediatamente exibindo o mini-banner inferior de informações (Canal, Logo, Programa Atual e Barra de Progresso do EPG) que some após 4 segundos de inatividade.
* **Tecla Voltar (Back Button):**
  * Se o menu OSD estiver aberto: Fecha o menu OSD e mantém o vídeo em tela cheia.
  * Se já estiver em tela cheia: Exibe diálogo de confirmação "Deseja sair para o menu principal?".

### 4.4 Módulo VOD (Filmes e Séries)
* **Visualização em Paisagem com Prévia Rápida:**
  * Ao navegar com o foco sobre os pôsteres dos filmes/séries, o topo da tela atualiza dinamicamente a capa horizontal (backdrop), trailer/teaser, sinopse detalhada e botões:
    * `[ ▶ Assistir ]`
    * `[ ℹ Detalhes / Sinopse ]`
    * `[ ⭐ Favoritar ]`
* **Tela de Séries:**
  * Seletor horizontal de Temporadas (Temporada 1, Temporada 2...)
  * Grade horizontal de episódios com miniatura, título e duração.

---

## 5. Estrutura de Diretórios do `axi-player-tv`

```text
axi-player-tv/
├── android/                   # Código nativo Android TV gerado pelo prebuild
├── app/                       # Rotas da aplicação (Expo Router)
│   ├── _layout.tsx            # Provedor global de foco e orientação Landscape
│   ├── index.tsx              # Splash / Roteamento automático de sessão
│   ├── login.tsx              # Tela de login D-Pad friendly
│   ├── (tv)/
│   │   ├── _layout.tsx        # Shell da TV com Sidebar Retrátil
│   │   ├── home.tsx           # Dashboard principal
│   │   ├── live.tsx           # TV ao Vivo com OSD sobreposto
│   │   ├── movies.tsx         # Catálogo de Filmes em Paisagem
│   │   ├── series.tsx         # Catálogo de Séries com temporadas
│   │   ├── search.tsx         # Teclado virtual TV e busca global
│   │   └── settings.tsx       # Configurações do app e lista
│   └── player/
│       └── [id].tsx           # Player de reprodução avançado para TV
├── assets/
│   ├── banner.png             # Banner Android TV Leanback (320x180 ou 1920x1080)
│   ├── icon.png               # Ícone do aplicativo
│   └── splash.png             # Splash screen 16:9
├── plugins/
│   ├── withAndroidTV.js       # Config plugin para Leanback Launcher e permissões
│   └── withCleartextTraffic.js# Config plugin para tráfego HTTP/IPTV
├── src/
│   ├── components/
│   │   ├── tv/
│   │   │   ├── FocusableCard.tsx       # Card com feedback visual para D-Pad
│   │   │   ├── FocusableButton.tsx     # Botão com glow e animação de foco
│   │   │   ├── TVSidebar.tsx           # Menu retrátil lateral
│   │   │   ├── TVLiveOSD.tsx           # Sobreposição de canais e EPG ao vivo
│   │   │   └── TVHeader.tsx            # Cabeçalho com hora, data e status de conexão
│   ├── services/              # Xtream API, M3U parser, EPG, Storage
│   ├── theme/                 # Paleta de cores Cinema OLED
│   └── types/                 # Tipagens TypeScript para canais e VOD
├── app.json                   # Manifesto Expo configurado para Android TV
├── package.json               # Dependências do projeto
└── tsconfig.json              # Configuração TypeScript
```

---

## 6. Checklist de Implementação

- [x] Repositório oficial GitHub configurado: `luirton/AxiPlayerTV`
- [x] Arquivo de documentação arquitetural criado (`PROJECT_TV.md`)
- [x] Criação do projeto base `axi-player-tv`
- [x] Configuração do `app.json` com `isTV: true`, `orientation: "landscape"` e plugin Leanback
- [x] Implementação do Plugin Expo para Leanback Launcher e Cleartext Traffic
- [x] Migração e adaptação dos serviços de conexão Xtream Codes e M3U
- [x] Desenvolvimento dos componentes focáveis de controle remoto (`FocusableCard`, `FocusableButton`)
- [x] Implementação da Sidebar Retrátil com navegação D-Pad
- [x] Implementação da tela de TV Ao Vivo com player contínuo e OSD translúcido (`TVLiveOSD` + zapping)
- [x] Implementação dos catálogos de Filmes e Séries em modo Paisagem (Backdrop dinâmico, temporadas e episódios)
- [x] Configuração de push duplo para GitHub e GitLab
