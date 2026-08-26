import { useState, useMemo, useEffect } from 'react';
import { getData, addItem, updateItem, deleteItem } from '../utils/storage';
import {
  formatCurrency,
  roundCurrency,
  formatDate,
  getTodayISO,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  getHonorarioInPeriod,
  getHonorarioMedicoInPeriod,
  examHasInstallmentInPeriod,
  getInstallmentLabel,
  migrateLegacyPayment,
  isCreditCardPayment,
  exportCSV,
  exportPDF,
  DEFAULT_EXAMES,
} from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';
import AutoCompleteInput from '../components/AutoCompleteInput';

const emptyPagamento = { forma: 'Cartão de Crédito', valor: '', parcelas: '1' };

const emptyForm = {
  data: '',
  paciente: '',
  tipoExame: '',
  medico: '',
  pagamentos: [{ ...emptyPagamento }],
  temDivisao: false,
  medico2: '',
  divisaoTipo: 'porcentagem',
  porcentagemMedico1: 50,
  porcentagemMedico2: 50,
  valorMedico1: '',
  valorMedico2: '',
  valorRetidoTaxas: '',
  valorNotaFiscal: '',
  valorAnestesista: '',
  taxaClinica: '',
  valorAcessorios: '',
  valorBiopsia: '',
  honorariosMedicos: '',
};

function calcAutoHonorarios(f) {
  const pagamentos = f.pagamentos || [];
  const totalPag = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const taxas = Number(f.valorRetidoTaxas || 0);
  const nf = Number(f.valorNotaFiscal || 0);
  const anest = Number(f.valorAnestesista || 0);
  const clinica = Number(f.taxaClinica || 0);
  const acess = Number(f.valorAcessorios || 0);
  const biop = Number(f.valorBiopsia || 0);

  const sobra = totalPag - (taxas + nf + anest + clinica + acess + biop);
  return Math.max(0, roundCurrency(sobra));
}

