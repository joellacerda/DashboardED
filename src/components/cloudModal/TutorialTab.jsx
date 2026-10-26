export default function TutorialTab({ onGoToConfig }) {
  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: '8px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        fontSize: 'var(--text-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        lineHeight: 1.5,
      }}
    >
      <h4 style={{ margin: 0, color: 'var(--accent-blue)' }}>
        Passo a Passo para criar seu Banco Gratuito no Firebase:
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <div>
          <strong>1. Criar o Projeto:</strong>
          <div>Acesse <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>console.firebase.google.com</a>, faça login com sua conta Google e clique em <strong>"Adicionar projeto"</strong> (ex: <code>endodiagnose-app</code>).</div>
        </div>

        <div>
          <strong>2. Ativar o Firestore Database:</strong>
          <div>No menu lateral do Firebase, clique em <strong>Criação &gt; Firestore Database</strong> &gt; clique no botão <strong>"Criar banco de dados"</strong>. Selecione a localização (ex: <code>southamerica-east1</code> para São Paulo) e escolha o modo de teste ou configure as regras.</div>
        </div>

        <div>
          <strong>3. Configurar Regras de Segurança do Firestore:</strong>
          <div>Na aba <strong>Regras (Rules)</strong> do Firestore Database, cole a regra segura abaixo e clique em <strong>Publicar</strong> (permite acesso apenas a usuários autenticados):</div>
          <pre style={{ background: 'var(--bg-surface)', padding: '0.6rem', borderRadius: '4px', fontSize: '11px', overflowX: 'auto', border: '1px solid var(--border-subtle)', color: 'var(--accent-emerald)' }}>
            {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}
          </pre>
        </div>

        <div>
          <strong>4. Ativar os Métodos de Login (Authentication):</strong>
          <div>No menu do Firebase, clique em <strong>Criação &gt; Authentication</strong> &gt; clique em <strong>"Começar"</strong>. Na aba <strong>Sign-in method</strong>, ative:</div>
          <ul style={{ paddingLeft: '1.2rem', margin: '0.4rem 0', fontSize: 'var(--text-xs)' }}>
            <li><strong>E-mail/senha</strong> (ative a primeira chave)</li>
            <li><strong>Google</strong> (ative e informe o e-mail de suporte)</li>
          </ul>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            *Dica: em <em>Settings &gt; Authorized domains</em>, verifique se <code>localhost</code> está na lista.
          </div>
        </div>

        <div>
          <strong>5. Obter as Chaves:</strong>
          <div>Clique no ícone de engrenagem ⚙️ (Configurações do projeto) &gt; role até <strong>"Seus aplicativos"</strong> e clique no ícone da Web <strong>(&lt;/&gt;)</strong>. Dê um apelido e copie o bloco de código com <code>const firebaseConfig = &#123; ... &#125;</code>.</div>
        </div>

        <div>
          <strong>6. Colar no App:</strong>
          <div>Vá para a aba <strong>"⚙️ Configurar Chaves"</strong> e cole o código copiado no campo de texto para preenchimento automático.</div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start' }}
        onClick={onGoToConfig}
      >
        Ir para Configurar Chaves ➔
      </button>
    </div>
  );
}
