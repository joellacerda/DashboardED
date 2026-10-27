export default function SecurityTab({
  inactivityMins,
  handleSaveInactivity,
  hasPin,
  pinInput,
  setPinInput,
  handleSavePin,
  handleClearPin,
  publicRegAllowed,
  allowedEmailsText,
  setAllowedEmailsText,
  handleSaveAllowedEmails,
  lastBackupIso,
  daysSinceBackup,
  exportAllDataAsJSON,
  onBackupDone,
  toast,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.25rem' }}>
      {/* Header explicativo */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25), rgba(15, 23, 42, 0.4))',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>🛡️</span>
        <div>
          <h4 style={{ margin: '0 0 0.25rem', fontSize: 'var(--text-base)', color: '#f8fafc' }}>
            Conformidade LGPD &amp; Segurança Clínica
          </h4>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Recursos ativos para proteção de dados sensíveis de saúde de pacientes (Lei nº 13.709/2018, Art. 5º e 11),
            incluindo bloqueio automático por inatividade, autenticação restrita, auditoria imutável e controle de backups.
          </p>
        </div>
      </div>

      {/* 1. Bloqueio por Inatividade */}
      <div className="card" style={{ padding: '1rem', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            ⏱️ Bloqueio Automático por Inatividade
          </div>
          <span className="badge badge-primary" style={{ fontSize: 'var(--text-xs)' }}>
            {inactivityMins === 0 ? 'Desativado' : `${inactivityMins} min`}
          </span>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
          Ao se ausentar do computador, a tela é bloqueada automaticamente com um desfoque de segurança, ocultando prontuários e valores até que o usuário insira o PIN ou faça login novamente.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Tempo limite de inatividade:</label>
          <select
            value={inactivityMins}
            onChange={(e) => handleSaveInactivity(e.target.value)}
            className="input-field"
            style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: 'var(--text-xs)' }}
          >
            <option value={5}>5 minutos (Recomendado para consultórios)</option>
            <option value={15}>15 minutos (Padrão)</option>
            <option value={30}>30 minutos</option>
            <option value={0}>Desativar bloqueio automático</option>
          </select>
        </div>
      </div>

      {/* 2. PIN de Acesso Rápido */}
      <div className="card" style={{ padding: '1rem', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            🔑 PIN Numérico de Desbloqueio Rápido
          </div>
          <span className={`badge ${hasPin ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 'var(--text-xs)' }}>
            {hasPin ? 'PIN Configurado' : 'Sem PIN Cadastrado'}
          </span>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
          Permite que você desbloqueie a tela de forma rápida digitando apenas uma senha numérica (4 a 8 dígitos) em vez de redigitar sua senha longa do e-mail.
        </p>
        <form onSubmit={handleSavePin} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Novo PIN (ex: 1234)"
            className="input-field"
            style={{ width: '180px', fontSize: 'var(--text-xs)', padding: '0.4rem 0.6rem' }}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            {hasPin ? 'Alterar PIN' : 'Salvar Novo PIN'}
          </button>
          {hasPin && (
            <button type="button" onClick={handleClearPin} className="btn btn-secondary btn-sm" style={{ color: 'var(--text-danger)' }}>
              Remover PIN
            </button>
          )}
        </form>
      </div>

      {/* 3. Controle de Cadastro e Allowlist */}
      <div className="card" style={{ padding: '1rem', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            👥 Restrição de Acesso &amp; Allowlist de E-mails
          </div>
          <span className="badge badge-success" style={{ fontSize: 'var(--text-xs)' }}>
            {publicRegAllowed ? 'Cadastro Livre' : 'Cadastro Restrito (LGPD)'}
          </span>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
          O cadastro público na tela inicial está <strong>desativado</strong> para impedir acesso de estranhos aos dados médicos. Opcionalmente, especifique e-mails ou domínios corporativos autorizados a fazer login (separados por vírgula):
        </p>
        <form onSubmit={handleSaveAllowedEmails} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            type="text"
            value={allowedEmailsText}
            onChange={(e) => setAllowedEmailsText(e.target.value)}
            placeholder="Ex: admin@endodiagnose.com.br, @endodiagnose.com.br (vazio = todos os cadastrados no Firebase)"
            className="input-field"
            style={{ width: '100%', fontSize: 'var(--text-xs)', padding: '0.4rem 0.6rem' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-secondary btn-sm">
              Salvar Lista de Usuários Autorizados
            </button>
          </div>
        </form>
      </div>

      {/* 4. Regras do Firestore e Imutabilidade */}
      <div className="card" style={{ padding: '1rem', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.5rem' }}>
          🔒 Regras de Segurança do Banco de Dados (`firestore.rules`)
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <li><strong>Autenticação Obrigatória:</strong> Nenhuma leitura ou escrita na nuvem é aceita sem usuário logado (<code>request.auth != null</code>).</li>
          <li><strong>Auditoria Imutável (Append-Only):</strong> A coleção <code>auditLogs</code> na nuvem permite apenas criação de registros. Não é permitido editar ou apagar logs no Firestore, assegurando rastreabilidade legal.</li>
          <li>Arquivo versionado no repositório: <code>firestore.rules</code> pronto para deploy via <code>firebase deploy --only firestore:rules</code>.</li>
        </ul>
      </div>

      {/* 5. Lembrete e Status de Backup */}
      <div className="card" style={{ padding: '1rem', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            💾 Histórico de Backups de Segurança
          </div>
          <span className={`badge ${daysSinceBackup !== null && daysSinceBackup < 7 ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 'var(--text-xs)' }}>
            {daysSinceBackup === null ? 'Sem Backup' : daysSinceBackup === 0 ? 'Realizado hoje' : `${daysSinceBackup} dia(s) atrás`}
          </span>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 0.75rem', lineHeight: 1.4 }}>
          {lastBackupIso
            ? `Último backup realizado em: ${new Date(lastBackupIso).toLocaleString('pt-BR')}.`
            : 'Nenhum backup registrado recentemente neste dispositivo.'}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            try {
              exportAllDataAsJSON();
              if (typeof onBackupDone === 'function') {
                onBackupDone();
              }
              toast.success('Backup completo gerado com sucesso!');
            } catch (err) {
              toast.error('Erro ao gerar backup: ' + err.message);
            }
          }}
        >
          📥 Gerar e Baixar Cópia de Segurança (.json) Agora
        </button>
      </div>
    </div>
  );
}
