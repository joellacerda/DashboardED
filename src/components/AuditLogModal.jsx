import { useState, useMemo } from 'react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { exportCSV, exportPDF } from '../utils/helpers';
import { MODULE_LABELS } from '../utils/storage';
import { useToast } from '../contexts/ToastContext';

const ACTION_COLORS = {
  CRIAR: { bg: 'oklch(0.25 0.08 145 / 0.4)', text: 'oklch(0.85 0.15 145)', border: 'oklch(0.4 0.1 145 / 0.5)', icon: '✚' },
  EDITAR: { bg: 'oklch(0.25 0.08 240 / 0.4)', text: 'oklch(0.85 0.15 240)', border: 'oklch(0.4 0.1 240 / 0.5)', icon: '✎' },
  EXCLUIR: { bg: 'oklch(0.25 0.08 25 / 0.4)', text: 'oklch(0.85 0.18 25)', border: 'oklch(0.4 0.1 25 / 0.5)', icon: '✖' },
  ARQUIVAR: { bg: 'oklch(0.25 0.08 75 / 0.4)', text: 'oklch(0.85 0.16 75)', border: 'oklch(0.4 0.1 75 / 0.5)', icon: '🗄️' },
  RESTAURAR: { bg: 'oklch(0.25 0.08 300 / 0.4)', text: 'oklch(0.85 0.15 300)', border: 'oklch(0.4 0.1 300 / 0.5)', icon: '↺' },
};

