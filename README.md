# Clínica Endodiagnose — Dashboard

Dashboard de gestão interna da **Clínica Endodiagnose**, desenvolvido em **React 19 + Vite 8**.  
O sistema permite controlar exames, fluxo de caixa, convênios, repasses médicos e folha de pagamento, com armazenamento local resiliente (`localStorage`), sincronização via **Firebase Cloud Firestore**, regras de auditoria e conformidade com diretrizes da **LGPD**.

---

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Executando o projeto](#executando-o-projeto)
- [Build de produção](#build-de-produção)
- [Testes e Validação Contínua](#testes-e-validação-contínua)
- [Configuração do Firebase](#configuração-do-firebase)
  - [Variáveis de ambiente (.env)](#variáveis-de-ambiente-env)
  - [Regras de Segurança do Firestore](#regras-de-segurança-do-firestore)
- [Segurança e Conformidade (LGPD)](#segurança-e-conformidade-lgpd)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Licença](#licença)

---

## Pré-requisitos

| Ferramenta | Versão mínima recomendada |
|------------|--------------------------|
| [Node.js](https://nodejs.org/) | **20+** (ES Modules e suporte React 19) |
| npm | **10+** (incluso no Node) |

> **Dica:** Verifique as versões instaladas com:
> ```bash
> node -v
> npm -v
> ```

---

## Instalação

1. **Clone o repositório:**
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

Inicie o servidor local de desenvolvimento:

```bash
npm run dev
```

O Vite disponibilizará o endereço — tipicamente **http://localhost:5173**.  
Qualquer alteração de código é atualizada instantaneamente via HMR (Hot Module Replacement).

---

## Build de produção

Para compilar os pacotes minificados e otimizados para deploy:

```bash
npm run build
```

Os artefatos são gerados no diretório `dist/`. Para pré-visualizar o build localmente:

```bash
npm run preview
```

---

## Testes e Validação Contínua

O projeto conta com uma suíte de testes automatizados com **Vitest**, cobrindo regras de negócio, persistência, migrações de schema (v1, v2, v3), utilitários e integração:

- **Executar todos os testes uma vez:**
  ```bash
  npm test
  ```
- **Modo interativo (watch):**
  ```bash
  npm run test:watch
  ```
- **Pipeline de Validação Completa (Lint + Testes + Build):**
  ```bash
  npm run ci
  ```

> O repositório inclui automação via **GitHub Actions** (`.github/workflows/ci.yml`), garantindo que todo pull request ou push na branch principal execute `npm run ci`.

---

## Configuração do Firebase

O dashboard funciona em modo **offline-first** com `localStorage`. Para sincronização em nuvem e compartilhamento seguro entre dispositivos autorizados, conecte um projeto Firebase (Firestore e Auth).

### Variáveis de ambiente (.env)

1. Crie o arquivo `.env` a partir do modelo:
   ```bash
   cp .env.example .env
   ```

2. Preencha com as credenciais do seu projeto Firebase Console:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=meu-projeto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=meu-projeto
   VITE_FIREBASE_STORAGE_BUCKET=meu-projeto.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

### Regras de Segurança do Firestore

As regras estão declaradas em `firestore.rules`:
- Apenas usuários autenticados pertencentes à lista permitida possuem acesso de leitura e escrita.
- Trilha de auditoria (`audit_logs`) imutável (*append-only*): nenhuma entrada de auditoria pode ser modificada ou apagada.
- Validação estrutural de campos essenciais.

Para publicar as regras no Firebase:
```bash
npx firebase-tools deploy --only firestore:rules
```

---

## Segurança e Conformidade (LGPD)

- **Bloqueio por Inatividade:** Proteção de tela automática após período sem interação, exigindo PIN numérico de 4 dígitos para desbloqueio da sessão.
- **Controle de Acesso:** Autenticação restrita via Google Auth com allowlist de e-mails corporativos.
- **Auditoria de Operações:** Registro de alterações sensíveis, exclusões e restaurações.
- **Tratamento de Dados de Saúde:** Estrutura pronta para minimização e isolamento de identificadores médicos e de pacientes.
- **Acessibilidade:** Componentes modais equipados com focus trap acessível, suporte a teclado (`Escape`, `Tab`) e atributos ARIA (`aria-live`, `aria-current`).

---

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento Vite com HMR |
| `npm run build` | Compila o bundle otimizado de produção em `dist/` |
| `npm run preview` | Executa o servidor de pré-visualização do build |
| `npm run lint` | Analisa o código com o linter [OxLint](https://oxc.rs/) |
| `npm test` | Roda a suíte completa de testes unitários com Vitest |
| `npm run test:watch` | Roda os testes em modo contínuo (reexecuta ao salvar) |
| `npm run ci` | Executa a validação canônica de CI (`lint` + `test` + `build`) |

---

## Estrutura de pastas

```
DashboardED/
├── .github/
│   └── workflows/
│       └── ci.yml             # Pipeline de Integração Contínua (GitHub Actions)
├── public/                    # Favicon e ícones estáticos
├── src/
│   ├── assets/                # Imagens e marcas
│   ├── components/            # Componentes reutilizáveis
│   │   ├── AutoCompleteInput.jsx
│   │   ├── CloudSyncModal.jsx     # Sincronização e status do Firebase
│   │   ├── ConfirmDialog.jsx
│   │   ├── ConvenioFluxoModal.jsx # Modais de criação rápida
│   │   ├── DetalhesFormModal.jsx  # Formulário de edição de detalhes
│   │   ├── ErrorBoundary.jsx
│   │   ├── ExportMenu.jsx
│   │   ├── FolhaTable.jsx         # Tabela isolada de folha de pagamento
│   │   ├── FolhaTotalsBar.jsx     # Barra de totais e indicadores da folha
│   │   ├── Modal.jsx              # Modal com focus trap e suporte ARIA
│   │   ├── Sidebar.jsx            # Navegação lateral com aria-current
│   │   └── ToastContainer.jsx     # Notificações com aria-live
│   ├── pages/                 # Telas principais do sistema
│   │   ├── OverviewPage.jsx       # Painel de indicadores gerais
│   │   ├── ExamesPage.jsx         # Cadastro e lista de exames
│   │   ├── ConveniosPage.jsx      # Controle por convênio médico
│   │   ├── FluxoCaixaPage.jsx     # Gestão financeira de entradas/saídas
│   │   ├── DetalhesPage.jsx       # Detalhamento clínico e financeiro
│   │   ├── RepassePage.jsx        # Cálculo e repasse médico
│   │   └── FolhaPage.jsx          # Gestão da folha de colaboradores
│   ├── services/
│   │   └── firebase.js            # Inicialização e comunicação com Firestore/Auth
│   ├── styles/                # CSS Modularizado
│   │   ├── variables.css          # Cores, fontes, sombras e tokens de design
│   │   ├── layout.css             # Grid, flex, sidebar, tabelas e responsividade
│   │   ├── components.css         # Botões, cards, inputs, modais e badges
│   │   └── pages/                 # Estilos específicos de cada módulo/página
│   ├── utils/
│   │   ├── helpers.js             # Funções de formatação e cálculos
│   │   ├── storage.js             # Gerenciamento local, versionamento e schemas
│   │   └── __tests__/             # Testes automatizados (Vitest)
│   ├── App.jsx                # Componente orquestrador da aplicação
│   ├── main.jsx               # Ponto de entrada React
│   └── index.css              # Ponto de importação dos módulos CSS
├── firestore.rules            # Regras de segurança e autorização do Firestore
├── vite.config.js             # Configuração do Vite e Vitest
├── package.json
└── README.md
```

---

## Funcionalidades

- 📊 **Visão Geral** — Painel consolidado com faturamento, exames realizados, ticket médio e gráficos.
- 🩺 **Exames** — Lançamento ágil de procedimentos e valores.
- 🏥 **Convênios** — Acompanhamento de glosas, valores por operadora e status.
- 💰 **Fluxo de Caixa** — Entradas, saídas e conciliação diária/mensal.
- 📋 **Detalhes** — Ficha completa por paciente e procedimento.
- 🔄 **Repasses Médicos** — Cálculo automatizado de comissões por médico e procedimento (Schema v3).
- 👥 **Folha de Pagamento** — Gestão de salários, adicionais e encargos da equipe.
- 🔒 **PIN de Inatividade & LGPD** — Proteção de tela com bloqueio por tempo ocioso.
- ☁️ **Sincronização Cloud & Backup** — Backup com timestamp e histórico local, sincronizável com Firestore.
- 📤 **Exportação de Relatórios** — Download estruturado em formato CSV/JSON.

---

## Tecnologias

| Tecnologia | Finalidade |
|------------|------------|
| [React 19](https://react.dev/) | Interface de usuário declarativa e reativa |
| [Vite 8](https://vite.dev/) | Ferramenta de build moderna e ultrarrápida |
| [Vitest](https://vitest.dev/) | Test runner nativo ESM com cobertura de testes |
| [Firebase / Firestore](https://firebase.google.com/) | Autenticação Google e banco NoSQL na nuvem |
| [OxLint](https://oxc.rs/) | Linter de alto desempenho em Rust |
| [Design System Modular](src/styles/) | CSS puro com CSS Custom Properties e layout responsivo |

---

## Licença

Projeto proprietário de uso interno da **Clínica Endodiagnose**. Todos os direitos reservados.

