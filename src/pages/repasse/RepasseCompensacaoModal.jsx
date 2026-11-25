import Modal from '../../components/Modal';
import { formatDate, formatCurrency } from '../../utils/helpers';

export default function RepasseCompensacaoModal({ viewingCompensacao, onClose }) {
  if (!viewingCompensacao) return null;

  return (
    <Modal
      isOpen={Boolean(viewingCompensacao)}
      onClose={onClose}
      title={`Compensações de Convênio — ${viewingCompensacao?.doctor || ''}`}
      maxWidth="720px"
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Fechar
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.5,
            color: 'var(--color-amber)',
          }}
        >
          💡 <strong>Dedução Automática de Materiais &amp; Procedimentos ({viewingCompensacao?.doctor || 'Titular'}):</strong>
          <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
            Como <strong>{viewingCompensacao?.doctor || 'o médico titular'}</strong> centraliza o recebimento dos proventos de convênio,
            todas as compensações de materiais descartáveis (alça) e percentual de polipectomias registradas nos exames do período
            são lançadas neste demonstrativo. O total de{' '}
            <strong style={{ color: 'var(--color-amber)' }}>
              {formatCurrency(viewingCompensacao?.total || 0)}
            </strong>{' '}
            é deduzido automaticamente neste período.
          </div>
        </div>

        <div
          className="table-scroll"
          style={{
            maxHeight: '320px',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <table className="data-table" style={{ fontSize: 'var(--text-xs)' }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Médico Realizante</th>
                <th>Exame / Convênio</th>
                <th style={{ textAlign: 'right' }}>Alça (100% Clínica)</th>
                <th style={{ textAlign: 'right' }}>Polip. (50% Clínica)</th>
                <th style={{ textAlign: 'right' }}>Total Compensado</th>
              </tr>
            </thead>
            <tbody>
              {viewingCompensacao?.items?.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td>{formatDate(item.fluxoData || item.data)}</td>
                  <td style={{ fontWeight: 600 }}>{item.paciente}</td>
                  <td>{item.medico || '—'}</td>
                  <td>
                    {item.exame} ({item.convenio})
                  </td>
                  <td className="value-currency" style={{ textAlign: 'right' }}>
                    {item.valorAcessorio > 0 ? formatCurrency(item.valorAcessorio) : '—'}
                  </td>
                  <td className="value-currency" style={{ textAlign: 'right' }}>
                    {item.valorPolipectomia > 0 ? formatCurrency(item.valorPolipectomia / 2) : '—'}
                  </td>
                  <td className="value-negative" style={{ fontWeight: 700, textAlign: 'right' }}>
                    -{formatCurrency(item.valorCompensacao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