export default function AuditLogModal({ isOpen, onClose }) {
  const { auditLogs = [], clearAuditLogs } = useData();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState('todos');
  const [selectedAction, setSelectedAction] = useState('todas');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Filtragem dos registros
  const filteredLogs = useMemo(() => {
    return (auditLogs || []).filter((log) => {
      if (selectedModule !== 'todos' && log.modulo !== selectedModule) {
        return false;
      }
      if (selectedAction !== 'todas' && log.acao !== selectedAction) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const descMatch = (log.descricao || '').toLowerCase().includes(term);
        const userMatch = (log.usuario || '').toLowerCase().includes(term);
        const modMatch = (MODULE_LABELS[log.modulo] || log.modulo || '').toLowerCase().includes(term);
        const actionMatch = (log.acao || '').toLowerCase().includes(term);
        return descMatch || userMatch || modMatch || actionMatch;
      }
      return true;
    });
  }, [auditLogs, selectedModule, selectedAction, searchTerm]);

  // Contadores para métricas rápidas
  const counts = useMemo(() => {
    const list = auditLogs || [];
    return {
      total: list.length,
      criar: list.filter((l) => l.acao === 'CRIAR').length,
      editar: list.filter((l) => l.acao === 'EDITAR').length,
      excluir: list.filter((l) => l.acao === 'EXCLUIR').length,
      outros: list.filter((l) => !['CRIAR', 'EDITAR', 'EXCLUIR'].includes(l.acao)).length,
    };
  }, [auditLogs]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.warning('Nenhum registro para exportar.');
      return;
    }
    const cols = [
      { key: 'timestamp', label: 'Data e Hora', accessor: (l) => new Date(l.timestamp).toLocaleString('pt-BR') },
      { key: 'acao', label: 'Ação' },
      { key: 'modulo', label: 'Módulo', accessor: (l) => MODULE_LABELS[l.modulo] || l.modulo },
      { key: 'descricao', label: 'Descrição' },
      { key: 'usuario', label: 'Usuário' },
    ];
    exportCSV(filteredLogs, cols, 'historico_auditoria_endodiagnose');
    toast.success('Histórico de auditoria exportado em CSV!');
  };

  const handleExportPDF = () => {
    if (filteredLogs.length === 0) {
      toast.warning('Nenhum registro para exportar.');
      return;
    }
    const cols = [
      { key: 'timestamp', label: 'Data e Hora', accessor: (l) => new Date(l.timestamp).toLocaleString('pt-BR') },
      { key: 'acao', label: 'Ação' },
      { key: 'modulo', label: 'Módulo', accessor: (l) => MODULE_LABELS[l.modulo] || l.modulo },
      { key: 'descricao', label: 'Descrição' },
      { key: 'usuario', label: 'Usuário' },
    ];
    exportPDF(filteredLogs, cols, 'Histórico de Atividades e Auditoria');
    toast.success('Relatório de auditoria baixado em PDF!');
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearAuditLogs();
    setConfirmClear(false);
    toast.success('Histórico de logs limpo com sucesso!');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Histórico de Atividades & Auditoria"
      maxWidth="1100px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div>
            {confirmClear ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>
                  Confirma apagar todos os logs?
                </span>
                <button type="button" className="btn btn-sm btn-danger" onClick={handleClear}>
                  Sim, limpar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleClear}
                style={{ color: 'var(--text-muted)' }}
                title="Limpar todos os registros deste navegador"
              >
                🗑️ Limpar Histórico
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleExportCSV}>
              📥 Exportar CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportPDF}>
              📄 Exportar PDF
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      }
    >
      <div className="audit-log-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Metric Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Total de Eventos</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>{counts.total}</span>
          </div>
          <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>Cadastros (CRIAR)</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success)' }}>{counts.criar}</span>
          </div>
          <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>Edições (EDITAR)</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)' }}>{counts.editar}</span>
          </div>
          <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>Exclusões (EXCLUIR)</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>{counts.excluir}</span>
          </div>
          <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>Sistema / Outros</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-warning)' }}>{counts.outros}</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            background: 'var(--surface-sunken)',
            padding: '0.75rem',
            borderRadius: '8px',
          }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Buscar por descrição, paciente, médico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ fontSize: 'var(--text-xs)', height: '36px' }}
            />
          </div>

          <div style={{ minWidth: '160px' }}>
            <select
              className="input-field"
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              style={{ fontSize: 'var(--text-xs)', height: '36px' }}
            >
              <option value="todos">Todos os Módulos</option>
              <option value="exames">Exames Particulares</option>
              <option value="examesConvenio">Exames de Convênio</option>
              <option value="fluxoCaixa">Fluxo de Caixa</option>
              <option value="detalhesExames">Detalhes de Exames</option>
              <option value="medicos">Médicos</option>
              <option value="folhaPagamento">Folha de Pagamento</option>
              <option value="cronogramaSalas">Cronograma de Salas</option>
              <option value="sistema">Sistema / Geral</option>
            </select>
          </div>

          <div style={{ minWidth: '140px' }}>
            <select
              className="input-field"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              style={{ fontSize: 'var(--text-xs)', height: '36px' }}
            >
              <option value="todas">Todas as Ações</option>
              <option value="CRIAR">✚ Criar</option>
              <option value="EDITAR">✎ Editar</option>
              <option value="EXCLUIR">✖ Excluir</option>
              <option value="ARQUIVAR">🗄️ Arquivar</option>
              <option value="RESTAURAR">↺ Restaurar</option>
            </select>
          </div>

          {(searchTerm || selectedModule !== 'todos' || selectedAction !== 'todas') && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setSearchTerm('');
                setSelectedModule('todos');
                setSelectedAction('todas');
              }}
              style={{ fontSize: 'var(--text-xs)' }}
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* Table of Logs */}
        <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table className="data-table" style={{ fontSize: 'var(--text-xs)' }}>
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Data & Hora</th>
                <th style={{ width: '100px' }}>Ação</th>
                <th style={{ width: '140px' }}>Módulo</th>
                <th>Descrição do Evento</th>
                <th style={{ width: '150px' }}>Usuário</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Info</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    Nenhum registro de atividade encontrado para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const styleAction = ACTION_COLORS[log.acao] || ACTION_COLORS.EDITAR;
                  const isExpanded = expandedLogId === log.id;
                  const dateObj = new Date(log.timestamp);
                  const formattedDate = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleString('pt-BR')
                    : log.timestamp;

                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {formattedDate}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: styleAction.bg,
                            color: styleAction.text,
                            border: `1px solid ${styleAction.border}`,
                            fontWeight: 600,
                            fontSize: '0.72rem',
                          }}
                        >
                          <span>{styleAction.icon}</span>
                          <span>{log.acao}</span>
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '4px',
                            background: 'var(--surface-sunken)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.72rem',
                          }}
                        >
                          {MODULE_LABELS[log.modulo] || log.modulo}
                        </span>
                      </td>
                      <td style={{ wordBreak: 'break-word' }}>
                        <div>{log.descricao}</div>
                        {isExpanded && log.detalhes && (
                          <div
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              background: 'var(--surface-sunken)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              maxHeight: '120px',
                              overflowY: 'auto',
                            }}
                          >
                            {JSON.stringify(log.detalhes, null, 2)}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {log.usuario}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {log.detalhes ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            title={isExpanded ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
