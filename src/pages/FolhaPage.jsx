import { useState, useMemo, useEffect } from 'react';
import { getData, addItem, updateItem, deleteItem, getItem } from '../utils/storage';
import {
  formatCurrency,
  formatDate,
  exportCSV,
  exportPDF,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  getTodayISO,
} from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';
import Pagination from '../components/Pagination';
import { useToast } from '../contexts/ToastContext';
import { validateRequired, validatePositiveNumber } from '../utils/validation';

const emptyForm = {
  nome: '',
  cargo: '',
  salarioBase: '',
  valeAlimentacao: '',
  valeTransporte: '',
  extras: '',
  descontos: '',
  produtividade: '',
};

function calcLiquido(f) {
  return (
    Number(f.salarioBase || 0) +
    Number(f.valeAlimentacao || 0) +
    Number(f.valeTransporte || 0) +
    Number(f.extras || 0) +
    Number(f.produtividade || 0) -
    Number(f.descontos || 0)
  );
}

const columns = [
  { key: 'nome', label: 'Nome' },
  { key: 'cargo', label: 'Cargo', accessor: (item) => item.cargo || '—' },
  { key: 'salarioBase', label: 'Salário Base', accessor: (item) => formatCurrency(item.salarioBase) },
  { key: 'valeAlimentacao', label: 'V. Alimentação', accessor: (item) => formatCurrency(item.valeAlimentacao) },
  { key: 'valeTransporte', label: 'V. Transporte', accessor: (item) => formatCurrency(item.valeTransporte) },
  { key: 'extras', label: 'Extras', accessor: (item) => formatCurrency(item.extras) },
  { key: 'descontos', label: 'Descontos', accessor: (item) => formatCurrency(item.descontos) },
  { key: 'produtividade', label: 'Produtividade', accessor: (item) => formatCurrency(item.produtividade) },
  { key: 'liquido', label: 'Líquido', accessor: (item) => formatCurrency(calcLiquido(item)) },
];

