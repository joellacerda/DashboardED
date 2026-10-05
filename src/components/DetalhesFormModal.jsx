import { useState, useMemo, useEffect } from 'react';
import {
  getData,
  addItem,
  updateItem,
  deleteItem,
  getActiveMedicosOptions,
} from '../utils/storage';
import {
  roundCurrency,
  formatCurrency,
  getTodayISO,
  DEFAULT_EXAMES,
  examePermiteComplementar,
  PROCEDIMENTOS_COMPLEMENTARES,
  normalizeProcedimentosComplementares,
  formatProcedimentosComplementares,
  migrateLegacyPayment,
  isCreditCardPayment,
  getInstallmentLabel,
} from '../utils/helpers';
import Modal from './Modal';
import AutoCompleteInput from './AutoCompleteInput';
import { useToast } from '../contexts/ToastContext';
import {
  validateDate,
  validateRequired,
  validatePercentageSum,
} from '../utils/validation';

const emptyPagamento = { forma: 'Cartão de Crédito', valor: '', parcelas: '1' };

const emptyForm = {
  data: '',
  paciente: '',
  tipoExame: '',
  procedimentoComplementar: '',
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
  notaFiscalPercentual: 15,
  valorNotaFiscal: '',
  valorAnestesista: '',
  taxaClinica: '',
  valorAcessorios: '',
  acessorioParaMedico: false,
  valorBiopsia: '',
  honorariosMedicos: '',
};

