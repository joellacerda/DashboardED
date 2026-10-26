import { formatCurrency, formatDate, exportCSV, exportPDF } from '../../utils/helpers';
import ExportMenu from '../../components/ExportMenu';
import Pagination from '../../components/Pagination';

const folhaColumns = [
  { key: 'nome', label: 'Nome' },
  { key: 'cargo', label: 'Cargo', accessor: (item) => item.cargo || '—' },
  { key: 'salarioBase', label: 'Salário Base', accessor: (item) => formatCurrency(item.salarioBase) },
  { key: 'valeAlimentacao', label: 'V. Alimentação', accessor: (item) => formatCurrency(item.valeAlimentacao) },
  { key: 'valeTransporte', label: 'V. Transporte', accessor: (item) => formatCurrency(item.valeTransporte) },
  { key: 'extras', label: 'Extras', accessor: (item) => formatCurrency(item.extras) },
  { key: 'descontos', label: 'Descontos', accessor: (item) => formatCurrency(item.descontos) },
  { key: 'produtividade', label: 'Produtividade', accessor: (item) => formatCurrency(item.produtividade) },
  { key: 'liquido', label: 'Líquido', accessor: (item) => formatCurrency(item.liquido) },
];

export default function FolhaTable({
  filtered,
  paginatedItems,
  search,
  setSearch,
  period,
  folhaLancamentoNoCaixa,
  openEdit,
  setDeleteId,
  totalBase,
  totalDescontos,
  totalFolha,
  safeCurrentPage,
  pageSize,
  setCurrentPage,
  setPageSize,
}) {
  return (
    <div className="table-container">
      <div className="table-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h3 className="table-title">Demonstrativo da Folha</h3>
          {folhaLancamentoNoCaixa && (
            <span
              className="badge-fluxo-done"
              title={`Lançado no Fluxo de Caixa: ${formatCurrency(folhaLancamentoNoCaixa.valor)} em ${formatDate(folhaLancamentoNoCaixa.data)}`}
            >
              ✓ Lançado no Caixa ({formatCurrency(folhaLancamentoNoCaixa.valor)})
            </span>
          )}
        </div>

        <div className="table-actions">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              className="search-input"
              placeholder="Buscar colaborador..."
              value={search}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ExportMenu
            onExportCSV={() => exportCSV(filtered, folhaColumns, `folha_pagamento_${period.start}`)}
            onExportPDF={() => exportPDF(filtered, folhaColumns, `Folha de Pagamento — ${period.label}`)}
          />
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table" style={{ fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Salário Base</th>
              <th>V. Alimentação</th>
              <th>V. Transporte</th>
              <th>Extras</th>
              <th>Descontos</th>
              <th>Produtividade</th>
              <th>Líquido</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="9">
                  <div className="table-empty">
                    <div className="table-empty-icon">👥</div>
                    <p>
                      Nenhum colaborador registrado{search ? ' para esta busca' : ' neste período'}.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {paginatedItems.map((item) => (
                  <tr key={item.id} style={{ height: '54px' }}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.nome}</div>
                      {item.cargo && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            marginTop: '0.15rem',
                          }}
                        >
                          {item.cargo}
                        </div>
                      )}
                    </td>
                    <td className="value-currency">{formatCurrency(item.salarioBase)}</td>
                    <td className="value-currency">{formatCurrency(item.valeAlimentacao)}</td>
                    <td className="value-currency">{formatCurrency(item.valeTransporte)}</td>
                    <td className={item.extras > 0 ? 'value-positive' : 'value-currency'}>
                      {item.extras > 0 ? `+${formatCurrency(item.extras)}` : 'R$ 0,00'}
                    </td>
                    <td className={item.descontos > 0 ? 'value-negative' : 'value-currency'}>
                      {item.descontos > 0 ? `-${formatCurrency(item.descontos)}` : 'R$ 0,00'}
                    </td>
                    <td className={item.produtividade > 0 ? 'value-positive' : 'value-currency'}>
                      {item.produtividade > 0 ? `+${formatCurrency(item.produtividade)}` : 'R$ 0,00'}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: 'var(--color-emerald)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      {formatCurrency(item.liquido)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="action-buttons" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => openEdit(item)}
                          title="Editar valores deste período"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => setDeleteId(item.id)}
                          title="Remover colaborador"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td style={{ textAlign: 'end', fontWeight: 700 }}>Totais no período:</td>
                  <td className="value-currency" style={{ fontWeight: 700 }}>
                    {formatCurrency(totalBase)}
                  </td>
                  <td className="value-currency" style={{ fontWeight: 700 }}>
                    {formatCurrency(filtered.reduce((s, f) => s + f.valeAlimentacao, 0))}
                  </td>
                  <td className="value-currency" style={{ fontWeight: 700 }}>
                    {formatCurrency(filtered.reduce((s, f) => s + f.valeTransporte, 0))}
                  </td>
                  <td className="value-positive" style={{ fontWeight: 700 }}>
                    {formatCurrency(filtered.reduce((s, f) => s + f.extras, 0))}
                  </td>
                  <td className="value-negative" style={{ fontWeight: 700 }}>
                    {formatCurrency(totalDescontos)}
                  </td>
                  <td className="value-positive" style={{ fontWeight: 700 }}>
                    {formatCurrency(filtered.reduce((s, f) => s + f.produtividade, 0))}
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--color-emerald)' }}>
                    {formatCurrency(totalFolha)}
                  </td>
                  <td />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={safeCurrentPage}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        label="colaborador(es)"
        summaryNode={
          <span>
            Total Líquido da Folha ({period.label}):{' '}
            <strong style={{ color: 'var(--color-emerald)' }}>{formatCurrency(totalFolha)}</strong>
          </span>
        }
      />
    </div>
  );
}