export default function FolhaPage() {
  const toast = useToast();
  const [data, setData] = useState(() => getData('folhaPagamento'));
  const [fluxoCaixa, setFluxoCaixa] = useState(() => getData('fluxoCaixa'));
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validationErrors = useMemo(() => {
    const errs = {};
    const nomeErr = validateRequired(form.nome, 'Nome do colaborador');
    if (nomeErr) errs.nome = nomeErr;

    const salErr = validatePositiveNumber(form.salarioBase, 'Salário Base', true);
    if (salErr) errs.salarioBase = salErr;

    return errs;
  }, [form]);

  const hasError = (field) => Boolean((submitted || touched[field]) && validationErrors[field]);

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  useEffect(() => {
    setCurrentPage(1);
  }, [period, search]);

  const refresh = () => {
    setData(getData('folhaPagamento'));
    setFluxoCaixa(getData('fluxoCaixa'));
  };

  // Resolve employees for the current selected acquisition period
  const resolvedEmployees = useMemo(() => {
    return data
      .filter((emp) => {
        // Active employees always appear; inactive employees only appear if they have a record in this period
        if (emp.ativo === false && !emp.periodos?.[period.start]) return false;
        return true;
      })
      .map((emp) => {
        const periodData = emp.periodos?.[period.start];
        const isLegacyCurrent = !emp.periodos && isCurrentPeriod;

        // Apenas o salário-base permanece o mesmo para os meses posteriores
        const salarioBase = Number(periodData?.salarioBase ?? emp.salarioBase ?? 0);

        // Todas as outras informações mudam mês a mês (zeradas se não lançadas no período)
        const valeAlimentacao = Number(periodData?.valeAlimentacao ?? (isLegacyCurrent ? emp.valeAlimentacao : 0) ?? 0);
        const valeTransporte = Number(periodData?.valeTransporte ?? (isLegacyCurrent ? emp.valeTransporte : 0) ?? 0);
        const extras = Number(periodData?.extras ?? (isLegacyCurrent ? emp.extras : 0) ?? 0);
        const descontos = Number(periodData?.descontos ?? (isLegacyCurrent ? emp.descontos : 0) ?? 0);
        const produtividade = Number(periodData?.produtividade ?? (isLegacyCurrent ? emp.produtividade : 0) ?? 0);

        const liquido = calcLiquido({
          salarioBase,
          valeAlimentacao,
          valeTransporte,
          extras,
          descontos,
          produtividade,
        });

        return {
          ...emp,
          salarioBase,
          valeAlimentacao,
          valeTransporte,
          extras,
          descontos,
          produtividade,
          liquido,
        };
      });
  }, [data, period, isCurrentPeriod]);

  const filtered = useMemo(() => {
    let items = resolvedEmployees;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.nome || '').toLowerCase().includes(q) ||
          (e.cargo || '').toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [resolvedEmployees, search]);

  // Financial aggregates for the selected period
  const totalFolha = filtered.reduce((s, f) => s + f.liquido, 0);
  const totalBase = filtered.reduce((s, f) => s + f.salarioBase, 0);
  const totalBeneficios = filtered.reduce((s, f) => s + f.valeAlimentacao + f.valeTransporte, 0);
  const totalVariaveis = filtered.reduce((s, f) => s + f.extras + f.produtividade, 0);
  const totalDescontos = filtered.reduce((s, f) => s + f.descontos, 0);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = useMemo(
    () => filtered.slice(startIndex, startIndex + pageSize),
    [filtered, startIndex, pageSize]
  );

  // Check if current period has already been posted to Fluxo de Caixa
  const folhaLancamentoNoCaixa = useMemo(() => {
    return fluxoCaixa.find(
      (f) =>
        f.folhaPeriodoStart === period.start ||
        (f.categoria === 'Folha de Pagamento / Pessoal' && (f.nome || '').includes(period.label))
    );
  }, [fluxoCaixa, period]);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setTouched({});
    setSubmitted(false);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      nome: item.nome || '',
      cargo: item.cargo || '',
      salarioBase: item.salarioBase !== undefined && item.salarioBase !== null ? item.salarioBase : '',
      valeAlimentacao: item.valeAlimentacao !== undefined && item.valeAlimentacao !== null ? item.valeAlimentacao : '',
      valeTransporte: item.valeTransporte !== undefined && item.valeTransporte !== null ? item.valeTransporte : '',
      extras: item.extras !== undefined && item.extras !== null ? item.extras : '',
      descontos: item.descontos !== undefined && item.descontos !== null ? item.descontos : '',
      produtividade: item.produtividade !== undefined && item.produtividade !== null ? item.produtividade : '',
    });
    setTouched({});
    setSubmitted(false);
    setModalOpen(true);
  };

  const handleSave = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitted(true);

    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.warning(firstError || 'Por favor, preencha os campos obrigatórios destacados em vermelho.');
      return;
    }

    const nomeTrimmed = (form.nome || '').trim().toUpperCase();
    if (!nomeTrimmed) {
      toast.warning('O nome do colaborador é obrigatório.');
      return;
    }

    if (form.salarioBase === '' || form.salarioBase === null || form.salarioBase === undefined) {
      toast.warning('O Salário Base é obrigatório.');
      return;
    }

    const salarioBaseNum = Number(form.salarioBase);
    if (isNaN(salarioBaseNum) || salarioBaseNum < 0) {
      toast.warning('Informe um salário base válido maior ou igual a zero.');
      return;
    }

    const baseVA = Number(form.valeAlimentacao || 0);
    const baseVT = Number(form.valeTransporte || 0);
    const baseExtras = Number(form.extras || 0);
    const baseDescontos = Number(form.descontos || 0);
    const baseProd = Number(form.produtividade || 0);

    const periodEntry = {
      salarioBase: salarioBaseNum,
      valeAlimentacao: baseVA,
      valeTransporte: baseVT,
      extras: baseExtras,
      descontos: baseDescontos,
      produtividade: baseProd,
      updatedAt: new Date().toISOString(),
    };

    const employeeBase = {
      nome: nomeTrimmed,
      cargo: form.cargo ? form.cargo.trim().toUpperCase() : '',
      salarioBase: salarioBaseNum,
    };

    if (editId) {
      const existing =
        data.find((emp) => String(emp.id) === String(editId)) ||
        getItem('folhaPagamento', editId) ||
        {};

      const updatedPeriodos = {
        ...(existing.periodos || {}),
        [period.start]: periodEntry,
      };

      const updatedEmployee = {
        ...existing,
        ...employeeBase,
        periodos: updatedPeriodos,
      };

      updateItem('folhaPagamento', editId, updatedEmployee);
      toast.success(`Alterações de ${nomeTrimmed} salvas com sucesso!`);
    } else {
      const newEmployee = {
        ...employeeBase,
        ativo: true,
        periodos: {
          [period.start]: periodEntry,
        },
      };

      addItem('folhaPagamento', newEmployee);
      toast.success(`Colaborador ${nomeTrimmed} cadastrado com sucesso!`);
    }

    refresh();
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteItem('folhaPagamento', deleteId);
      refresh();
      toast.success('Colaborador removido da folha.');
    }
  };

  // Copy values from previous acquisition period to current period
  const handleCopyFromPrevious = () => {
    const prevPeriod = navigateAcquisitionPeriod(period, -1);
    let copiedCount = 0;

    const updatedData = data.map((emp) => {
      if (emp.ativo === false) return emp;
      const prevEntry = emp.periodos?.[prevPeriod.start];
      if (prevEntry) {
        copiedCount++;
        return {
          ...emp,
          periodos: {
            ...(emp.periodos || {}),
            [period.start]: {
              ...prevEntry,
              copiedFrom: prevPeriod.start,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      }
      return emp;
    });

    if (copiedCount === 0) {
      toast.info(`Nenhum lançamento personalizado encontrado no período anterior (${prevPeriod.label}).`);
      return;
    }

    setData(updatedData);
    localStorage.setItem('endodiagnose_folha_pagamento', JSON.stringify(updatedData));
    updatedData.forEach((emp) => updateItem('folhaPagamento', emp.id, emp));
    toast.success(`Lançamentos de ${copiedCount} colaborador(es) copiados do período anterior!`);
  };

  // Launch net payroll into Fluxo de Caixa
  const handleLancarFluxo = () => {
    if (totalFolha <= 0) {
      toast.warning('O valor total líquido da folha deve ser maior que zero.');
      return;
    }

    const descricao = `FOLHA DE PAGAMENTO — ${period.label}`;

    if (folhaLancamentoNoCaixa) {
      updateItem('fluxoCaixa', folhaLancamentoNoCaixa.id, {
        valor: totalFolha,
        nome: descricao,
        data: folhaLancamentoNoCaixa.data || getTodayISO(),
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Lançamento no Fluxo de Caixa atualizado para ${formatCurrency(totalFolha)}!`);
    } else {
      addItem('fluxoCaixa', {
        data: getTodayISO(),
        nome: descricao,
        categoria: 'Folha de Pagamento / Pessoal',
        tipo: 'saida',
        valor: totalFolha,
        folhaPeriodoStart: period.start,
      });
      toast.success(`Folha de ${formatCurrency(totalFolha)} lançada com sucesso no Fluxo de Caixa!`);
    }
    setFluxoCaixa(getData('fluxoCaixa'));
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Folha de Pagamento</h1>
        </div>
        <div className="header-actions">
          {/* Period selector */}
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

          {/* Action to copy from previous period */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyFromPrevious}
            title={`Copiar lançamentos do período anterior (${navigateAcquisitionPeriod(period, -1).label})`}
          >
            📋 Copiar Mês Anterior
          </button>

          {/* Action to launch into Fluxo de Caixa */}
          <button
            type="button"
            className={`btn btn-sm ${folhaLancamentoNoCaixa ? 'btn-secondary' : 'btn-secondary'}`}
            onClick={handleLancarFluxo}
            style={folhaLancamentoNoCaixa ? { borderColor: 'var(--color-emerald)', color: 'var(--color-emerald)' } : {}}
            title={folhaLancamentoNoCaixa ? 'Atualizar valor da folha no Fluxo de Caixa' : 'Lançar saída da folha no Fluxo de Caixa'}
          >
            💵 {folhaLancamentoNoCaixa ? 'Atualizar no Caixa' : 'Lançar no Caixa'}
          </button>

          <button type="button" className="btn btn-primary" onClick={openNew}>
            + Novo Funcionário
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* 5 KPI Summary Cards for the Period */}
        <div className="summary-cards summary-cards-5">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Líquido da Folha</span>
              <div className="summary-card-icon">💰</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalFolha)}</div>
          </div>

          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Salários Base</span>
              <div className="summary-card-icon blue">📊</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalBase)}</div>
          </div>

          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Benefícios (VA + VT)</span>
              <div className="summary-card-icon amber">🥪</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalBeneficios)}</div>
          </div>

          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Extras & Produtividade</span>
              <div className="summary-card-icon purple">📈</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalVariaveis)}</div>
          </div>

          <div className="summary-card card-accent-red">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Descontos</span>
              <div className="summary-card-icon red">📉</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalDescontos)}</div>
          </div>
        </div>

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
                onExportCSV={() => exportCSV(filtered, columns, `folha_pagamento_${period.start}`)}
                onExportPDF={() => exportPDF(filtered, columns, `Folha de Pagamento — ${period.label}`)}
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
                        <p>Nenhum colaborador registrado{search ? ' para esta busca' : ' neste período'}.</p>
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
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
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
                        <td style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-sm)' }}>
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
                      <td className="value-currency" style={{ fontWeight: 700 }}>{formatCurrency(totalBase)}</td>
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
                Total Líquido da Folha ({period.label}): <strong style={{ color: 'var(--color-emerald)' }}>{formatCurrency(totalFolha)}</strong>
              </span>
            }
          />
        </div>
      </div>

      {/* Modal: Cadastro / Edição por Período */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? `Editar Colaborador — ${form.nome || 'Colaborador'}` : 'Novo Colaborador'}
        maxWidth="640px"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {editId ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} noValidate autoComplete="off">
          <div style={{ marginBottom: '0.85rem', padding: '0.5rem 0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            📅 Competência / Período: <strong style={{ color: 'var(--text-primary)' }}>{period.label}</strong>
          </div>

          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">
                Nome do Colaborador <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`input-field ${hasError('nome') ? 'is-invalid' : ''}`}
                autoComplete="off"
                placeholder="Ex: MARIA SILVA"
                value={form.nome}
                onChange={(e) => updateField('nome', e.target.value.toUpperCase())}
                onBlur={() => markTouched('nome')}
              />
              {hasError('nome') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.nome}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Cargo / Função</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ex: RECEPCIONISTA, ENFERMEIRA..."
                value={form.cargo}
                onChange={(e) => updateField('cargo', e.target.value.toUpperCase())}
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                Salário Base (R$) <span className="required">*</span>
              </label>
              <input
                type="number"
                className={`input-field ${hasError('salarioBase') ? 'is-invalid' : ''}`}
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.salarioBase}
                onChange={(e) => updateField('salarioBase', e.target.value)}
                onBlur={() => markTouched('salarioBase')}
              />
              {hasError('salarioBase') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.salarioBase}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Vale Alimentação (R$)</label>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.valeAlimentacao}
                onChange={(e) => updateField('valeAlimentacao', e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Vale Transporte (R$)</label>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.valeTransporte}
                onChange={(e) => updateField('valeTransporte', e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Extras / Horas Extras (R$)</label>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.extras}
                onChange={(e) => updateField('extras', e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Produtividade / Bônus (R$)</label>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.produtividade}
                onChange={(e) => updateField('produtividade', e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Descontos / Faltas (R$)</label>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.descontos}
                onChange={(e) => updateField('descontos', e.target.value)}
              />
            </div>
          </div>

          {(form.salarioBase || form.extras || form.descontos || form.produtividade || form.valeAlimentacao || form.valeTransporte) && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                background: 'oklch(72% 0.19 160 / 0.08)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 'var(--text-sm)',
                border: '1px solid oklch(72% 0.19 160 / 0.2)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Salário Líquido Estimado no Período:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-lg)' }}>
                {formatCurrency(calcLiquido(form))}
              </span>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir este colaborador?"
      />
    </>
  );
}
