import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function ManageMedicosModal({
  isOpen,
  onClose,
  allDoctors,
  newMedicoNome,
  setNewMedicoNome,
  newMedicoSocio,
  setNewMedicoSocio,
  handleAddMedico,
  toggleMedicoSocio,
  toggleMedicoAtivo,
  deleteMedicoId,
  setDeleteMedicoId,
  handleDeleteMedico,
}) {
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Gerenciar Médicos da Clínica"
        footer={
          <button className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <form
            onSubmit={handleAddMedico}
            autoComplete="off"
            style={{
              background: 'var(--bg-surface-elevated)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <h4 style={{ marginBottom: '0.75rem', fontSize: 'var(--text-sm)' }}>
              + Cadastrar Novo Médico
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input-field"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Nome do médico (ex: DR. OLIVEIRA)"
                style={{ flex: 1, minWidth: '200px' }}
                value={newMedicoNome}
                onChange={(e) => setNewMedicoNome(e.target.value.toUpperCase())}
              />
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={newMedicoSocio}
                  onChange={(e) => setNewMedicoSocio(e.target.checked)}
                />
                É Sócio?
              </label>
              <button type="submit" className="btn btn-primary btn-sm">
                Adicionar
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                Médicos Cadastrados:
              </h4>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {allDoctors.filter((m) => m.ativo !== false).length} ativo(s) •{' '}
                {allDoctors.filter((m) => m.ativo === false).length} desativado(s)
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 0.35rem 0' }}>
              Médicos desativados não aparecem nos seletores ao cadastrar novos exames, mas todo seu
              histórico permanece preservado.
            </p>
            {allDoctors.length === 0 ? (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Nenhum médico cadastrado ainda.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  paddingRight: '2px',
                }}
              >
                {allDoctors.map((m) => (
                  <div
                    key={m.id || m.nome}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.85rem',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-sm)',
                      opacity: m.ativo === false ? 0.75 : 1,
                      borderLeft:
                        m.ativo === false
                          ? '3px solid var(--color-red)'
                          : '3px solid var(--color-emerald)',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        flex: 1,
                        minWidth: '200px',
                      }}
                    >
                      <strong
                        style={{
                          color: m.ativo === false ? 'var(--text-muted)' : 'inherit',
                          textDecoration: m.ativo === false ? 'line-through' : 'none',
                        }}
                      >
                        {m.nome}
                      </strong>
                      <button
                        type="button"
                        className={`badge ${m.socio !== false ? 'badge-success' : 'badge-info'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => toggleMedicoSocio(m)}
                        title="Clique para alterar status de sócio"
                      >
                        {m.socio !== false ? '👑 Sócio' : '👤 Não-sócio'}
                      </button>
                      <button
                        type="button"
                        className={`badge ${m.ativo !== false ? 'badge-success' : 'badge-danger'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => toggleMedicoAtivo(m)}
                        title={m.ativo !== false ? 'Clique para desativar médico' : 'Clique para reativar médico'}
                      >
                        {m.ativo !== false ? '🟢 Ativo' : '🔴 Desativado'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${m.ativo !== false ? 'btn-ghost' : 'btn-secondary'}`}
                        style={{
                          fontSize: 'var(--text-xs)',
                          padding: '0.25rem 0.65rem',
                          color: m.ativo !== false ? 'var(--color-red)' : 'var(--color-emerald)',
                          borderColor:
                            m.ativo !== false ? 'var(--border-medium)' : 'var(--color-emerald)',
                        }}
                        onClick={() => toggleMedicoAtivo(m)}
                        title={
                          m.ativo !== false
                            ? 'Desativar médico: não aparecerá mais nos seletores ao adicionar novos exames, mantendo todo o histórico'
                            : 'Reativar médico: voltará a aparecer nos seletores de exames'
                        }
                      >
                        {m.ativo !== false ? '⏸️ Desativar' : '▶️ Reativar'}
                      </button>

                      {!m.auto && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => setDeleteMedicoId(m.id)}
                          title="Remover médico do cadastro"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteMedicoId)}
        onClose={() => setDeleteMedicoId(null)}
        onConfirm={handleDeleteMedico}
        message="Tem certeza que deseja remover este médico do cadastro? Se deseja apenas ocultá-lo dos novos exames mantendo todo o histórico, utilize a opção 'Desativar'."
      />
    </>
  );
}
