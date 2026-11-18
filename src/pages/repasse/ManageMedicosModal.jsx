import { useState, useMemo } from 'react';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function ManageMedicosModal({
  isOpen,
  onClose,
  allDoctors = [],
  newMedicoNome,
  setNewMedicoNome,
  newMedicoSocio,
  setNewMedicoSocio,
  handleAddMedico,
  toggleMedicoSocio,
  toggleMedicoAtivo,
  moveMedico,
  reorderMedicos,
  deleteMedicoId,
  setDeleteMedicoId,
  handleDeleteMedico,
}) {
  const [draggedMedico, setDraggedMedico] = useState(null);
  const [dragOverNome, setDragOverNome] = useState(null);

  const { activeDoctors, inactiveDoctors } = useMemo(() => {
    const active = [];
    const inactive = [];
    (allDoctors || []).forEach((m) => {
      if (m.ativo !== false) {
        active.push(m);
      } else {
        inactive.push(m);
      }
    });
    return { activeDoctors: active, inactiveDoctors: inactive };
  }, [allDoctors]);

  const handleDragStart = (e, medico) => {
    setDraggedMedico(medico);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', medico.nome);
    } catch {
      // ignore
    }
  };

  const handleDragOver = (e, targetMedico) => {
    e.preventDefault();
    if (!draggedMedico) return;
    if ((draggedMedico.ativo !== false) !== (targetMedico.ativo !== false)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    if (dragOverNome !== targetMedico.nome) {
      setDragOverNome(targetMedico.nome);
    }
  };

  const handleDrop = (e, targetMedico) => {
    e.preventDefault();
    if (
      draggedMedico &&
      targetMedico &&
      draggedMedico.nome !== targetMedico.nome &&
      (draggedMedico.ativo !== false) === (targetMedico.ativo !== false)
    ) {
      reorderMedicos?.(draggedMedico, targetMedico);
    }
    setDraggedMedico(null);
    setDragOverNome(null);
  };

  const handleDragEnd = () => {
    setDraggedMedico(null);
    setDragOverNome(null);
  };

  const renderDoctorRow = (m, idx, groupLength) => {
    const isActive = m.ativo !== false;
    const isFirst = idx === 0;
    const isLast = idx === groupLength - 1;
    const isDragTarget =
      dragOverNome === m.nome &&
      draggedMedico &&
      draggedMedico.nome !== m.nome &&
      (draggedMedico.ativo !== false) === isActive;

    return (
      <div
        key={m.id || m.nome}
        draggable={groupLength > 1}
        onDragStart={(e) => handleDragStart(e, m)}
        onDragOver={(e) => handleDragOver(e, m)}
        onDrop={(e) => handleDrop(e, m)}
        onDragEnd={handleDragEnd}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 0.85rem',
          background: isDragTarget ? 'var(--bg-surface-hover)' : 'var(--bg-input)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--text-sm)',
          opacity: !isActive ? 0.75 : draggedMedico?.nome === m.nome ? 0.55 : 1,
          borderLeft: !isActive
            ? '3px solid var(--color-red)'
            : '3px solid var(--color-emerald)',
          outline: isDragTarget ? '1px dashed var(--accent-primary)' : 'none',
          gap: '0.75rem',
          flexWrap: 'wrap',
          transition: 'background 0.15s ease, opacity 0.15s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            flex: 1,
            minWidth: '220px',
          }}
        >
          {/* Controles de Reordenação (Setas ▲/▼ + Alça Drag) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.15rem',
              marginRight: '0.15rem',
            }}
            title={groupLength > 1 ? 'Arraste ou use as setas para reordenar' : undefined}
          >
            <span
              aria-hidden="true"
              style={{
                cursor: groupLength > 1 ? 'grab' : 'default',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                userSelect: 'none',
                paddingRight: '0.15rem',
              }}
            >
              ⋮⋮
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                disabled={isFirst}
                onClick={() => moveMedico?.(m, -1)}
                title="Mover para cima"
                aria-label={`Mover ${m.nome} para cima`}
                style={{
                  padding: '0 0.28rem',
                  lineHeight: 1,
                  height: '15px',
                  fontSize: '0.62rem',
                  opacity: isFirst ? 0.25 : 0.85,
                }}
              >
                ▲
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                disabled={isLast}
                onClick={() => moveMedico?.(m, 1)}
                title="Mover para baixo"
                aria-label={`Mover ${m.nome} para baixo`}
                style={{
                  padding: '0 0.28rem',
                  lineHeight: 1,
                  height: '15px',
                  fontSize: '0.62rem',
                  opacity: isLast ? 0.25 : 0.85,
                }}
              >
                ▼
              </button>
            </div>
          </div>

          <strong
            style={{
              color: !isActive ? 'var(--text-muted)' : 'inherit',
              textDecoration: !isActive ? 'line-through' : 'none',
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
            className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}
            style={{ border: 'none', cursor: 'pointer' }}
            onClick={() => toggleMedicoAtivo(m)}
            title={isActive ? 'Clique para desativar médico' : 'Clique para reativar médico'}
          >
            {isActive ? '🟢 Ativo' : '🔴 Desativado'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${isActive ? 'btn-ghost' : 'btn-secondary'}`}
            style={{
              fontSize: 'var(--text-xs)',
              padding: '0.25rem 0.65rem',
              color: isActive ? 'var(--color-red)' : 'var(--color-emerald)',
              borderColor: isActive ? 'var(--border-medium)' : 'var(--color-emerald)',
            }}
            onClick={() => toggleMedicoAtivo(m)}
            title={
              isActive
                ? 'Desativar médico: não aparecerá mais nos seletores ao adicionar novos exames, mantendo todo o histórico'
                : 'Reativar médico: voltará a aparecer nos seletores de exames'
            }
          >
            {isActive ? '⏸️ Desativar' : '▶️ Reativar'}
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
    );
  };

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
                {activeDoctors.length} ativo(s) • {inactiveDoctors.length} desativado(s)
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 0.35rem 0' }}>
              Médicos ativos aparecem no topo e podem ser reordenados pelas setas (▲/▼) ou arrastando.
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
                  maxHeight: '340px',
                  overflowY: 'auto',
                  paddingRight: '2px',
                }}
              >
                {activeDoctors.map((m, idx) => renderDoctorRow(m, idx, activeDoctors.length))}

                {inactiveDoctors.length > 0 && (
                  <>
                    {activeDoctors.length > 0 && (
                      <div
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-muted)',
                          marginTop: '0.4rem',
                          paddingTop: '0.45rem',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        Desativados ({inactiveDoctors.length})
                      </div>
                    )}
                    {inactiveDoctors.map((m, idx) =>
                      renderDoctorRow(m, idx, inactiveDoctors.length)
                    )}
                  </>
                )}
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
