import { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import {
  formatCurrency,
  formatDate,
  getTodayISO,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  exportCSV,
  exportPDF,
  normalizeProcedimentosComplementares,
} from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';
import Pagination from '../components/Pagination';
import { useToast } from '../contexts/ToastContext';
import { validateDate, validateRequired, validatePositiveNumber } from '../utils/validation';
import { MODULES, getConvenioFluxoDestino } from '../utils/storage';

const CATEGORIAS_ENTRADA = [
  'Exames / Procedimentos',
  'Consultas',
  'Convênios / Repasses',
  'Venda de Materiais',
  'Outras Entradas',
];

const CATEGORIAS_SAIDA = [
  'Material Médico / Insumos',
  'Equipamentos / Manutenção',
  'Aluguel / Condomínio',
  'Contas (Água, Luz, Internet)',
  'Impostos / Taxas',
  'Folha de Pagamento / Pessoal',
  'Serviços Terceirizados',
  'Marketing / Administrativo',
  'Outras Saídas',
];

const emptyForm = { data: '', nome: '', tipo: 'entrada', categoria: 'Exames / Procedimentos', valor: '' };

const columns = [
  { key: 'data', label: 'Data', accessor: (item) => formatDate(item.data) },
  { key: 'nome', label: 'Descrição' },
  { key: 'categoria', label: 'Categoria', accessor: (item) => item.categoria || 'Geral' },
  { key: 'tipo', label: 'Tipo', accessor: (item) => (item.tipo === 'entrada' ? 'Entrada' : 'Saída') },
  { key: 'valor', label: 'Valor (R$)', accessor: (item) => formatCurrency(item.valor) },
];

export default function FluxoCaixaPage() {
  const toast = useToast();
  const { fluxoCaixa: data = [], examesConvenio = [], addItem, updateItem, deleteItem } = useData();
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewingConsolidadoItem, setViewingConsolidadoItem] = useState(null);
  const [consolidadoSearch, setConsolidadoSearch] = useState('');

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validationErrors = useMemo(() => {
    const errs = {};
    const dateErr = validateDate(form.data, 'Data');
    if (dateErr) errs.data = dateErr;

    const nomeErr = validateRequired(form.nome, 'Descrição');
    if (nomeErr) {
      errs.nome = nomeErr;
    } else if (form.nome.trim().length < 2) {
      errs.nome = 'A descrição deve ter ao menos 2 caracteres.';
    }

    const valorErr = validatePositiveNumber(form.valor, 'Valor', false);
    if (valorErr) errs.valor = valorErr;

    const catErr = validateRequired(form.categoria, 'Categoria');
    if (catErr) errs.categoria = catErr;

    return errs;
  }, [form]);

  const hasError = (field) => Boolean((submitted || touched[field]) && validationErrors[field]);

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  useEffect(() => {
    setCurrentPage(1);
  }, [period, search, typeFilter, categoryFilter]);

  const refresh = () => {};

  const filtered = useMemo(() => {
    let items = data.filter((f) => isDateInPeriod(f.data, period));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          e.nome.toLowerCase().includes(q) ||
          (e.categoria || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      items = items.filter((e) => e.tipo === typeFilter);
    }
    if (categoryFilter) {
      items = items.filter((e) => e.categoria === categoryFilter);
    }
    // Ordenar por data decrescente (e desempate por criação mais recente)
    return items.sort((a, b) => {
      const dateComparison = (b.data || '').localeCompare(a.data || '');
      if (dateComparison !== 0) return dateComparison;
      if (a.createdAt && b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (a.createdAt) return -1;
      if (b.createdAt) return 1;
      const indexA = data.indexOf(a);
      const indexB = data.indexOf(b);
      return indexB - indexA;
    });
  }, [data, period, search, typeFilter, categoryFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = useMemo(
    () => filtered.slice(startIndex, startIndex + pageSize),
    [filtered, startIndex, pageSize]
  );

  // List of unique categories according to the selected typeFilter for filtering
  const availableCategories = useMemo(() => {
    let base = [];
    if (typeFilter === 'entrada') {
      base = [...CATEGORIAS_ENTRADA];
    } else if (typeFilter === 'saida') {
      base = [...CATEGORIAS_SAIDA];
    } else {
      base = [...CATEGORIAS_ENTRADA, ...CATEGORIAS_SAIDA];
    }
    const set = new Set(base);
    data.forEach((d) => {
      if (d.categoria && (!typeFilter || d.tipo === typeFilter)) {
        set.add(d.categoria);
      }
    });
    return Array.from(set).sort();
  }, [data, typeFilter]);

  const totalEntradas = filtered
    .filter((f) => f.tipo === 'entrada')
    .reduce((s, f) => s + Number(f.valor), 0);
  const totalSaidas = filtered
    .filter((f) => f.tipo === 'saida')
    .reduce((s, f) => s + Number(f.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, data: getTodayISO(), categoria: 'Exames / Procedimentos' });
    setTouched({});
    setSubmitted(false);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      data: item.data,
      nome: item.nome,
      tipo: item.tipo,
      categoria: item.categoria || (item.tipo === 'entrada' ? 'Exames / Procedimentos' : 'Material Médico / Insumos'),
      valor: item.valor,
    });
    setTouched({});
    setSubmitted(false);
    setModalOpen(true);
  };

function formatDescricao(nome) {
  if (!nome) return '';
  let res = nome.trim();
  if (/^unimed$/i.test(res)) {
    return 'UNIMED';
  }
  if (/^coopend$/i.test(res)) {
    return 'COOPEND';
  }
  if (/^taxa\s+(de\s+)?cl[ií]nica\s*—\s*/i.test(res)) {
    res = res.replace(/^taxa\s+(de\s+)?cl[ií]nica\s*—\s*/i, 'TAXA DE CLÍNICA — ');
  }
  if (/^bi[oó]psia\s*—\s*/i.test(res)) {
    res = res.replace(/^bi[oó]psia\s*—\s*/i, 'BIÓPSIA — ');
  }
  if (/^valor\s+de\s+acess[oó]rios\s*—\s*/i.test(res)) {
    res = res.replace(/^valor\s+de\s+acess[oó]rios\s*—\s*/i, 'VALOR DE ACESSÓRIOS — ');
  }
  if (/^repasse\s+conv[eê]nio\s*/i.test(res)) {
    res = res.replace(/^repasse\s+conv[eê]nio\s*/i, 'REPASSE CONVÊNIO ');
  }
  return res;
}

  const handleSave = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.warning(firstError || 'Por favor, preencha os campos destacados em vermelho.');
      return;
    }
    const isUnimed = /^unimed$/i.test(form.nome.trim());
    const isCoopend = /^coopend$/i.test(form.nome.trim());
    const finalNome = isUnimed ? 'UNIMED' : isCoopend ? 'COOPEND' : formatDescricao(form.nome.trim().toUpperCase());
    const sanitizedForm = {
      ...form,
      nome: finalNome,
    };
    if (editId) {
      updateItem(MODULES.fluxoCaixa, editId, sanitizedForm);
    } else {
      addItem(MODULES.fluxoCaixa, sanitizedForm);
    }
    refresh();
    setModalOpen(false);
    toast.success(editId ? 'Lançamento atualizado no Fluxo de Caixa!' : 'Lançamento registrado no Fluxo de Caixa!');
  };

  const consolidadoExamesList = useMemo(() => {
    if (!viewingConsolidadoItem) return [];
    const item = viewingConsolidadoItem;
    const targetKey =
      item.convenioConsolidado ||
      (item.nome?.toUpperCase().includes('UNIMED') ? 'UNIMED' : 'COOPEND');

    // 1. Prioritize explicit IDs if registered
    if (Array.isArray(item.examesIds) && item.examesIds.length > 0) {
      const idSet = new Set(item.examesIds);
      return examesConvenio
        .filter((e) => idSet.has(e.id))
        .sort((a, b) => (b.fluxoData || b.data || '').localeCompare(a.fluxoData || a.data || ''));
    }

    // 2. Fallback: match by destination and period
    const pStart = item.periodoStart || item.periodStart;
    const pEnd = item.periodoEnd || item.periodEnd;
    return examesConvenio
      .filter((e) => {
        if (!e) return false;
        const isLancado = Boolean(
          e.fluxoLancado ||
          (e.fluxoValorLancado !== undefined && Number(e.fluxoValorLancado) > 0) ||
          (e.valorClinica !== undefined && e.valorClinica !== '' && Number(e.valorClinica) > 0)
        );
        if (!isLancado) return false;
        const destino = getConvenioFluxoDestino(e.convenio);
        if (destino.key !== targetKey) return false;
        if (pStart && pEnd) {
          const paymentDate = e.fluxoData || e.data;
          return isDateInPeriod(paymentDate, { start: pStart, end: pEnd });
        }
        return true;
      })
      .sort((a, b) => (b.fluxoData || b.data || '').localeCompare(a.fluxoData || a.data || ''));
  }, [viewingConsolidadoItem, examesConvenio]);

  const filteredConsolidadoExames = useMemo(() => {
    if (!consolidadoSearch) return consolidadoExamesList;
    const q = consolidadoSearch.toLowerCase();
    return consolidadoExamesList.filter(
      (e) =>
        (e.paciente || '').toLowerCase().includes(q) ||
        (e.medico || '').toLowerCase().includes(q) ||
        (e.convenio || '').toLowerCase().includes(q) ||
        (e.exame || '').toLowerCase().includes(q)
    );
  }, [consolidadoExamesList, consolidadoSearch]);

  const handleDelete = () => {
    if (deleteId) {
      deleteItem(MODULES.fluxoCaixa, deleteId);
      refresh();
      toast.success('Lançamento excluído do Fluxo de Caixa.');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Fluxo de Caixa</h1>
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
            + Nova Movimentação
          </button>
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Entradas</span>
              <div className="summary-card-icon">📈</div>
            </div>
            <div className="summary-card-value value-positive">{formatCurrency(totalEntradas)}</div>
          </div>

          <div className="summary-card card-accent-red">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Saídas</span>
              <div className="summary-card-icon red">📉</div>
            </div>
            <div className="summary-card-value value-negative">{formatCurrency(totalSaidas)}</div>
          </div>

          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Saldo</span>
              <div className="summary-card-icon blue">💰</div>
            </div>
            <div className={`summary-card-value ${saldo >= 0 ? 'value-positive' : 'value-negative'}`}>
              {formatCurrency(saldo)}
            </div>
          </div>

          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Movimentações</span>
              <div className="summary-card-icon amber">📋</div>
            </div>
            <div className="summary-card-value">{filtered.length}</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Movimentações</h3>
            <div className="table-actions">
              <select
                className="input-field"
                value={typeFilter}
                onChange={(e) => {
                  const newType = e.target.value;
                  setTypeFilter(newType);
                  if (categoryFilter) {
                    let base = [];
                    if (newType === 'entrada') base = [...CATEGORIAS_ENTRADA];
                    else if (newType === 'saida') base = [...CATEGORIAS_SAIDA];
                    else base = [...CATEGORIAS_ENTRADA, ...CATEGORIAS_SAIDA];
                    const validSet = new Set(base);
                    data.forEach((d) => {
                      if (d.categoria && (!newType || d.tipo === newType)) {
                        validSet.add(d.categoria);
                      }
                    });
                    if (!validSet.has(categoryFilter)) {
                      setCategoryFilter('');
                    }
                  }
                }}
                style={{ width: '130px', fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
              >
                <option value="">Todos Tipos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
              </select>

              <select
                className="input-field"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: '170px', fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
              >
                <option value="">Todas Categorias</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar descrição ou categoria..."
                  value={search}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ExportMenu
                onExportCSV={() => exportCSV(filtered, columns, 'fluxo_caixa')}
                onExportPDF={() => exportPDF(filtered, columns, 'Fluxo de Caixa')}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th style={{ width: '90px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="table-empty">
                        <div className="table-empty-icon">💰</div>
                        <p>Nenhuma movimentação neste período com os filtros aplicados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.data)}</td>
                      <td style={{ fontWeight: 500 }}>
                        {formatDescricao(item.nome)}
                        {item.isConvenioConsolidado && item.qtdExames > 0 && (
                          <button
                            type="button"
                            className="badge"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingConsolidadoItem(item);
                              setConsolidadoSearch('');
                            }}
                            style={{
                              marginLeft: '0.45rem',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: 'var(--color-blue)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              transition: 'all 0.15s ease-in-out',
                            }}
                            title={`Clique para ver os ${item.qtdExames} exame(s) incluídos neste pagamento consolidado`}
                          >
                            <span>🏢 {item.qtdExames} exame{item.qtdExames > 1 ? 's' : ''}</span>
                            <span style={{ fontSize: '10px', opacity: 0.75 }}>🔍</span>
                          </button>
                        )}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: 'var(--bg-surface-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {item.categoria || 'Geral'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${item.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                          {item.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                        </span>
                      </td>
                      <td className={item.tipo === 'entrada' ? 'value-positive' : 'value-negative'}>
                        {formatCurrency(item.valor)}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(item)} title="Editar">
                            ✏️
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteId(item.id)} title="Excluir">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {filtered.length > 0 && (
                  <tr className="totals-row">
                    <td colSpan="4" style={{ textAlign: 'end', fontWeight: 700 }}>Totais no período:</td>
                    <td>
                      <span className={saldo >= 0 ? 'value-positive' : 'value-negative'} style={{ fontWeight: 700 }}>
                        {formatCurrency(saldo)}
                      </span>
                    </td>
                    <td />
                  </tr>
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
            label="movimentação(ões)"
            summaryNode={
              <span>
                Entradas: {formatCurrency(totalEntradas)} | Saídas: {formatCurrency(totalSaidas)}
              </span>
            }
          />
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Movimentação' : 'Nova Movimentação'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>{editId ? 'Salvar' : 'Cadastrar'}</button>
          </>
        }
      >
        <form onSubmit={handleSave} noValidate autoComplete="off">
          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">Data <span className="required">*</span></label>
              <input
                type="date"
                className={`input-field ${hasError('data') ? 'is-invalid' : ''}`}
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                onBlur={() => markTouched('data')}
              />
              {hasError('data') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.data}
                </div>
              )}
            </div>
            <div className="input-group">
              <label className="input-label">Tipo <span className="required">*</span></label>
              <select
                className="input-field"
                value={form.tipo}
                onChange={(e) => {
                  const newTipo = e.target.value;
                  const defaultCat = newTipo === 'entrada' ? CATEGORIAS_ENTRADA[0] : CATEGORIAS_SAIDA[0];
                  setForm({ ...form, tipo: newTipo, categoria: defaultCat });
                }}
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>

            <div className="input-group full-width">
              <label className="input-label">Categoria <span className="required">*</span></label>
              <select
                className={`input-field ${hasError('categoria') ? 'is-invalid' : ''}`}
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                onBlur={() => markTouched('categoria')}
              >
                {(form.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {hasError('categoria') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.categoria}
                </div>
              )}
            </div>

            <div className="input-group full-width">
              <label className="input-label">Descrição <span className="required">*</span></label>
              <input
                type="text"
                className={`input-field ${hasError('nome') ? 'is-invalid' : ''}`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Nome ou descrição da movimentação"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value.toUpperCase() })}
                onBlur={() => markTouched('nome')}
              />
              {hasError('nome') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.nome}
                </div>
              )}
            </div>
            <div className="input-group full-width">
              <label className="input-label">Valor (R$) <span className="required">*</span></label>
              <input
                type="number"
                className={`input-field ${hasError('valor') ? 'is-invalid' : ''}`}
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                onBlur={() => markTouched('valor')}
              />
              {hasError('valor') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.valor}
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir esta movimentação?"
      />

      {/* Modal de Detalhes dos Exames Consolidados do Convênio */}
      <Modal
        isOpen={Boolean(viewingConsolidadoItem)}
        onClose={() => setViewingConsolidadoItem(null)}
        title={
          viewingConsolidadoItem
            ? `Exames Consolidados — ${formatDescricao(viewingConsolidadoItem.nome)}`
            : 'Exames Consolidados'
        }
        maxWidth="950px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Total: <strong>{consolidadoExamesList.length}</strong> exame(s) | Entrada Clínica no Caixa:{' '}
              <strong style={{ color: 'var(--color-success)', fontSize: 'var(--text-base)' }}>
                {formatCurrency(
                  consolidadoExamesList.reduce(
                    (s, e) => s + Number(e.fluxoValorLancado || e.valorClinica || 0),
                    0
                  )
                )}
              </strong>
            </div>
            <button className="btn btn-secondary" onClick={() => setViewingConsolidadoItem(null)}>
              Fechar
            </button>
          </div>
        }
      >
        {viewingConsolidadoItem && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                background: 'var(--bg-surface-elevated)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Lançamento no Caixa
                </div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {formatDescricao(viewingConsolidadoItem.nome)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Período Aquisitivo
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {viewingConsolidadoItem.periodoLabel ||
                    (viewingConsolidadoItem.periodoStart && viewingConsolidadoItem.periodoEnd
                      ? `${formatDate(viewingConsolidadoItem.periodoStart)} a ${formatDate(viewingConsolidadoItem.periodoEnd)}`
                      : formatDate(viewingConsolidadoItem.data))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Data do Lote
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {formatDate(viewingConsolidadoItem.data)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Valor Consolidado no Caixa
                </div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-success)', marginTop: '0.2rem' }}>
                  {formatCurrency(viewingConsolidadoItem.valor)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Relação dos Exames Inseridos ({filteredConsolidadoExames.length} de {consolidadoExamesList.length})
              </div>
              {consolidadoExamesList.length > 5 && (
                <div style={{ width: '260px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Filtrar por paciente, convênio..."
                    value={consolidadoSearch}
                    onChange={(e) => setConsolidadoSearch(e.target.value)}
                    style={{ fontSize: 'var(--text-xs)', padding: '0.35rem 0.65rem' }}
                  />
                </div>
              )}
            </div>

            <div
              className="table-scroll"
              style={{
                maxHeight: '380px',
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <table className="data-table" style={{ fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Data</th>
                    <th>Paciente</th>
                    <th>Convênio</th>
                    <th>Médico</th>
                    <th>Exame</th>
                    <th style={{ textAlign: 'right', width: '130px' }}>Entrada Clínica</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConsolidadoExames.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Nenhum exame encontrado com os critérios informados.
                      </td>
                    </tr>
                  ) : (
                    filteredConsolidadoExames.map((ex) => {
                      const clinicaVal = Number(ex.fluxoValorLancado || ex.valorClinica || 0);
                      const procs = normalizeProcedimentosComplementares(ex.procedimentoComplementar);
                      return (
                        <tr key={ex.id}>
                          <td>{formatDate(ex.fluxoData || ex.data)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {ex.paciente ? ex.paciente.toUpperCase() : '—'}
                          </td>
                          <td>
                            <span className="badge badge-info" style={{ fontWeight: 600 }}>
                              {ex.convenio ? ex.convenio.toUpperCase() : '—'}
                            </span>
                          </td>
                          <td>
                            <div>{ex.medico ? ex.medico.toUpperCase() : '—'}</div>
                            {ex.temDivisaoMedico2 && ex.medico2 && (
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                👥 c/ {ex.medico2.toUpperCase()} ({ex.porcentagemMedico1 ?? 87.5}% / {ex.porcentagemMedico2 ?? 12.5}%)
                              </div>
                            )}
                          </td>
                          <td>
                            {ex.exame ? ex.exame.toUpperCase() : '—'}
                            {procs.map((proc) => {
                              const tagLabel = proc === 'POLIPECTOMIA' ? 'P' : proc === 'MUCOSECTOMIA' ? 'M' : proc;
                              return (
                                <span
                                  key={proc}
                                  className="badge badge-info"
                                  style={{ marginLeft: '0.35rem', fontSize: '10px', padding: '1px 5px' }}
                                  title={proc}
                                >
                                  {tagLabel}
                                </span>
                              );
                            })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                            {formatCurrency(clinicaVal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