function calcNotaFiscalFromPercent(pagamentos, percentual) {
  const totalPag = (pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const pct = Number(percentual);
  if (isNaN(pct) || pct <= 0 || totalPag <= 0) return 0;
  return roundCurrency((totalPag * pct) / 100);
}

function calcAutoHonorarios(f) {
  const pagamentos = f.pagamentos || [];
  const totalPag = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const taxas = Number(f.valorRetidoTaxas || 0);
  const nf = Number(f.valorNotaFiscal || 0);
  const anest = Number(f.valorAnestesista || 0);
  const clinica = Number(f.taxaClinica || 0);
  const acess = Number(f.valorAcessorios || 0);
  const biop = Number(f.valorBiopsia || 0);

  const deductAcess = f.acessorioParaMedico ? 0 : acess;
  const sobra = totalPag - (taxas + nf + anest + clinica + deductAcess + biop);
  return Math.max(0, roundCurrency(sobra));
}

export default function DetalhesFormModal({
  isOpen,
  editItem,
  prefillData,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validationErrors = useMemo(() => {
    const errs = {};
    const dateErr = validateDate(form.data, 'Data do exame');
    if (dateErr) errs.data = dateErr;

    const medErr = validateRequired(form.medico, 'Médico principal');
    if (medErr) errs.medico = medErr;

    if (form.temDivisao) {
      const med2Err = validateRequired(form.medico2, 'Segundo médico');
      if (med2Err) {
        errs.medico2 = med2Err;
      } else if (form.medico && form.medico.trim().toUpperCase() === form.medico2.trim().toUpperCase()) {
        errs.medico2 = 'O 2º médico deve ser diferente do médico principal.';
      }

      if (form.divisaoTipo === 'porcentagem') {
        const sumErr = validatePercentageSum(form.porcentagemMedico1, form.porcentagemMedico2);
        if (sumErr) errs.divisao = sumErr;
      }
    }

    const pacErr = validateRequired(form.paciente, 'Nome do paciente');
    if (pacErr) errs.paciente = pacErr;

    const exameErr = validateRequired(form.tipoExame, 'Tipo de exame');
    if (exameErr) errs.tipoExame = exameErr;

    const pagamentos = form.pagamentos || [];
    const validPags = pagamentos.filter((p) => Number(p.valor) > 0);
    if (pagamentos.length === 0 || validPags.length === 0) {
      errs.pagamentos = 'Adicione ao menos uma forma de pagamento com valor maior que R$ 0,00.';
    }

    return errs;
  }, [form]);

  const hasError = (field) => {
    return Boolean((submitted || touched[field]) && validationErrors[field]);
  };

  const medicosOptions = useMemo(() => getActiveMedicosOptions(), [isOpen]);

  const examesOptions = useMemo(() => {
    const set = new Set(DEFAULT_EXAMES);
    const exames = getData('exames') || [];
    const detalhes = getData('detalhesExames') || [];

    exames.forEach((e) => {
      if (e.exame && e.exame.trim()) set.add(e.exame.trim().toUpperCase());
    });
    detalhes.forEach((d) => {
      if (d.tipoExame && d.tipoExame.trim()) set.add(d.tipoExame.trim().toUpperCase());
      if (d.exame && d.exame.trim()) set.add(d.exame.trim().toUpperCase());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTouched({});
      setSubmitted(false);
      return;
    }

    if (editItem) {
      const pagamentos = migrateLegacyPayment(editItem).map((p) => ({
        forma: p.forma || 'Cartão de Crédito',
        valor: p.valor || '',
        parcelas: String(p.parcelas || 1),
      }));
      setForm({
        data: editItem.data || '',
        paciente: editItem.paciente || '',
        tipoExame: editItem.tipoExame || editItem.exame || '',
        procedimentoComplementar: editItem.procedimentoComplementar || '',
        medico: editItem.medico || '',
        pagamentos,
        temDivisao: Boolean(editItem.temDivisao || editItem.medico2),
        medico2: editItem.medico2 || '',
        divisaoTipo: editItem.divisaoTipo || 'porcentagem',
        porcentagemMedico1: editItem.porcentagemMedico1 ?? 50,
        porcentagemMedico2: editItem.porcentagemMedico2 ?? 50,
        valorMedico1: editItem.valorMedico1 || '',
        valorMedico2: editItem.valorMedico2 || '',
        valorRetidoTaxas: editItem.valorRetidoTaxas || '',
        notaFiscalPercentual: editItem.notaFiscalPercentual ?? 15,
        valorNotaFiscal: editItem.valorNotaFiscal || '',
        valorAnestesista: editItem.valorAnestesista || '',
        taxaClinica: editItem.taxaClinica || '',
        valorAcessorios: editItem.valorAcessorios || '',
        acessorioParaMedico: Boolean(editItem.acessorioParaMedico),
        valorBiopsia: editItem.valorBiopsia || '',
        honorariosMedicos: editItem.honorariosMedicos || '',
      });
    } else if (prefillData) {
      const examDate = prefillData.data || getTodayISO();
      setForm({
        ...emptyForm,
        data: examDate,
        paciente: prefillData.paciente || '',
        tipoExame: prefillData.tipoExame || prefillData.exame || '',
        procedimentoComplementar: prefillData.procedimentoComplementar || '',
        medico: prefillData.medico || '',
        pagamentos: [{ ...emptyPagamento }],
      });
    } else {
      setForm({ ...emptyForm, data: getTodayISO(), pagamentos: [{ ...emptyPagamento }] });
    }
  }, [isOpen, editItem, prefillData]);

  const updateField = (field, value) => {
    setForm((f) => {
      const updated = { ...f, [field]: value };

      if (field === 'notaFiscalPercentual') {
        const nfVal = calcNotaFiscalFromPercent(updated.pagamentos, value);
        updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      }

      if (field === 'valorNotaFiscal') {
        const totalPag = (updated.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
        if (totalPag > 0) {
          const pct = Math.round(((Number(value) || 0) / totalPag) * 1000) / 10;
          updated.notaFiscalPercentual = pct;
        }
      }

      if (field === 'pagamentos') {
        const nfVal = calcNotaFiscalFromPercent(value, updated.notaFiscalPercentual);
        updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      }

      if (
        [
          'valorRetidoTaxas',
          'valorNotaFiscal',
          'notaFiscalPercentual',
          'valorAnestesista',
          'taxaClinica',
          'valorAcessorios',
          'acessorioParaMedico',
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

  const updatePagamento = (index, field, value) => {
    setForm((f) => {
      const pagamentos = [...(f.pagamentos || [])];
      pagamentos[index] = { ...pagamentos[index], [field]: value };
      if (field === 'forma' && !isCreditCardPayment(value, 1)) {
        pagamentos[index].parcelas = '1';
      }
      const updated = { ...f, pagamentos };
      if (field === 'valor') {
        const nfVal = calcNotaFiscalFromPercent(pagamentos, updated.notaFiscalPercentual);
        updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      }
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
      const nfVal = calcNotaFiscalFromPercent(pagamentos, updated.notaFiscalPercentual);
      updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      const autoHon = calcAutoHonorarios(updated);
      updated.honorariosMedicos = autoHon > 0 ? String(roundCurrency(autoHon)) : '0';
      return updated;
    });
  };

  const syncFluxoCaixaEntries = (detalheItem) => {
    if (!detalheItem || !detalheItem.id) return;
    const fluxoList = getData('fluxoCaixa') || [];

    // 1. Sync Taxa Clínica
    const valorTaxa = Number(detalheItem.taxaClinica || 0);
    const keyTaxa = `${detalheItem.id}_taxa`;
    const existingTaxa = fluxoList.find((f) => f.detalheId === keyTaxa || f.detalheId === detalheItem.id);
    const pacienteNome = detalheItem.paciente ? detalheItem.paciente.trim().toUpperCase() : '';

    const entryTaxa = {
      data: detalheItem.data,
      nome: `TAXA DE CLÍNICA — ${pacienteNome}`,
      tipo: 'entrada',
      categoria: 'Taxa de Clínica',
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
    const acessGoesToClinic = !detalheItem.acessorioParaMedico;

    const entryAcess = {
      data: detalheItem.data,
      nome: `VALOR DE ACESSÓRIOS — ${pacienteNome}`,
      tipo: 'entrada',
      categoria: 'Venda de Materiais',
      valor: valorAcess,
      detalheId: keyAcess,
    };

    if (acessGoesToClinic && valorAcess > 0) {
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
      nome: `BIÓPSIA — ${pacienteNome}`,
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
    if (e) e.preventDefault();
    setSubmitted(true);

    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.warning(firstError || 'Por favor, verifique os campos obrigatórios destacados em vermelho.');
      return;
    }

    const pagamentos = (form.pagamentos || []).filter((p) => Number(p.valor) > 0);
    if (!form.data || !form.paciente || !form.tipoExame || !form.medico || pagamentos.length === 0) return;

    const sanitizedPagamentos = pagamentos.map((p) => ({
      forma: p.forma || 'Cartão de Crédito',
      valor: roundCurrency(p.valor),
      parcelas: Math.max(1, Number(p.parcelas) || 1),
    }));

    const totalPag = sanitizedPagamentos.reduce((s, p) => s + p.valor, 0);
    const totalParcelas = sanitizedPagamentos.reduce((s, p) => s + p.parcelas, 0);
    const formaLabel = sanitizedPagamentos.length === 1 ? sanitizedPagamentos[0].forma : 'Misto';

    const allowsCompl = examePermiteComplementar(form.tipoExame);
    const sanitizedForm = {
      ...form,
      paciente: form.paciente.trim().toUpperCase(),
      tipoExame: form.tipoExame.trim().toUpperCase(),
      procedimentoComplementar: allowsCompl ? formatProcedimentosComplementares(form.procedimentoComplementar) : '',
      medico: form.medico.trim().toUpperCase(),
      medico2: form.medico2 ? form.medico2.trim().toUpperCase() : '',
      pagamentos: sanitizedPagamentos,
      valorPagamento: roundCurrency(totalPag),
      numParcelas: String(totalParcelas),
      formaPagamento: formaLabel,
      valorRetidoTaxas: roundCurrency(form.valorRetidoTaxas),
      notaFiscalPercentual: form.notaFiscalPercentual !== '' ? Math.round(Number(form.notaFiscalPercentual) * 10) / 10 : 15,
      valorNotaFiscal: roundCurrency(form.valorNotaFiscal),
      valorAnestesista: roundCurrency(form.valorAnestesista),
      taxaClinica: roundCurrency(form.taxaClinica),
      valorAcessorios: roundCurrency(form.valorAcessorios),
      acessorioParaMedico: Boolean(form.acessorioParaMedico),
      valorBiopsia: roundCurrency(form.valorBiopsia),
      honorariosMedicos: roundCurrency(form.honorariosMedicos),
      valorMedico1: form.valorMedico1 ? roundCurrency(form.valorMedico1) : '',
      valorMedico2: form.valorMedico2 ? roundCurrency(form.valorMedico2) : '',
      porcentagemMedico1: form.porcentagemMedico1 !== '' ? Math.round(Number(form.porcentagemMedico1) * 10) / 10 : 50,
      porcentagemMedico2: form.porcentagemMedico2 !== '' ? Math.round(Number(form.porcentagemMedico2) * 10) / 10 : 50,
    };

    let savedItem;
    if (editItem && editItem.id) {
      savedItem = updateItem('detalhesExames', editItem.id, sanitizedForm);
    } else {
      const newItem = prefillData?.id ? { ...sanitizedForm, id: prefillData.id } : sanitizedForm;
      savedItem = addItem('detalhesExames', newItem);
    }

    if (savedItem) {
      syncFluxoCaixaEntries(savedItem);

      const examesList = getData('exames') || [];
      const matchingExames = examesList.filter(
        (e) =>
          e.id === savedItem.id ||
          (e.data === savedItem.data &&
            e.paciente &&
            e.paciente.trim().toUpperCase() === savedItem.paciente.trim().toUpperCase())
      );
      if (matchingExames.length > 0) {
        matchingExames.forEach((ex) => {
          updateItem('exames', ex.id, {
            data: savedItem.data,
            paciente: savedItem.paciente,
            medico: savedItem.medico,
            exame: savedItem.tipoExame,
            procedimentoComplementar: savedItem.procedimentoComplementar || '',
          });
        });
      }
    }

    toast.success(editItem ? 'Detalhes do exame atualizados com sucesso!' : 'Detalhes do exame cadastrados com sucesso!');
    if (onSuccess) onSuccess(savedItem);
    onClose();
  };

  const totalPagamentos = (form.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const totalParcelasForm = (form.pagamentos || []).reduce(
    (s, p) => s + Math.max(1, Number(p.parcelas) || 1),
    0
  );

  const formHonorarioMensal = roundCurrency(
    Number(form.honorariosMedicos || 0) / Math.max(1, totalParcelasForm)
  );

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
      const pct1 = Number(form.porcentagemMedico1 ?? 50);
      const pct2 = Number(form.porcentagemMedico2 ?? 50);
      honDoc1Total = roundCurrency((totalHonForm * pct1) / 100);
      honDoc2Total = roundCurrency((totalHonForm * pct2) / 100);
      honDoc1Mensal = roundCurrency((formHonorarioMensal * pct1) / 100);
      honDoc2Mensal = roundCurrency((formHonorarioMensal * pct2) / 100);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? 'Editar Detalhe' : 'Novo Detalhe de Exame'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            {editItem ? 'Salvar' : 'Cadastrar'}
          </button>
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
              onChange={(e) => updateField('data', e.target.value)}
              onBlur={() => markTouched('data')}
            />
            {hasError('data') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.data}
              </div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Médico Principal <span className="required">*</span></label>
            <AutoCompleteInput
              options={medicosOptions}
              className={`input-field ${hasError('medico') ? 'is-invalid' : ''}`}
              placeholder="Selecione ou digite o médico"
              value={form.medico}
              onChange={(val) => updateField('medico', val.toUpperCase())}
              onBlur={() => markTouched('medico')}
            />
            {hasError('medico') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.medico}
              </div>
            )}
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
            <div
              className="full-width"
              style={{
                padding: '0.875rem 1rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              <div className="input-group">
                <label className="input-label">Segundo Médico (Co-médico / Assistente) <span className="required">*</span></label>
                <AutoCompleteInput
                  options={medicosOptions}
                  className={`input-field ${hasError('medico2') ? 'is-invalid' : ''}`}
                  placeholder="Selecione ou digite o 2º médico"
                  value={form.medico2}
                  onChange={(val) => updateField('medico2', val.toUpperCase())}
                  onBlur={() => markTouched('medico2')}
                />
                {hasError('medico2') && (
                  <div className="input-feedback-error">
                    <span>⚠</span> {validationErrors.medico2}
                  </div>
                )}
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
                <>
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
                  {hasError('divisao') ? (
                    <div className="input-feedback-error" style={{ marginTop: '-0.25rem' }}>
                      <span>⚠</span> {validationErrors.divisao}
                    </div>
                  ) : (
                    form.porcentagemMedico1 !== '' && form.porcentagemMedico2 !== '' && (
                      <div className="input-feedback-success" style={{ marginTop: '-0.25rem' }}>
                        <span>✓</span> Divisão equilibrada (100%)
                      </div>
                    )
                  )}
                </>
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
            <input
              type="text"
              className={`input-field ${hasError('paciente') ? 'is-invalid' : ''}`}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Nome do paciente"
              value={form.paciente}
              onChange={(e) => updateField('paciente', e.target.value.toUpperCase())}
              onBlur={() => markTouched('paciente')}
            />
            {hasError('paciente') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.paciente}
              </div>
            )}
          </div>

          <div className="input-group full-width">
            <label className="input-label">Tipo de Exame <span className="required">*</span></label>
            <AutoCompleteInput
              options={examesOptions}
              className={`input-field ${hasError('tipoExame') ? 'is-invalid' : ''}`}
              placeholder="Selecione ou digite o tipo de exame"
              value={form.tipoExame}
              onChange={(val) => {
                const upper = val.toUpperCase();
                setForm((f) => ({
                  ...f,
                  tipoExame: upper,
                  procedimentoComplementar: examePermiteComplementar(upper) ? f.procedimentoComplementar : '',
                }));
              }}
              onBlur={() => markTouched('tipoExame')}
            />
            {hasError('tipoExame') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.tipoExame}
              </div>
            )}
          </div>

          {examePermiteComplementar(form.tipoExame) && (
            <div className="input-group full-width" style={{ marginTop: '-0.25rem' }}>
              <label className="input-label">Procedimentos Complementares</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                {PROCEDIMENTOS_COMPLEMENTARES.map((proc) => {
                  const currentList = normalizeProcedimentosComplementares(form.procedimentoComplementar);
                  const isChecked = currentList.includes(proc);
                  return (
                    <label
                      key={proc}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          let updatedList;
                          if (e.target.checked) {
                            updatedList = [...currentList, proc];
                          } else {
                            updatedList = currentList.filter((p) => p !== proc);
                          }
                          updateField('procedimentoComplementar', formatProcedimentosComplementares(updatedList));
                        }}
                      />
                      <span>{proc}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

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

            {hasError('pagamentos') && (
              <div className="input-feedback-error" style={{ marginBottom: '0.75rem' }}>
                <span>⚠</span> {validationErrors.pagamentos}
              </div>
            )}

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
                      className={`input-field ${submitted && (!pag.valor || Number(pag.valor) <= 0) ? 'is-invalid' : ''}`}
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={pag.valor}
                      onChange={(e) => updatePagamento(idx, 'valor', e.target.value)}
                    />
                    {submitted && (!pag.valor || Number(pag.valor) <= 0) && (
                      <div className="input-feedback-error">
                        <span>⚠</span> Valor maior que R$ 0,00 obrigatório
                      </div>
                    )}
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

          {/* === DEDUÇÕES / TAXAS === */}
          <div className="input-group">
            <label className="input-label">Valor Retido em Taxas (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valorRetidoTaxas}
              onChange={(e) => updateField('valorRetidoTaxas', e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Valor Nota Fiscal (R$)</span>
              {totalPagamentos > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                  {form.notaFiscalPercentual || 0}% de {formatCurrency(totalPagamentos)}
                </span>
              )}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', width: '68px', flexShrink: 0 }}>
                <input
                  type="number"
                  className="input-field"
                  min="0"
                  max="100"
                  step="0.5"
                  style={{ width: '100%', textAlign: 'center', padding: '0.45rem 0.2rem' }}
                  value={form.notaFiscalPercentual}
                  onChange={(e) => updateField('notaFiscalPercentual', e.target.value)}
                  title="Porcentagem da Nota Fiscal"
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
              </div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>=</span>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                style={{ flex: 1, minWidth: 0 }}
                value={form.valorNotaFiscal}
                onChange={(e) => updateField('valorNotaFiscal', e.target.value)}
              />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Valor Anestesista (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valorAnestesista}
              onChange={(e) => updateField('valorAnestesista', e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Taxa de Clínica (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.taxaClinica}
              onChange={(e) => updateField('taxaClinica', e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Valor de Acessórios (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valorAcessorios}
              onChange={(e) => updateField('valorAcessorios', e.target.value)}
            />
            {Number(form.valorAcessorios) > 0 && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: 'var(--text-xs)', marginTop: '0.4rem', color: form.acessorioParaMedico ? 'var(--color-emerald)' : 'var(--text-muted)', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={form.acessorioParaMedico}
                  onChange={(e) => updateField('acessorioParaMedico', e.target.checked)}
                />
                <span>👨‍⚕️ Adicionar ao honorário do médico realizante (ao invés do caixa da clínica)</span>
              </label>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Valor de Biópsia (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valorBiopsia}
              onChange={(e) => updateField('valorBiopsia', e.target.value)}
            />
          </div>
          <div className="input-group full-width">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label">Honorários Médicos — Total (R$)</label>
            </div>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.honorariosMedicos}
              onChange={(e) => updateField('honorariosMedicos', e.target.value)}
            />
          </div>
        </div>

        {/* Preview de parcelas e honorário mensal */}
        {totalParcelasForm >= 1 && Number(form.honorariosMedicos) > 0 && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'oklch(70% 0.18 250 / 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid oklch(70% 0.18 250 / 0.15)',
            }}
          >
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
            {form.data &&
              (form.pagamentos || []).map((pag, idx) => {
                const n = Math.max(1, Number(pag.parcelas) || 1);
                const label = getInstallmentLabel(form.data, [pag]);
                return (
                  <div key={idx} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {pag.forma}: {n}x — {label}
                  </div>
                );
              })}
            {form.temDivisao && form.medico2 && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'oklch(70% 0.18 250 / 0.12)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid oklch(70% 0.18 250 / 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
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
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: 'oklch(72% 0.19 160 / 0.08)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-emerald)',
              }}
            >
              💡 A taxa de clínica ({formatCurrency(form.taxaClinica)}) entra integralmente no período em que o exame foi realizado.
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