export default function DetalhesPage({ prefillData, onClearPrefill }) {
  const [data, setData] = useState(() => getData('detalhesExames'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());

  useEffect(() => {
    if (prefillData) {
      setEditId(null);
      const examDate = prefillData.data || getTodayISO();
      setForm({
        ...emptyForm,
        data: examDate,
        paciente: prefillData.paciente || '',
        tipoExame: prefillData.tipoExame || '',
        medico: prefillData.medico || '',
      });
      if (prefillData.data) {
        const dateObj = new Date(prefillData.data + 'T00:00:00');
        setPeriod(getAcquisitionPeriod(dateObj));
      }
      setModalOpen(true);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillData, onClearPrefill]);

  const refresh = () => setData(getData('detalhesExames'));

  const medicosOptions = useMemo(() => {
    const list = getData('medicos') || [];
    const set = new Set(list.map((m) => m.nome.trim()));

    const exames = getData('exames') || [];
    const detalhes = getData('detalhesExames') || [];

    exames.forEach((e) => {
      if (e.medico && e.medico.trim()) set.add(e.medico.trim());
    });
    detalhes.forEach((d) => {
      if (d.medico && d.medico.trim()) set.add(d.medico.trim());
      if (d.medico2 && d.medico2.trim()) set.add(d.medico2.trim());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [modalOpen]);

  const examesOptions = useMemo(() => {
    const set = new Set(DEFAULT_EXAMES);
    const exames = getData('exames') || [];
    const detalhes = getData('detalhesExames') || [];

    exames.forEach((e) => {
      if (e.exame && e.exame.trim()) set.add(e.exame.trim());
    });
    detalhes.forEach((d) => {
      if (d.tipoExame && d.tipoExame.trim()) set.add(d.tipoExame.trim());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [modalOpen]);

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
          (e.tipoExame || '').toLowerCase().includes(q) ||
          (e.medico || '').toLowerCase().includes(q) ||
          (e.formaPagamento || '').toLowerCase().includes(q) ||
          (e.pagamentos || []).some((p) => (p.forma || '').toLowerCase().includes(q))
      );
    }
    return items.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [data, search, period]);

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
    setEditId(null);
    setForm({ ...emptyForm, data: getTodayISO(), pagamentos: [{ ...emptyPagamento }] });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    const pagamentos = migrateLegacyPayment(item).map((p) => ({
      forma: p.forma || 'Cartão de Crédito',
      valor: p.valor || '',
      parcelas: String(p.parcelas || 1),
    }));
    setForm({
      data: item.data || '',
      paciente: item.paciente || '',
      tipoExame: item.tipoExame || '',
      medico: item.medico || '',
      pagamentos,
      temDivisao: !!(item.temDivisao || item.medico2),
      medico2: item.medico2 || '',
      divisaoTipo: item.divisaoTipo || 'porcentagem',
      porcentagemMedico1: item.porcentagemMedico1 ?? 50,
      porcentagemMedico2: item.porcentagemMedico2 ?? 50,
      valorMedico1: item.valorMedico1 || '',
      valorMedico2: item.valorMedico2 || '',
      valorRetidoTaxas: item.valorRetidoTaxas || '',
      valorNotaFiscal: item.valorNotaFiscal || '',
      valorAnestesista: item.valorAnestesista || '',
      taxaClinica: item.taxaClinica || '',
      valorAcessorios: item.valorAcessorios || '',
      valorBiopsia: item.valorBiopsia || '',
      honorariosMedicos: item.honorariosMedicos || '',
    });
    setModalOpen(true);
  };

  const syncFluxoCaixaEntries = (detalheItem) => {
    if (!detalheItem || !detalheItem.id) return;
    const fluxoList = getData('fluxoCaixa') || [];

    // 1. Sync Taxa Clínica
    const valorTaxa = Number(detalheItem.taxaClinica || 0);
    const keyTaxa = `${detalheItem.id}_taxa`;
    const existingTaxa = fluxoList.find((f) => f.detalheId === keyTaxa || f.detalheId === detalheItem.id);

    const entryTaxa = {
      data: detalheItem.data,
      nome: `Taxa Clínica — ${detalheItem.paciente}`,
      tipo: 'entrada',
      categoria: 'Exames / Procedimentos',
      valor: valorTaxa,
      detalheId: keyTaxa,
    };

    if (valorTaxa > 0) {
      if (existingTaxa) {
        updateItem('fluxoCaixa', existingTaxa.id, entryTaxa);
      } else {
        addItem('fluxoCaixa', entryTaxa);
      }
    } else if (existingTaxa) {
      deleteItem('fluxoCaixa', existingTaxa.id);
    }

    // 2. Sync Valor de Acessórios
    const valorAcess = Number(detalheItem.valorAcessorios || 0);
    const keyAcess = `${detalheItem.id}_acessorios`;
    const existingAcess = fluxoList.find((f) => f.detalheId === keyAcess);

    const entryAcess = {
      data: detalheItem.data,
      nome: `Valor de Acessórios — ${detalheItem.paciente}`,
      tipo: 'entrada',
      categoria: 'Venda de Materiais',
      valor: valorAcess,
      detalheId: keyAcess,
    };

    if (valorAcess > 0) {
      if (existingAcess) {
        updateItem('fluxoCaixa', existingAcess.id, entryAcess);
      } else {
        addItem('fluxoCaixa', entryAcess);
      }
    } else if (existingAcess) {
      deleteItem('fluxoCaixa', existingAcess.id);
    }

    // 3. Sync Valor de Biópsia
    const valorBiop = Number(detalheItem.valorBiopsia || 0);
    const keyBiop = `${detalheItem.id}_biopsia`;
    const existingBiop = fluxoList.find((f) => f.detalheId === keyBiop);

    const entryBiop = {
      data: detalheItem.data,
      nome: `Biópsia — ${detalheItem.paciente}`,
      tipo: 'entrada',
      categoria: 'Exames / Procedimentos',
      valor: valorBiop,
      detalheId: keyBiop,
    };

    if (valorBiop > 0) {
      if (existingBiop) {
        updateItem('fluxoCaixa', existingBiop.id, entryBiop);
      } else {
        addItem('fluxoCaixa', entryBiop);
      }
    } else if (existingBiop) {
      deleteItem('fluxoCaixa', existingBiop.id);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const pagamentos = (form.pagamentos || []).filter((p) => Number(p.valor) > 0);
    if (!form.data || !form.paciente || !form.tipoExame || !form.medico || pagamentos.length === 0) return;

    const sanitizedPagamentos = pagamentos.map((p) => ({
      forma: p.forma || 'Cartão de Crédito',
      valor: roundCurrency(p.valor),
      parcelas: Math.max(1, Number(p.parcelas) || 1),
    }));

    const totalPag = sanitizedPagamentos.reduce((s, p) => s + p.valor, 0);
    const totalParcelas = sanitizedPagamentos.reduce((s, p) => s + p.parcelas, 0);
    const formaLabel = sanitizedPagamentos.length === 1
      ? sanitizedPagamentos[0].forma
      : 'Misto';

    const sanitizedForm = {
      ...form,
      pagamentos: sanitizedPagamentos,
      // Derived fields for backward compatibility and quick display
      valorPagamento: roundCurrency(totalPag),
      numParcelas: String(totalParcelas),
      formaPagamento: formaLabel,
      valorRetidoTaxas: roundCurrency(form.valorRetidoTaxas),
      valorNotaFiscal: roundCurrency(form.valorNotaFiscal),
      valorAnestesista: roundCurrency(form.valorAnestesista),
      taxaClinica: roundCurrency(form.taxaClinica),
      valorAcessorios: roundCurrency(form.valorAcessorios),
      valorBiopsia: roundCurrency(form.valorBiopsia),
      honorariosMedicos: roundCurrency(form.honorariosMedicos),
      valorMedico1: form.valorMedico1 ? roundCurrency(form.valorMedico1) : '',
      valorMedico2: form.valorMedico2 ? roundCurrency(form.valorMedico2) : '',
      porcentagemMedico1: form.porcentagemMedico1 !== '' ? Math.round(Number(form.porcentagemMedico1) * 10) / 10 : 50,
      porcentagemMedico2: form.porcentagemMedico2 !== '' ? Math.round(Number(form.porcentagemMedico2) * 10) / 10 : 50,
    };
    let savedItem;
    if (editId) {
      savedItem = updateItem('detalhesExames', editId, sanitizedForm);
    } else {
      savedItem = addItem('detalhesExames', sanitizedForm);
    }
    if (savedItem) {
      syncFluxoCaixaEntries(savedItem);
    }
    refresh();
    setModalOpen(false);
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
    }
  };

  const updateField = (field, value) => {
    setForm((f) => {
      const updated = { ...f, [field]: value };
      if (
        [
          'valorRetidoTaxas',
          'valorNotaFiscal',
          'valorAnestesista',
          'taxaClinica',
          'valorAcessorios',
          'valorBiopsia',
          'pagamentos',
        ].includes(field)
      ) {
        const autoHon = calcAutoHonorarios(updated);
        updated.honorariosMedicos = autoHon > 0 ? String(roundCurrency(autoHon)) : '0';
      }
      return updated;
    });
  };

  // Helpers for pagamentos manipulation
  const updatePagamento = (index, field, value) => {
    setForm((f) => {
      const pagamentos = [...(f.pagamentos || [])];
      pagamentos[index] = { ...pagamentos[index], [field]: value };
      // Auto-set parcelas=1 for non-credit-card
      if (field === 'forma' && !isCreditCardPayment(value, 1)) {
        pagamentos[index].parcelas = '1';
      }
      const updated = { ...f, pagamentos };
      const autoHon = calcAutoHonorarios(updated);
      updated.honorariosMedicos = autoHon > 0 ? String(roundCurrency(autoHon)) : '0';
      return updated;
    });
  };

  const addPagamento = () => {
    setForm((f) => ({
      ...f,
      pagamentos: [...(f.pagamentos || []), { ...emptyPagamento }],
    }));
  };

  const removePagamento = (index) => {
    setForm((f) => {
      const pagamentos = (f.pagamentos || []).filter((_, i) => i !== index);
      if (pagamentos.length === 0) pagamentos.push({ ...emptyPagamento });
      const updated = { ...f, pagamentos };
      const autoHon = calcAutoHonorarios(updated);
      updated.honorariosMedicos = autoHon > 0 ? String(roundCurrency(autoHon)) : '0';
      return updated;
    });
  };

  // Computed totals from pagamentos
  const totalPagamentos = (form.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const totalParcelasForm = (form.pagamentos || []).reduce((s, p) => s + Math.max(1, Number(p.parcelas) || 1), 0);

  // Compute honorário mensal for the form preview
  const formHonorarioMensal = roundCurrency(
    Number(form.honorariosMedicos || 0) / Math.max(1, totalParcelasForm)
  );

  // Compute doctor split honorários for the form preview
  const totalHonForm = Number(form.honorariosMedicos || 0);
  let honDoc1Total = 0;
  let honDoc2Total = 0;
  let honDoc1Mensal = 0;
  let honDoc2Mensal = 0;

  if (form.temDivisao && form.medico2) {
    if (form.divisaoTipo === 'valor') {
      const val1 = Number(form.valorMedico1) || 0;
      const val2 = Number(form.valorMedico2) || 0;
      honDoc1Total = roundCurrency(val1);
      honDoc2Total = roundCurrency(val2);
      honDoc1Mensal = roundCurrency(val1 / Math.max(1, totalParcelasForm));
      honDoc2Mensal = roundCurrency(val2 / Math.max(1, totalParcelasForm));
    } else {
      const pct1 = Number(form.porcentagemMedico1) ?? 50;
      const pct2 = Number(form.porcentagemMedico2) ?? 50;
      honDoc1Total = roundCurrency((totalHonForm * pct1) / 100);
      honDoc2Total = roundCurrency((totalHonForm * pct2) / 100);
      honDoc1Mensal = roundCurrency((formHonorarioMensal * pct1) / 100);
      honDoc2Mensal = roundCurrency((formHonorarioMensal * pct2) / 100);
    }
  }

  // Export columns (period-aware)
  const exportColumns = [
    { key: 'data', label: 'Data', accessor: (item) => formatDate(item.data) },
    { key: 'paciente', label: 'Paciente' },
    { key: 'tipoExame', label: 'Tipo de Exame' },
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
          <div className="period-selector">
            <button
              className="period-btn"
              onClick={() => setPeriod(navigateAcquisitionPeriod(period, -1))}
              title="Período anterior"
            >
              ◀
            </button>
            <span className="period-label">{period.label}</span>
            <button
              className="period-btn"
              onClick={() => setPeriod(navigateAcquisitionPeriod(period, 1))}
              title="Próximo período"
            >
              ▶
            </button>
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Tipo Exame</th>
                  <th>Médico</th>
                  <th>Forma Pgto</th>
                  <th>Pagamento</th>
                  <th>Taxas</th>
                  <th>Nota Fiscal</th>
                  <th>Anestesista</th>
                  <th>Taxa Clínica</th>
                  <th>Acessórios</th>
                  <th>Biópsia</th>
                  <th>Parcelas</th>
                  <th>Hon. Total</th>
                  <th>Hon. no Período</th>
                  <th>Período Parcelas</th>
                  <th style={{ width: '90px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="17">
                      <div className="table-empty">
                        <div className="table-empty-icon">📋</div>
                        <p>Nenhum detalhe registrado para este período{search ? ' e busca' : ''}.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {filtered.map((item) => {
                      const pags = migrateLegacyPayment(item);
                      const numP = pags.reduce((s, p) => s + Math.max(1, Number(p.parcelas) || 1), 0);
                      const honNoPeriodo = getHonorarioInPeriod(item, period);
                      const isExamInThisPeriod = isDateInPeriod(item.data, period);

                      return (
                        <tr
                          key={item.id}
                          style={!isExamInThisPeriod ? { opacity: 0.8, fontStyle: 'italic' } : undefined}
                          title={!isExamInThisPeriod ? 'Exame de outro período — parcela de honorários cai neste período' : undefined}
                        >
                          <td>{formatDate(item.data)}</td>
                          <td>{item.paciente}</td>
                          <td>{item.tipoExame}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{item.medico}</div>
                            {item.medico2 && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-accent)' }}>
                                👥 c/ {item.medico2} (
                                {item.divisaoTipo === 'valor'
                                  ? `${formatCurrency(item.valorMedico1)} / ${formatCurrency(item.valorMedico2)}`
                                  : `${item.porcentagemMedico1 ?? 50}% / ${item.porcentagemMedico2 ?? 50}%`}
                                )
                              </div>
                            )}
                          </td>
                          <td>
                            {pags.length === 1 ? (
                              <span className="badge badge-neutral">
                                {pags[0].forma} {pags[0].parcelas > 1 ? `${pags[0].parcelas}x` : ''}
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                {pags.map((p, i) => (
                                  <span key={i} className="badge badge-neutral" style={{ fontSize: 'var(--text-xs)' }}>
                                    {p.forma} {p.parcelas > 1 ? `${p.parcelas}x` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="value-currency">
                            {isExamInThisPeriod ? formatCurrency(item.valorPagamento) : <span style={{ color: 'var(--text-muted)' }} title="Contabilizado no período em que o exame foi realizado">—</span>}
                          </td>
                          <td className="value-negative">
                            {isExamInThisPeriod ? formatCurrency(item.valorRetidoTaxas) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className="value-currency">
                            {isExamInThisPeriod ? formatCurrency(item.valorNotaFiscal) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className="value-currency">
                            {isExamInThisPeriod ? formatCurrency(item.valorAnestesista) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className={isExamInThisPeriod ? 'value-positive' : ''}>
                            {isExamInThisPeriod ? formatCurrency(item.taxaClinica) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className={isExamInThisPeriod ? 'value-positive' : ''}>
                            {isExamInThisPeriod ? formatCurrency(item.valorAcessorios) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className={isExamInThisPeriod ? 'value-positive' : ''}>
                            {isExamInThisPeriod ? formatCurrency(item.valorBiopsia) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {numP > 1 ? (
                              <span className="badge badge-info">{numP}×</span>
                            ) : (
                              '1×'
                            )}
                          </td>
                          <td className="value-currency">
                            <div>{formatCurrency(item.honorariosMedicos)}</div>
                            {(item.temDivisao || item.medico2) && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.3 }}>
                                {item.divisaoTipo === 'valor' ? (
                                  <>
                                    <div>{item.medico}: {formatCurrency(item.valorMedico1)}</div>
                                    <div>{item.medico2}: {formatCurrency(item.valorMedico2)}</div>
                                  </>
                                ) : (
                                  <>
                                    <div>{item.medico} ({item.porcentagemMedico1 ?? 50}%): {formatCurrency(roundCurrency((Number(item.honorariosMedicos || 0) * (Number(item.porcentagemMedico1) ?? 50)) / 100))}</div>
                                    <div>{item.medico2} ({item.porcentagemMedico2 ?? 50}%): {formatCurrency(roundCurrency((Number(item.honorariosMedicos || 0) * (Number(item.porcentagemMedico2) ?? 50)) / 100))}</div>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                          <td className={honNoPeriodo > 0 ? 'value-positive' : 'value-currency'}>
                            <div>
                              {formatCurrency(honNoPeriodo)}
                              {honNoPeriodo > 0 && (
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-emerald)', marginInlineStart: '0.25rem' }}>
                                  ✓
                                </span>
                              )}
                            </div>
                            {honNoPeriodo > 0 && (item.temDivisao || item.medico2) && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-accent)', marginTop: '0.2rem', lineHeight: 1.3 }}>
                                <div>{item.medico}: {formatCurrency(getHonorarioMedicoInPeriod(item, item.medico, period))}</div>
                                <div>{item.medico2}: {formatCurrency(getHonorarioMedicoInPeriod(item, item.medico2, period))}</div>
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {getInstallmentLabel(item.data, pags, item.formaPagamento)}
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
                      );
                    })}
                    <tr className="totals-row">
                      <td colSpan="5" style={{ textAlign: 'end', fontWeight: 700 }}>Totais no período:</td>
                      <td className="value-currency">{formatCurrency(totalPagamento)}</td>
                      <td className="value-negative">{formatCurrency(totalTaxas)}</td>
                      <td className="value-currency">{formatCurrency(totalNotaFiscal)}</td>
                      <td className="value-currency">{formatCurrency(totalAnestesista)}</td>
                      <td className="value-positive">{formatCurrency(totalClinicaPeriodo)}</td>
                      <td className="value-positive">{formatCurrency(totalAcessoriosPeriodo)}</td>
                      <td className="value-positive">{formatCurrency(totalBiopsiaPeriodo)}</td>
                      <td />
                      <td className="value-currency">
                        {formatCurrency(examsInPeriod.reduce((s, d) => s + Number(d.honorariosMedicos || 0), 0))}
                      </td>
                      <td className="value-positive">{formatCurrency(totalHonorariosPeriodo)}</td>
                      <td />
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="table-footer">
              <span>{filtered.length} registro(s)</span>
              <span>
                Clínica: {formatCurrency(totalClinicaPeriodo)} | Honorários: {formatCurrency(totalHonorariosPeriodo)}
              </span>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Detalhe' : 'Novo Detalhe de Exame'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>{editId ? 'Salvar' : 'Cadastrar'}</button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">Data <span className="required">*</span></label>
              <input type="date" className="input-field" required value={form.data} onChange={(e) => updateField('data', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Médico Principal <span className="required">*</span></label>
              <AutoCompleteInput
                options={medicosOptions}
                required
                placeholder="Selecione ou digite o médico"
                value={form.medico}
                onChange={(val) => updateField('medico', val)}
              />
            </div>

            <div className="input-group full-width" style={{ marginTop: '0.1rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                <input
                  type="checkbox"
                  checked={form.temDivisao}
                  onChange={(e) => updateField('temDivisao', e.target.checked)}
                />
                <span>👥 <strong>Dividir honorários com outro médico</strong></span>
              </label>
            </div>

            {form.temDivisao && (
              <div className="full-width" style={{
                padding: '0.875rem 1rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxSizing: 'border-box',
                width: '100%',
              }}>
                <div className="input-group">
                  <label className="input-label">Segundo Médico (Co-médico / Assistente) <span className="required">*</span></label>
                  <AutoCompleteInput
                    options={medicosOptions}
                    required={form.temDivisao}
                    placeholder="Selecione ou digite o 2º médico"
                    value={form.medico2}
                    onChange={(val) => updateField('medico2', val)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Tipo de Divisão de Honorários</label>
                  <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="divisaoTipo"
                        value="porcentagem"
                        checked={form.divisaoTipo === 'porcentagem'}
                        onChange={() => updateField('divisaoTipo', 'porcentagem')}
                      />
                      Porcentagem (%)
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="divisaoTipo"
                        value="valor"
                        checked={form.divisaoTipo === 'valor'}
                        onChange={() => updateField('divisaoTipo', 'valor')}
                      />
                      Valor Fixo (R$)
                    </label>
                  </div>
                </div>

                {form.divisaoTipo === 'porcentagem' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="input-group">
                      <label className="input-label">% {form.medico || 'Médico 1'}</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="50.0"
                        value={form.porcentagemMedico1}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setForm((f) => ({ ...f, porcentagemMedico1: '', porcentagemMedico2: '' }));
                            return;
                          }
                          const val = Number(raw);
                          if (isNaN(val)) return;
                          const clamped = Math.min(100, Math.max(0, val));
                          const other = Math.round((100 - clamped) * 10) / 10;
                          setForm((f) => ({ ...f, porcentagemMedico1: raw, porcentagemMedico2: other }));
                        }}
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">% {form.medico2 || 'Médico 2'}</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="50.0"
                        value={form.porcentagemMedico2}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setForm((f) => ({ ...f, porcentagemMedico2: '', porcentagemMedico1: '' }));
                            return;
                          }
                          const val = Number(raw);
                          if (isNaN(val)) return;
                          const clamped = Math.min(100, Math.max(0, val));
                          const other = Math.round((100 - clamped) * 10) / 10;
                          setForm((f) => ({ ...f, porcentagemMedico2: raw, porcentagemMedico1: other }));
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="input-group">
                      <label className="input-label">R$ {form.medico || 'Médico 1'}</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={form.valorMedico1}
                        onChange={(e) => updateField('valorMedico1', e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">R$ {form.medico2 || 'Médico 2'}</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={form.valorMedico2}
                        onChange={(e) => updateField('valorMedico2', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="input-group full-width">
              <label className="input-label">Paciente <span className="required">*</span></label>
              <input type="text" className="input-field" required placeholder="Nome do paciente" value={form.paciente} onChange={(e) => updateField('paciente', e.target.value)} />
            </div>
            <div className="input-group full-width">
              <label className="input-label">Tipo de Exame <span className="required">*</span></label>
              <AutoCompleteInput
                options={examesOptions}
                required
                placeholder="Selecione ou digite o tipo de exame"
                value={form.tipoExame}
                onChange={(val) => updateField('tipoExame', val)}
              />
            </div>
            {/* === SEÇÃO DE PAGAMENTOS DINÂMICA === */}
            <div className="full-width pagamentos-section">
              <div className="pagamentos-header">
                <span className="pagamentos-title">💳 Pagamentos <span className="required">*</span></span>
                <button
                  type="button"
                  className="btn-pagamento-add"
                  onClick={addPagamento}
                >
                  + Adicionar
                </button>
              </div>

              {(form.pagamentos || []).map((pag, idx) => (
                <div key={idx} className="pagamento-row">
                  <div className="pagamento-row-header">
                    <span className="pagamento-row-label">Pagamento {idx + 1}</span>
                    {(form.pagamentos || []).length > 1 && (
                      <button
                        type="button"
                        className="pagamento-row-remove"
                        onClick={() => removePagamento(idx)}
                        title="Remover pagamento"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="pagamento-row-fields">
                    <div className="input-group">
                      <label className="input-label">Forma</label>
                      <select
                        className="input-field"
                        value={pag.forma || 'Cartão de Crédito'}
                        onChange={(e) => updatePagamento(idx, 'forma', e.target.value)}
                      >
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Pix">Pix</option>
                        <option value="Espécie">Espécie</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label">Valor (R$)</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        required={idx === 0}
                        value={pag.valor}
                        onChange={(e) => updatePagamento(idx, 'valor', e.target.value)}
                      />
                    </div>
                    {isCreditCardPayment(pag.forma, 1) && (
                      <div className="input-group">
                        <label className="input-label">Parcelas</label>
                        <input
                          type="number"
                          className="input-field"
                          min="1"
                          step="1"
                          placeholder="1"
                          value={pag.parcelas}
                          onChange={(e) => updatePagamento(idx, 'parcelas', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {totalPagamentos > 0 && (
                <div className="pagamentos-total">
                  Total Pagamentos: <strong>{formatCurrency(totalPagamentos)}</strong>
                </div>
              )}
            </div>

            {/* === DEDUÇÕES / TAXAS (POR EXAME) === */}
            <div className="input-group">
              <label className="input-label">Valor Retido em Taxas (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorRetidoTaxas} onChange={(e) => updateField('valorRetidoTaxas', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Valor Nota Fiscal (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorNotaFiscal} onChange={(e) => updateField('valorNotaFiscal', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Valor Anestesista (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorAnestesista} onChange={(e) => updateField('valorAnestesista', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Taxa de Clínica (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.taxaClinica} onChange={(e) => updateField('taxaClinica', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Valor de Acessórios (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorAcessorios} onChange={(e) => updateField('valorAcessorios', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Valor de Biópsia (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorBiopsia} onChange={(e) => updateField('valorBiopsia', e.target.value)} />
            </div>
            <div className="input-group full-width">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="input-label">Honorários Médicos — Total (R$)</label>
              </div>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.honorariosMedicos} onChange={(e) => updateField('honorariosMedicos', e.target.value)} />
            </div>
          </div>

          {/* Preview de parcelas e honorário mensal */}
          {(totalParcelasForm >= 1 && Number(form.honorariosMedicos) > 0) && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'oklch(70% 0.18 250 / 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid oklch(70% 0.18 250 / 0.15)',
            }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                📅 Distribuição de Honorários
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Honorário por parcela ({totalParcelasForm}x):
                </span>
                <span style={{ fontWeight: 700, color: 'var(--color-blue)', fontSize: 'var(--text-lg)' }}>
                  {formatCurrency(formHonorarioMensal)}
                </span>
              </div>
              {form.data && (form.pagamentos || []).map((pag, idx) => {
                const n = Math.max(1, Number(pag.parcelas) || 1);
                const label = getInstallmentLabel(form.data, [pag]);
                return (
                  <div key={idx} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {pag.forma}: {n}x — {label}
                  </div>
                );
              })}
              {form.temDivisao && form.medico2 && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'oklch(70% 0.18 250 / 0.12)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid oklch(70% 0.18 250 / 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    👥 Divisão entre Médicos ({totalParcelasForm}x parcelas):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {form.medico || 'Médico 1'} ({form.divisaoTipo === 'porcentagem' ? `${form.porcentagemMedico1 ?? 50}%` : 'Fixo'}):
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-sm)', marginTop: '0.15rem' }}>
                        {formatCurrency(honDoc1Total)} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal', color: 'var(--text-muted)' }}>total</span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {formatCurrency(honDoc1Mensal)} / parcela
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {form.medico2 || 'Médico 2'} ({form.divisaoTipo === 'porcentagem' ? `${form.porcentagemMedico2 ?? 50}%` : 'Fixo'}):
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-sm)', marginTop: '0.15rem' }}>
                        {formatCurrency(honDoc2Total)} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal', color: 'var(--text-muted)' }}>total</span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {formatCurrency(honDoc2Mensal)} / parcela
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: 'oklch(72% 0.19 160 / 0.08)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-emerald)',
              }}>
                💡 A taxa de clínica ({formatCurrency(form.taxaClinica)}) entra integralmente no período em que o exame foi realizado.
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir este registro?"
      />
    </>
  );
}
