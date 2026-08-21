# Clínica Endodiagnose — Dashboard

Dashboard de gestão interna da **Clínica Endodiagnose**, desenvolvido em **React 19 + Vite 8**.  
O sistema permite controlar exames, fluxo de caixa, convênios, repasses médicos e folha de pagamento, com armazenamento local (`localStorage`) e sincronização opcional via **Firebase Cloud Firestore**.

---

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Executando o projeto](#executando-o-projeto)
- [Build de produção](#build-de-produção)
- [Configuração do Firebase (opcional)](#configuração-do-firebase-opcional)
  - [Via variáveis de ambiente (.env)](#via-variáveis-de-ambiente-env)
  - [Via interface do app](#via-interface-do-app)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)

---

## Pré-requisitos

| Ferramenta | Versão mínima recomendada |
|------------|--------------------------|
| [Node.js](https://nodejs.org/) | **18+** (testado com v26) |
| npm | **9+** (vem junto com o Node) |

> **Dica:** Você pode verificar as versões instaladas rodando:
> ```bash
> node -v
> npm -v
> ```

---

## Instalação

1. **Clone o repositório** (ou baixe o ZIP):

   ```bash
   git clone <url-do-repositorio>
   cd DashboardED
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

---

## Executando o projeto

Inicie o servidor de desenvolvimento com:

```bash
npm run dev
```

O Vite exibirá a URL local no terminal — geralmente **http://localhost:5173**.  
O Hot Module Replacement (HMR) está ativo: qualquer alteração nos arquivos reflete instantaneamente no navegador.

---

## Build de produção

Para gerar a versão otimizada para deploy:

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`.  
Para pré-visualizar o build localmente:

```bash
npm run preview
```

---

## Configuração do Firebase (opcional)

O dashboard funciona **100% offline** usando `localStorage`. Porém, se quiser backup na nuvem e sincronização entre dispositivos, você pode conectar um projeto Firebase (Firestore).

Há **duas formas** de configurar:

### Via variáveis de ambiente (.env)

1. Copie o arquivo de exemplo:

   ```bash
   cp .env.example .env
   ```

2. Preencha o `.env` com as credenciais do seu projeto Firebase:

   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=meu-projeto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=meu-projeto
   VITE_FIREBASE_STORAGE_BUCKET=meu-projeto.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

3. Reinicie o servidor de desenvolvimento (`npm run dev`).

> **Onde encontrar essas credenciais?**  
> No [Firebase Console](https://console.firebase.google.com/) → Seu Projeto → ⚙️ Configurações do projeto → Seus apps → Configuração do Firebase (SDK).

### Via interface do app

Dentro do dashboard, clique no botão **☁️ Backup / 🟢 Nuvem** (canto superior direito) para abrir o painel de configuração. Ali você pode:

- Colar o snippet de configuração do Firebase diretamente.
- Preencher os campos manualmente.
- Testar a conexão.
- Enviar dados locais para a nuvem ou restaurar dados da nuvem.

---

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento (Vite + HMR) |
| `npm run build` | Gera o build de produção na pasta `dist/` |
| `npm run preview` | Serve o build de produção localmente para testes |
| `npm run lint` | Roda o linter [OxLint](https://oxc.rs/) no código |

---

## Estrutura de pastas

```
DashboardED/
├── public/                  # Arquivos estáticos (favicon, ícones SVG)
├── src/
│   ├── assets/              # Assets internos (processados pelo Vite)
│   ├── components/          # Componentes reutilizáveis
│   │   ├── AutoCompleteInput.jsx
│   │   ├── CloudSyncModal.jsx   # Modal de configuração/sync Firebase
│   │   ├── ConfirmDialog.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── ExportMenu.jsx
│   │   ├── Modal.jsx
│   │   └── Sidebar.jsx
│   ├── pages/               # Páginas do dashboard
│   │   ├── OverviewPage.jsx     # Visão geral
│   │   ├── ExamesPage.jsx       # Gestão de exames
│   │   ├── ConveniosPage.jsx    # Exames por convênio
│   │   ├── FluxoCaixaPage.jsx   # Fluxo de caixa
│   │   ├── DetalhesPage.jsx     # Detalhes de exames
│   │   ├── RepassePage.jsx      # Repasses médicos
│   │   └── FolhaPage.jsx        # Folha de pagamento
│   ├── services/
│   │   └── firebase.js      # Integração com Firebase Firestore
│   ├── utils/
│   │   ├── storage.js       # CRUD local (localStorage) + sync cloud
│   │   └── helpers.js       # Funções auxiliares
│   ├── App.jsx              # Componente raiz com roteamento por abas
│   ├── main.jsx             # Entry point React
│   └── index.css            # Estilos globais
├── .env.example             # Modelo das variáveis de ambiente
├── index.html               # HTML base
├── vite.config.js           # Configuração do Vite
└── package.json
```

---

## Funcionalidades

- 📊 **Visão Geral** — Resumo consolidado dos indicadores da clínica.
- 🩺 **Exames** — Cadastro e gerenciamento de exames realizados.
- 🏥 **Convênios** — Controle de exames por convênio médico.
- 💰 **Fluxo de Caixa** — Registro de entradas e saídas financeiras.
- 📋 **Detalhes** — Informações detalhadas sobre cada exame.
- 🔄 **Repasses** — Gestão de repasses para médicos.
- 👥 **Folha de Pagamento** — Controle da folha de pagamento.
- ☁️ **Sincronização Cloud** — Backup e restauração via Firebase Firestore.
- 📤 **Exportação** — Exportação de dados.

---

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| [React 19](https://react.dev/) | UI e gerenciamento de estado |
| [Vite 8](https://vite.dev/) | Bundler e servidor de desenvolvimento |
| [Firebase / Firestore](https://firebase.google.com/) | Sincronização na nuvem (opcional) |
| [OxLint](https://oxc.rs/) | Linter de código |
| [Inter + Outfit](https://fonts.google.com/) | Tipografia (Google Fonts) |

---

## Licença

Projeto de uso interno da Clínica Endodiagnose.
