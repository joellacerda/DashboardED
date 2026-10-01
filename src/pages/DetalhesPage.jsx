import React, { useState, useMemo, useEffect } from 'react';
import {
  getData,
  deleteItem,
  syncAllConveniosToDetalhes,
} from '../utils/storage';
import {
  formatCurrency,
  roundCurrency,
  formatDate,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  getHonorarioInPeriod,
  getHonorarioMedicoInPeriod,
  examHasInstallmentInPeriod,
  getInstallmentLabel,
  migrateLegacyPayment,
  exportCSV,
  exportPDF,
  normalizeProcedimentosComplementares,
  formatProcedimentosComplementares,
} from '../utils/helpers';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';
import DetalhesExpandedRow from '../components/DetalhesExpandedRow';
import DetalhesFormModal from '../components/DetalhesFormModal';
import Pagination from '../components/Pagination';
import { useToast } from '../contexts/ToastContext';

export default function DetalhesPage({ prefillData, onClearPrefill }) {
  const toast = useToast();
  const [data, setData] = useState(() => getData('detalhesExames'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  useEffect(() => {
    setCurrentPage(1);
  }, [period, search]);

  useEffect(() => {
    if (!openActionMenuId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.row-action-menu')) {
        setOpenActionMenuId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenActionMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openActionMenuId]);

  const toggleRowExpand = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (prefillData) {
      const existing = data.find(
        (d) =>
          (prefillData.id && String(d.id) === String(prefillData.id)) ||
          (d.data === prefillData.data &&
            d.paciente &&
            prefillData.paciente &&
            d.paciente.trim().toUpperCase() === prefillData.paciente.trim().toUpperCase())
      );
      if (existing) {
        setEditItem(existing);
      } else {
        setEditItem(null);
      }
      if (prefillData.data) {
        const dateObj = new Date(prefillData.data + 'T00:00:00');
        setPeriod(getAcquisitionPeriod(dateObj));
      }
      setModalOpen(true);
    }
  }, [prefillData, data]);

  useEffect(() => {
    syncAllConveniosToDetalhes();
    setData(getData('detalhesExames'));
  }, []);

  const refresh = () => setData(getData('detalhesExames'));

  // --- Filtered items: exams that either were performed in this period
  //     OR have installments falling in this period ---
  const filtered = useMemo(() => {
    let items = data.filter(
      (e) => isDateInPeriod(e.data, period) || examHasInstallmentInPeriod(e, period)
    );
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.paciente || '').toLowerCase().includes(q) ||
          (e.tipoExame || e.exame || '').toLowerCase().includes(q) ||
          (e.procedimentoComplementar || '').toLowerCase().includes(q) ||
          (e.medico || '').toLowerCase().includes(q) ||
          (e.formaPagamento || '').toLowerCase().includes(q) ||
          (e.pagamentos || []).some((p) => (p.forma || '').toLowerCase().includes(q))
      );
    }
    return items.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [data, search, period]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = useMemo(
    () => filtered.slice(startIndex, startIndex + pageSize),
    [filtered, startIndex, pageSize]
  );

  // --- Period-aware calculations ---
  // Payments, Fees & Taxes: ONLY for exams performed IN THIS PERIOD
  const examsInPeriod = useMemo(
    () => filtered.filter((d) => isDateInPeriod(d.data, period)),
    [filtered, period]
  );

  const totalClinicaPeriodo = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.taxaClinica || 0), 0),
    [examsInPeriod]
  );

  const totalAcessoriosPeriodo = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorAcessorios || 0), 0),
    [examsInPeriod]
  );

  const totalBiopsiaPeriodo = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorBiopsia || 0), 0),
    [examsInPeriod]
  );

  const totalPagamento = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorPagamento || 0), 0),
    [examsInPeriod]
  );

  const totalTaxas = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorRetidoTaxas || 0), 0),
    [examsInPeriod]
  );

  const totalNotaFiscal = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorNotaFiscal || 0), 0),
    [examsInPeriod]
  );

  const totalAnestesista = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorAnestesista || 0), 0),
    [examsInPeriod]
  );

  // Honorários: distributed monthly amounts that fall in this period
  const totalHonorariosPeriodo = useMemo(
    () => filtered.reduce((s, d) => s + getHonorarioInPeriod(d, period), 0),
    [filtered, period]
  );

  const openNew = () => {
    setEditItem(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setModalOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      const fluxoList = getData('fluxoCaixa') || [];
      const linked = fluxoList.filter(
        (f) =>
          f.detalheId === deleteId ||
          f.detalheId === `${deleteId}_taxa` ||
          f.detalheId === `${deleteId}_acessorios` ||
          f.detalheId === `${deleteId}_biopsia`
      );
      linked.forEach((entry) => deleteItem('fluxoCaixa', entry.id));
      deleteItem('detalhesExames', deleteId);
      refresh();
      toast.success('Registro de detalhes excluído.');
    }
  };

  // Export columns (period-aware)
  const exportColumns = [
    { key: 'data', label: 'Data', accessor: (item) => formatDate(item.data) },
    { key: 'paciente', label: 'Paciente' },
    {
      key: 'tipoExame', label: 'Tipo de Exame', accessor: (item) => {
        const base = (item.tipoExame || item.exame || '').toUpperCase();
        const compl = formatProcedimentosComplementares(item.procedimentoComplementar);
        return compl ? `${base} + ${compl}` : base;
      }
    },
    { key: 'medico', label: 'Médico' },
    {
      key: 'formaPagamento', label: 'Forma Pagamento', accessor: (item) => {
        const pags = migrateLegacyPayment(item);
        if (pags.length === 1) return `${pags[0].forma} ${pags[0].parcelas}x`;
        return pags.map((p) => `${p.forma} ${p.parcelas}x`).join(' + ');
      }
    },
    {
      key: 'valorPagamento', label: 'Pagamento', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorPagamento) : '—'
    },
    {
      key: 'valorRetidoTaxas', label: 'Taxas Retidas', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorRetidoTaxas) : '—'
    },
    {
      key: 'valorNotaFiscal', label: 'Nota Fiscal', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorNotaFiscal) : '—'
    },
    {
      key: 'valorAnestesista', label: 'Anestesista', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorAnestesista) : '—'
    },
    {
      key: 'taxaClinica', label: 'Taxa Clínica', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.taxaClinica) : '—'
    },
    {
      key: 'valorAcessorios', label: 'Acessórios', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorAcessorios) : '—'
    },
    {
      key: 'valorBiopsia', label: 'Biópsia', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorBiopsia) : '—'
    },
    {
      key: 'numParcelas', label: 'Parcelas', accessor: (item) => {
        const pags = migrateLegacyPayment(item);
        return pags.reduce((s, p) => s + Math.max(1, Number(p.parcelas) || 1), 0);
      }
    },
    { key: 'honorariosMedicos', label: 'Hon. Total', accessor: (item) => formatCurrency(item.honorariosMedicos) },
    {
      key: 'honorarioMensal', label: 'Hon. no Período', accessor: (item) =>
        formatCurrency(getHonorarioInPeriod(item, period))
    },
    {
      key: 'parcPeriodo', label: 'Período Parcelas', accessor: (item) =>
        getInstallmentLabel(item.data, migrateLegacyPayment(item), item.formaPagamento)
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Detalhes de Exames</h1>
        <div className="header-actions">
          <div className="period-selector-wrapper">
            <div className="period-selector">
              <button
                type="button"
                className="period-btn"
                onClick={() => setPeriod(navigateAcquisitionPeriod(period, -1))}
                title="Período anterior"
              >
                ◀
              </button>
              <span className="period-label">{period.label}</span>
              <button
                type="button"
                className="period-btn"
                onClick={() => setPeriod(navigateAcquisitionPeriod(period, 1))}
                title="Próximo período"
              >
                ▶
              </button>
            </div>
            {!isCurrentPeriod && (
              <button
                type="button"
                className="btn btn-secondary btn-sm period-today-btn"
                onClick={() => setPeriod(getAcquisitionPeriod())}
                title="Ir para o período atual"
              >
                Hoje
              </button>
            )}
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            + Novo Detalhe
          </button>
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Taxa Clínica no Período</span>
              <div className="summary-card-icon">🏥</div>
            </div>
            <div className="summary-card-value value-positive">{formatCurrency(totalClinicaPeriodo)}</div>
          </div>
          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Honorários no Período</span>
              <div className="summary-card-icon purple">👨‍⚕️</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalHonorariosPeriodo)}</div>
          </div>
          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Pagamentos (Exames)</span>
              <div className="summary-card-icon blue">💳</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalPagamento)}</div>
          </div>
          <div className="summary-card card-accent-red">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Taxas Retidas</span>
              <div className="summary-card-icon red">📊</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalTaxas)}</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Detalhamento Financeiro</h3>
            <div className="table-actions">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar paciente, exame..."
                  value={search}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ExportMenu
                onExportCSV={() => exportCSV(filtered, exportColumns, 'detalhes_exames')}
                onExportPDF={() => exportPDF(filtered, exportColumns, `Detalhes de Exames — ${period.label}`)}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table detalhes-compact-table">
              <thead>
                <tr>
                  <th style={{ width: '3%' }} />
                  <th style={{ width: '9%' }}>Data</th>
                  <th style={{ width: '23%' }}>Paciente</th>
                  <th style={{ width: '18%' }}>Exame</th>
                  <th style={{ width: '16%' }}>Médico</th>
                  <th style={{ width: '13%' }}>Pagamento</th>
                  <th style={{ width: '15%' }}>Hon. Período</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="table-empty">
                        <div className="table-empty-icon">📋</div>
                        <p>Nenhum detalhe registrado para este período{search ? ' e busca' : ''}.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedItems.map((item, index) => {
                      const pags = migrateLegacyPayment(item);
                      const honNoPeriodo = getHonorarioInPeriod(item, period);
                      const isExamInThisPeriod = isDateInPeriod(item.data, period);
                      const isExpanded = expandedRows.has(item.id);
                      const isNearBottom = paginatedItems.length > 2 && index >= paginatedItems.length - 2;

                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            className={`expandable-row${isExpanded ? ' expanded' : ''}`}
                            style={!isExamInThisPeriod ? { opacity: 0.8, fontStyle: 'italic' } : undefined}
                            title={!isExamInThisPeriod ? 'Exame de outro período — parcela de honorários cai neste período' : undefined}
                          >
                            <td>
                              <button
                                type="button"
                                className={`btn-expand-row${isExpanded ? ' expanded' : ''}`}
                                onClick={() => toggleRowExpand(item.id)}
                                title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes financeiros'}
                                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                              >
                                ▶
                              </button>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.data)}</td>
                            <td>
                              <div
                                className="table-cell-truncate table-patient-name"
                                title={item.paciente ? item.paciente.toUpperCase() : ''}
                              >
                                {item.paciente ? item.paciente.toUpperCase() : ''}
                              </div>
                              {item.isConvenio && (
                                <div style={{ marginTop: '0.15rem' }}>
                                  <span
                                    className="badge badge-info table-cell-truncate"
                                    style={{ fontSize: '10px', padding: '0.05rem 0.35rem', maxWidth: '100%', display: 'inline-block' }}
                                    title={`Convênio: ${item.convenio || 'CONVÊNIO'}`}
                                  >
                                    🏢 {item.convenio || 'CONVÊNIO'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                                <span
                                  className="table-cell-truncate"
                                  title={(item.tipoExame || item.exame || '').toUpperCase()}
                                >
                                  {(item.tipoExame || item.exame || '').toUpperCase()}
                                </span>
                                {normalizeProcedimentosComplementares(item.procedimentoComplementar).map((proc) => {
                                  const tagLabel = proc === 'POLIPECTOMIA' ? 'P' : 'M';
                                  return (
                                    <span
                                      key={proc}
                                      className="badge badge-info"
                                      style={{ fontSize: '10px', padding: '0.05rem 0.3rem', flexShrink: 0, fontWeight: 700 }}
                                      title={proc}
                                    >
                                      {tagLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td>
                              <div
                                className="table-cell-truncate"
                                style={{ fontWeight: 500 }}
                                title={item.medico ? item.medico.toUpperCase() : ''}
                              >
                                {item.medico ? item.medico.toUpperCase() : ''}
                              </div>
                              {item.medico2 && (
                                <div
                                  className="table-cell-truncate"
                                  style={{ fontSize: 'var(--text-xs)', color: 'var(--text-accent)', marginTop: '0.1rem' }}
                                  title={`c/ ${item.medico2.toUpperCase()}`}
                                >
                                  👥 c/ {item.medico2.toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div className="value-currency" style={{ fontWeight: 600 }}>
                                {isExamInThisPeriod ? formatCurrency(item.valorPagamento) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </div>
                              {isExamInThisPeriod && pags.length === 1 && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                  {pags[0].forma}{pags[0].parcelas > 1 ? ` ${pags[0].parcelas}x` : ''}
                                </div>
                              )}
                              {isExamInThisPeriod && pags.length > 1 && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                  Misto ({pags.length}x)
                                </div>
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div className={honNoPeriodo > 0 ? 'value-positive' : 'value-currency'} style={{ fontWeight: 600 }}>
                                {formatCurrency(honNoPeriodo)}
                                {honNoPeriodo > 0 && (
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-emerald)', marginInlineStart: '0.25rem' }}>✓</span>
                                )}
                              </div>
                              {honNoPeriodo > 0 && (item.temDivisao || item.medico2) && (
                                <div style={{ fontSize: '11px', color: 'var(--text-accent)', marginTop: '0.15rem', lineHeight: 1.25 }}>
                                  <div className="table-cell-truncate" title={`${item.medico}: ${formatCurrency(getHonorarioMedicoInPeriod(item, item.medico, period))}`}>
                                    {item.medico ? item.medico.toUpperCase() : ''}: {formatCurrency(getHonorarioMedicoInPeriod(item, item.medico, period))}
                                  </div>
                                  <div className="table-cell-truncate" title={`${item.medico2}: ${formatCurrency(getHonorarioMedicoInPeriod(item, item.medico2, period))}`}>
                                    {item.medico2 ? item.medico2.toUpperCase() : ''}: {formatCurrency(getHonorarioMedicoInPeriod(item, item.medico2, period))}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="row-action-menu">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon btn-sm action-menu-trigger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenActionMenuId(openActionMenuId === item.id ? null : item.id);
                                  }}
                                  title="Opções"
                                  aria-label="Opções"
                                >
                                  <span className="action-menu-dots">•••</span>
                                </button>
                                {openActionMenuId === item.id && (
                                  <div
                                    className={`action-menu-popover${isNearBottom ? ' open-up' : ''}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="action-menu-item"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        openEdit(item);
                                      }}
                                    >
                                      <span className="action-menu-icon">✏️</span>
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="action-menu-item action-menu-item-danger"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setDeleteId(item.id);
                                      }}
                                    >
                                      <span className="action-menu-icon">🗑️</span>
                                      <span>Excluir</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded detail panel */}
                          {isExpanded && <DetalhesExpandedRow item={item} period={period} />}
                        </React.Fragment>
                      );
                    })}
                    <tr className="totals-row">
                      <td />
                      <td colSpan="4" style={{ textAlign: 'end', fontWeight: 700 }}>Totais no período:</td>
                      <td className="value-currency" style={{ fontWeight: 700 }}>{formatCurrency(totalPagamento)}</td>
                      <td className="value-positive" style={{ fontWeight: 700 }}>{formatCurrency(totalHonorariosPeriodo)}</td>
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
            label="registro(s)"
            summaryNode={
              <span>
                Clínica: {formatCurrency(totalClinicaPeriodo)} | Acess.: {formatCurrency(totalAcessoriosPeriodo)} | Biópsia: {formatCurrency(totalBiopsiaPeriodo)} | Honorários: {formatCurrency(totalHonorariosPeriodo)}
              </span>
            }
          />
        </div>
      </div>

      <DetalhesFormModal
        isOpen={modalOpen}
        editItem={editItem}
        prefillData={prefillData}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
          if (onClearPrefill) onClearPrefill();
        }}
        onSuccess={() => {
          refresh();
          setModalOpen(false);
          setEditItem(null);
          if (onClearPrefill) onClearPrefill();
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir este registro?"
      />
    </>
  );
}
