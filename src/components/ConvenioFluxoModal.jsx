import { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import {
  formatDate,
  getTodayISO,
  formatCurrency,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  formatProcedimentosComplementares,
} from '../utils/helpers';
import Modal from './Modal';
import AutoCompleteInput from './AutoCompleteInput';
import { useToast } from '../contexts/ToastContext';
import { validateDate, validateRequired, validatePositiveNumber } from '../utils/validation';

export default function ConvenioFluxoModal({ isOpen, item, onClose, onSuccess }) {
  const toast = useToast();
  const {
    fluxoCaixa: fluxoList = [],
    addItem,
    updateItem,
    syncConvenioToDetalhes,
    activeMedicosOptions,
  } = useData();
  const [fluxoPeriod, setFluxoPeriod] = useState(() => getAcquisitionPeriod());
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [fluxoForm, setFluxoForm] = useState({
    data: getTodayISO(),
    nome: '',
    categoria: 'Convênios / Repasses',
    tipo: 'entrada',
    valor: '',
    valorClinica: '',
    valorMedico: '',
    percentualMedico: 60,
    temDivisaoMedico2: false,
    medico2: '',
    porcentagemMedico1: 87.5,
    porcentagemMedico2: 12.5,
  });

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validationErrors = useMemo(() => {
    const errs = {};
    const dateErr = validateDate(fluxoForm.data, 'Data do recebimento');
    if (dateErr) errs.data = dateErr;

    const valorErr = validatePositiveNumber(fluxoForm.valor, 'Valor a lançar', false);
    if (valorErr) errs.valor = valorErr;

    const nomeErr = validateRequired(fluxoForm.nome, 'Descrição do lançamento');
    if (nomeErr) errs.nome = nomeErr;

    if (fluxoForm.temDivisaoMedico2) {
      const med2Err = validateRequired(fluxoForm.medico2, 'Segundo médico');
      if (med2Err) {
        errs.medico2 = med2Err;
      } else if (item && item.medico && item.medico.trim().toUpperCase() === (fluxoForm.medico2 || '').trim().toUpperCase()) {
        errs.medico2 = 'O 2º médico deve ser diferente do médico realizante.';
      }
    }

    return errs;
  }, [fluxoForm, item]);

  const hasError = (field) => Boolean((submitted || touched[field]) && validationErrors[field]);

  const medicosOptions = activeMedicosOptions;

  useEffect(() => {
    if (!isOpen || !item) {
      setTouched({});
      setSubmitted(false);
      return;
    }

    setTouched({});
    setSubmitted(false);

    const pNome = item.paciente ? item.paciente.trim().toUpperCase() : '';
    const cNome = item.convenio ? item.convenio.trim().toUpperCase() : '';
    const eNome = item.exame ? item.exame.trim().toUpperCase() : '';
    const compl = formatProcedimentosComplementares(item.procedimentoComplementar);
    const complStr = compl ? ` + ${compl}` : '';

    const initialValorClinica =
      item.valorClinica !== undefined && item.valorClinica !== null ? String(item.valorClinica) : '';
    const initialValorMedico =
      item.valorMedico !== undefined && item.valorMedico !== null ? String(item.valorMedico) : '';
    const initialPct =
      item.percentualMedico !== undefined && item.percentualMedico !== null
        ? Number(item.percentualMedico)
        : 60;

    const initialTemDivisao2 = Boolean(item.temDivisaoMedico2 || item.medico2);
    const initialMedico2 = item.medico2 || '';
    const initialPct1 =
      item.porcentagemMedico1 !== undefined && item.porcentagemMedico1 !== null
        ? Number(item.porcentagemMedico1)
        : 87.5;
    const initialPct2 =
      item.porcentagemMedico2 !== undefined && item.porcentagemMedico2 !== null
        ? Number(item.porcentagemMedico2)
        : 12.5;

    const initialValor =
      item.fluxoValorLancado !== undefined && item.fluxoValorLancado !== null
        ? String(item.fluxoValorLancado)
        : '';
    const initialData = item.fluxoData || getTodayISO();

    let initPeriod = getAcquisitionPeriod();
    if (item.fluxoData) {
      try {
        initPeriod = getAcquisitionPeriod(new Date(item.fluxoData.replace(/-/g, '/')));
      } catch {
        // fallback
      }
    }
    setFluxoPeriod(initPeriod);

    setFluxoForm({
      data: initialData,
      nome: item.fluxoNome || `REPASSE CONVÊNIO ${cNome} — ${pNome} (${eNome}${complStr})`,
      categoria: 'Convênios / Repasses',
      tipo: 'entrada',
      valor: initialValor,
      valorClinica: initialValorClinica,
      valorMedico: initialValorMedico,
      percentualMedico: initialPct,
      temDivisaoMedico2: initialTemDivisao2,
      medico2: initialMedico2,
      porcentagemMedico1: initialPct1,
      porcentagemMedico2: initialPct2,
    });
  }, [isOpen, item]);

  // Navegação de período financeiro no modal de fluxo
  const handleNavigateFluxoPeriod = (direction) => {
    const nextPeriod = navigateAcquisitionPeriod(fluxoPeriod, direction);
    setFluxoPeriod(nextPeriod);
    const today = getTodayISO();
    if (isDateInPeriod(today, nextPeriod)) {
      setFluxoForm((prev) => ({ ...prev, data: today }));
    } else {
      setFluxoForm((prev) => ({ ...prev, data: nextPeriod.start }));
    }
  };

  const handleFluxoDateChange = (dateVal) => {
    setFluxoForm((prev) => ({ ...prev, data: dateVal }));
    if (dateVal) {
      try {
        const p = getAcquisitionPeriod(new Date(dateVal.replace(/-/g, '/')));
        if (p && p.start && p.end) {
          setFluxoPeriod(p);
        }
      } catch {
        // ignore invalid date parsing
      }
    }
  };

  // Cálculos dinâmicos de partilha (Clínica vs Médico e Divisão entre Médicos)
  const splitCalculations = useMemo(() => {
    const valClinicaNum = parseFloat(fluxoForm.valorClinica) || 0;
    const valMedicoNum = parseFloat(fluxoForm.valorMedico) || 0;
    const total = valClinicaNum + valMedicoNum;
    const pctMedicoTotal = Number(fluxoForm.percentualMedico) || 0;
    const pctClinica = Math.max(0, 100 - pctMedicoTotal);

    const totalHonorariosMedicos = (total * pctMedicoTotal) / 100;
    const direitoClinica = (total * pctClinica) / 100;

    const temDivisao2 = Boolean(fluxoForm.temDivisaoMedico2);
    const pctMed1 = temDivisao2 ? Number(fluxoForm.porcentagemMedico1) || 0 : 100;
    const pctMed2 = temDivisao2 ? Number(fluxoForm.porcentagemMedico2) || 0 : 0;

    // Fatias brutas de direito dos médicos sobre o total de honorários
    const direitoMedico1 = (totalHonorariosMedicos * pctMed1) / 100;
    const direitoMedico2 = temDivisao2 ? (totalHonorariosMedicos * pctMed2) / 100 : 0;

    // Médico 1 (Realizante) já recebeu valMedicoNum direto do convênio
    const diferencaMedico1 = direitoMedico1 - valMedicoNum;

    // Repasse total que a clínica precisará transferir
    const repasseTotalMedicos = Math.max(0, diferencaMedico1) + direitoMedico2;

    return {
      valClinicaNum,
      valMedicoNum,
      total,
      pctMedicoTotal,
      pctClinica,
      totalHonorariosMedicos,
      direitoClinica,
      temDivisao2,
      pctMed1,
      pctMed2,
      direitoMedico1,
      direitoMedico2,
      diferencaMedico1,
      repasseTotalMedicos,
    };
  }, [fluxoForm]);

  const handleSave = (e) => {
    if (e) e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.warning(firstError || 'Por favor, preencha os campos destacados em vermelho.');
      return;
    }
    if (!item) return;
    const valorLancado = Number(fluxoForm.valor);

    // Verificar se já existe lançamento vinculado a este exame
    const existingFluxo = item.fluxoCaixaId
      ? fluxoList.find((f) => f.id === item.fluxoCaixaId)
      : fluxoList.find((f) => f.convenioId === item.id);

    const fluxoEntry = {
      data: fluxoForm.data,
      nome: fluxoForm.nome.trim().toUpperCase(),
      categoria: fluxoForm.categoria || 'Convênios / Repasses',
      tipo: 'entrada',
      valor: valorLancado,
      convenioId: item.id,
    };

    let savedFluxoId = item.fluxoCaixaId;
    if (existingFluxo) {
      updateItem('fluxoCaixa', existingFluxo.id, fluxoEntry);
      savedFluxoId = existingFluxo.id;
    } else {
      const added = addItem('fluxoCaixa', fluxoEntry);
      savedFluxoId = added.id;
    }

    const updatedItem = {
      ...item,
      valorClinica: fluxoForm.valorClinica,
      valorMedico: fluxoForm.valorMedico,
      percentualMedico: fluxoForm.percentualMedico,
      temDivisaoMedico2: fluxoForm.temDivisaoMedico2,
      medico2: fluxoForm.temDivisaoMedico2 ? (fluxoForm.medico2 || '').trim().toUpperCase() : '',
      porcentagemMedico1: fluxoForm.temDivisaoMedico2 ? fluxoForm.porcentagemMedico1 : 100,
      porcentagemMedico2: fluxoForm.temDivisaoMedico2 ? fluxoForm.porcentagemMedico2 : 0,
      valorRepasseMedico1: splitCalculations.diferencaMedico1 > 0 ? splitCalculations.diferencaMedico1 : 0,
      valorRepasseMedico2: splitCalculations.direitoMedico2 > 0 ? splitCalculations.direitoMedico2 : 0,
      valorRepasse: splitCalculations.repasseTotalMedicos > 0 ? splitCalculations.repasseTotalMedicos : 0,
      fluxoLancado: true,
      fluxoCaixaId: savedFluxoId,
      fluxoValorLancado: valorLancado,
      fluxoData: fluxoForm.data,
      fluxoPeriodoLabel: fluxoPeriod.label,
      fluxoPeriodoStart: fluxoPeriod.start,
      fluxoPeriodoEnd: fluxoPeriod.end,
      fluxoNome: fluxoForm.nome.trim().toUpperCase(),
    };
    updateItem('examesConvenio', item.id, updatedItem);
    syncConvenioToDetalhes(updatedItem);

    toast.success('Partilha salva e lançada no Fluxo de Caixa!');
    if (onSuccess) onSuccess();
    onClose();
  };

  if (!isOpen || !item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Partilha & Lançamento no Fluxo de Caixa"
      maxWidth="720px"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Salvar Partilha & Lançar no Fluxo
          </button>
        </>
      }
    >
      <form onSubmit={handleSave} noValidate autoComplete="off">
        <div
          style={{
            background: 'var(--color-dark-800)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 0.9rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: 'var(--text-xs)',
            alignItems: 'center',
            marginBottom: '0.5rem',
          }}
        >
          <span>
            🏢 Convênio: <strong style={{ color: 'var(--text-primary)' }}>{item.convenio}</strong>
          </span>
          <span>
            👤 Paciente: <strong style={{ color: 'var(--text-primary)' }}>{item.paciente}</strong>
          </span>
          <span>
            👨‍⚕️ Médico: <strong style={{ color: 'var(--text-primary)' }}>{item.medico}</strong>
          </span>
          <span>
            📋 Exame: <strong style={{ color: 'var(--text-primary)' }}>{item.exame}</strong>
          </span>
        </div>

        {/* CALCULADORA DE PARTILHA */}
        <div className="split-calc-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
              }}
            >
              🧮 Calculadora de Partilha do Exame
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Preencha os valores recebidos do convênio
            </span>
          </div>

          {/* Linha com os 2 boxes: Valor Clínica e Valor Médico */}
          <div className="split-inputs-row">
            <div className="split-input-box">
              <label className="split-input-label">🏢 VALOR REC. PELA CLÍNICA (R$)</label>
              <input
                type="number"
                className="split-input-field"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={fluxoForm.valorClinica}
                onChange={(e) => {
                  const newClin = e.target.value;
                  setFluxoForm((prev) => ({ ...prev, valorClinica: newClin }));
                }}
              />
            </div>

            <div className="split-input-box">
              <label className="split-input-label">👨‍⚕️ VALOR REC. PELO MÉDICO (R$)</label>
              <input
                type="number"
                className="split-input-field"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={fluxoForm.valorMedico}
                onChange={(e) => {
                  const newMed = e.target.value;
                  setFluxoForm((prev) => ({ ...prev, valorMedico: newMed }));
                }}
              />
            </div>
          </div>

          {/* TOTAL centralizado */}
          <div className="split-total-banner">
            <span className="split-total-label">TOTAL DO EXAME (CLÍNICA + MÉDICO)</span>
            <span className="split-total-val">{formatCurrency(splitCalculations.total)}</span>
          </div>

          {/* Slider de porcentagem */}
          <div className="split-slider-section">
            <div className="split-slider-header">
              <span>
                👨‍⚕️ Médico:{' '}
                <strong style={{ color: 'var(--color-blue)', fontSize: 'var(--text-base)' }}>
                  {splitCalculations.pctMedicoTotal}%
                </strong>
              </span>
              <span>
                🏢 Clínica:{' '}
                <strong style={{ color: 'var(--color-emerald)', fontSize: 'var(--text-base)' }}>
                  {splitCalculations.pctClinica}%
                </strong>
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              className="split-range-slider"
              value={fluxoForm.percentualMedico ?? 60}
              onChange={(e) => setFluxoForm({ ...fluxoForm, percentualMedico: Number(e.target.value) })}
              style={{
                background: `linear-gradient(to right, var(--color-blue) 0%, var(--color-blue) ${Number(splitCalculations.pctMedicoTotal)}%, var(--color-emerald) ${Number(splitCalculations.pctMedicoTotal)}%, var(--color-emerald) 100%)`,
              }}
            />

            {/* Ticks do slider */}
            <div className="split-ticks-row">
              {[0, 20, 40, 50, 60, 70, 80, 100].map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`split-tick-btn ${fluxoForm.percentualMedico === t ? 'active' : ''}`}
                  onClick={() => setFluxoForm({ ...fluxoForm, percentualMedico: t })}
                >
                  {t}%
                </button>
              ))}
            </div>

            {/* Botões rápidos de preset */}
            <div className="split-presets">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Proporção rápida:</span>
              {[
                { label: '60% / 40% (Padrão)', pct: 60 },
                { label: '50% / 50%', pct: 50 },
                { label: '70% / 30%', pct: 70 },
                { label: '80% / 20%', pct: 80 },
              ].map((p) => (
                <button
                  type="button"
                  key={p.pct}
                  className={`split-preset-btn ${fluxoForm.percentualMedico === p.pct ? 'active' : ''}`}
                  onClick={() => setFluxoForm({ ...fluxoForm, percentualMedico: p.pct })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opção de Divisão com Outro Médico (Médico 2) */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={fluxoForm.temDivisaoMedico2}
                onChange={(e) => setFluxoForm({ ...fluxoForm, temDivisaoMedico2: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-emerald)', cursor: 'pointer' }}
              />
              <span>👥 Dividir honorários médicos com outro médico (Coparticipante / Auxiliar)</span>
            </label>

            {fluxoForm.temDivisaoMedico2 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px dashed var(--border-subtle)',
                }}
              >
                <div className="input-group full-width">
                  <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>
                    Médico Coparticipante / Auxiliar <span className="required">*</span>
                  </label>
                  <AutoCompleteInput
                    options={medicosOptions.filter((m) => m !== (item.medico || '').toUpperCase())}
                    className={`input-field ${hasError('medico2') ? 'is-invalid' : ''}`}
                    placeholder="Selecione ou digite o 2º médico"
                    value={fluxoForm.medico2}
                    onChange={(val) => setFluxoForm({ ...fluxoForm, medico2: val.toUpperCase() })}
                    onBlur={() => markTouched('medico2')}
                  />
                  {hasError('medico2') && (
                    <div className="input-feedback-error">
                      <span>⚠</span> {validationErrors.medico2}
                    </div>
                  )}
                </div>

                <div className="split-slider-section">
                  <div className="split-slider-header">
                    <span>
                      👨‍⚕️ {item.medico || 'Médico Realizante'}:{' '}
                      <strong style={{ color: 'var(--color-blue)', fontSize: 'var(--text-base)' }}>
                        {splitCalculations.pctMed1}%
                      </strong>
                    </span>
                    <span>
                      👨‍⚕️ {fluxoForm.medico2 || '2º Médico'}:{' '}
                      <strong style={{ color: 'var(--color-purple)', fontSize: 'var(--text-base)' }}>
                        {splitCalculations.pctMed2}%
                      </strong>
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    className="split-range-slider"
                    value={fluxoForm.porcentagemMedico1}
                    onChange={(e) => {
                      const p1 = Number(e.target.value);
                      const p2 = Math.round((100 - p1) * 10) / 10;
                      setFluxoForm({ ...fluxoForm, porcentagemMedico1: p1, porcentagemMedico2: p2 });
                    }}
                    style={{
                      background: `linear-gradient(to right, var(--color-blue) 0%, var(--color-blue) ${splitCalculations.pctMed1}%, var(--color-purple) ${splitCalculations.pctMed1}%, var(--color-purple) 100%)`,
                    }}
                  />

                  <div className="split-presets">
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Proporção médica:</span>
                    {[
                      { label: '87,5% / 12,5%', p1: 87.5, p2: 12.5 },
                      { label: '70% / 30%', p1: 70, p2: 30 },
                      { label: '50% / 50%', p1: 50, p2: 50 },
                      { label: '80% / 20%', p1: 80, p2: 20 },
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset.label}
                        className={`split-preset-btn ${fluxoForm.porcentagemMedico1 === preset.p1 ? 'active' : ''}`}
                        onClick={() =>
                          setFluxoForm({
                            ...fluxoForm,
                            porcentagemMedico1: preset.p1,
                            porcentagemMedico2: preset.p2,
                          })
                        }
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cards de Partilha Calculada */}
          {splitCalculations.temDivisao2 ? (
            <div className="split-cards-row three-cols">
              <div className="split-card-item split-card-medico">
                <div className="split-card-title">
                  <span>👨‍⚕️ {item.medico || 'Médico 1'} ({splitCalculations.pctMed1}%)</span>
                </div>
                <div className="split-card-value">{formatCurrency(splitCalculations.direitoMedico1)}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Já recebeu direto: {formatCurrency(splitCalculations.valMedicoNum)}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    marginTop: '0.2rem',
                    color: splitCalculations.diferencaMedico1 > 0 ? 'var(--color-amber)' : 'var(--color-emerald)',
                  }}
                >
                  {splitCalculations.diferencaMedico1 > 0
                    ? `A repassar: ${formatCurrency(splitCalculations.diferencaMedico1)}`
                    : 'Integralizado'}
                </div>
              </div>

              <div className="split-card-item split-card-medico2">
                <div className="split-card-title">
                  <span>👨‍⚕️ {fluxoForm.medico2 || '2º Médico'} ({splitCalculations.pctMed2}%)</span>
                </div>
                <div className="split-card-value">{formatCurrency(splitCalculations.direitoMedico2)}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Via repasse da clínica
                </div>
                <div style={{ fontSize: 'var(--text-xs)', marginTop: '0.2rem', color: 'var(--color-purple)' }}>
                  A repassar: {formatCurrency(splitCalculations.direitoMedico2)}
                </div>
              </div>

              <div className="split-card-item split-card-clinica">
                <div className="split-card-title">
                  <span>🏢 Clínica ({splitCalculations.pctClinica}%)</span>
                </div>
                <div className="split-card-value">{formatCurrency(splitCalculations.direitoClinica)}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Recebido: {formatCurrency(splitCalculations.valClinicaNum)}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', marginTop: '0.2rem', color: 'var(--color-emerald)' }}>
                  Líquido retido: {formatCurrency(splitCalculations.direitoClinica)}
                </div>
              </div>
            </div>
          ) : (
            <div className="split-cards-row">
              <div className="split-card-item split-card-medico">
                <div className="split-card-title">
                  <span>👨‍⚕️ Parte do Médico ({splitCalculations.pctMedicoTotal}%)</span>
                </div>
                <div className="split-card-value">{formatCurrency(splitCalculations.direitoMedico1)}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Recebido direto: {formatCurrency(splitCalculations.valMedicoNum)}
                </div>
              </div>

              <div className="split-card-item split-card-clinica">
                <div className="split-card-title">
                  <span>🏢 Parte da Clínica ({splitCalculations.pctClinica}%)</span>
                </div>
                <div className="split-card-value">{formatCurrency(splitCalculations.direitoClinica)}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Recebido direto: {formatCurrency(splitCalculations.valClinicaNum)}
                </div>
              </div>
            </div>
          )}

          {/* Alerta / Diagnóstico de Integralização */}
          {splitCalculations.total > 0 && (
            <>
              {splitCalculations.temDivisao2 ? (
                <div className="split-alert split-alert-warn">
                  <span style={{ fontSize: '1.2rem' }}>🤝</span>
                  <div>
                    <strong>Divisão com 2º Médico e Integralização:</strong>
                    <div style={{ marginTop: '0.25rem' }}>
                      Total de honorários médicos: <strong>{formatCurrency(splitCalculations.totalHonorariosMedicos)}</strong> ({splitCalculations.pctMedicoTotal}% do exame de {formatCurrency(splitCalculations.total)}).
                    </div>
                    <ul style={{ margin: '0.35rem 0 0.35rem 1.25rem', fontSize: 'var(--text-xs)', lineHeight: '1.5' }}>
                      <li>
                        <strong>{item.medico || 'Médico Realizante'} ({splitCalculations.pctMed1}%):</strong> fatia de {formatCurrency(splitCalculations.direitoMedico1)}. Já recebeu {formatCurrency(splitCalculations.valMedicoNum)} do convênio ➔ <strong style={{ color: 'var(--color-amber)' }}>Clínica paga {formatCurrency(Math.max(0, splitCalculations.diferencaMedico1))}</strong>.
                      </li>
                      <li>
                        <strong>{fluxoForm.medico2 || '2º Médico'} ({splitCalculations.pctMed2}%):</strong> fatia de {formatCurrency(splitCalculations.direitoMedico2)} ➔ <strong style={{ color: 'var(--color-purple)' }}>Clínica paga {formatCurrency(splitCalculations.direitoMedico2)}</strong>.
                      </li>
                    </ul>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                      👉 <strong>Total repassado aos médicos:</strong> {formatCurrency(splitCalculations.repasseTotalMedicos)} | <strong>Líquido que fica na clínica:</strong> {formatCurrency(splitCalculations.direitoClinica)} ({splitCalculations.pctClinica}%).
                    </div>
                  </div>
                </div>
              ) : splitCalculations.diferencaMedico1 > 0.009 ? (
                <div className="split-alert split-alert-warn">
                  <span style={{ fontSize: '1.2rem' }}>🤝</span>
                  <div>
                    <strong>Integralização de Honorários:</strong> A clínica recebeu{' '}
                    {formatCurrency(splitCalculations.valClinicaNum)} e o médico recebeu{' '}
                    {formatCurrency(splitCalculations.valMedicoNum)}. Para integralizar os{' '}
                    {formatCurrency(splitCalculations.direitoMedico1)} ({splitCalculations.pctMedicoTotal}%) de honorários devidos ao médico, a clínica deve pagar{' '}
                    <strong style={{ color: 'var(--color-amber)' }}>
                      {formatCurrency(splitCalculations.diferencaMedico1)}
                    </strong>{' '}
                    a ele.
                    <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                      👉 <strong>Líquido que fica na clínica:</strong>{' '}
                      {formatCurrency(splitCalculations.direitoClinica)} ({splitCalculations.pctClinica}%).
                    </div>
                  </div>
                </div>
              ) : splitCalculations.diferencaMedico1 < -0.009 ? (
                <div className="split-alert split-alert-info">
                  <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                  <div>
                    <strong>Compensação ao Médico:</strong> O médico recebeu{' '}
                    {formatCurrency(splitCalculations.valMedicoNum)} diretamente, valor superior aos{' '}
                    {formatCurrency(splitCalculations.direitoMedico1)} ({splitCalculations.pctMedicoTotal}%) devidos. A clínica tem direito à diferença de{' '}
                    <strong style={{ color: 'var(--color-blue)' }}>
                      {formatCurrency(Math.abs(splitCalculations.diferencaMedico1))}
                    </strong>.
                    <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                      👉 <strong>Líquido que fica na clínica:</strong>{' '}
                      {formatCurrency(splitCalculations.direitoClinica)} ({splitCalculations.pctClinica}%).
                    </div>
                  </div>
                </div>
              ) : (
                <div className="split-alert split-alert-success">
                  <span style={{ fontSize: '1.2rem' }}>✅</span>
                  <div>
                    <strong>Partilha Equilibrada:</strong> Os valores recebidos coincidem exatamente com a divisão acordada ({splitCalculations.pctMedicoTotal}% Médico / {splitCalculations.pctClinica}% Clínica).
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* DADOS PARA LANÇAMENTO NO FLUXO DE CAIXA */}
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            💵 Lançar Entrada no Fluxo de Caixa
          </div>

          {/* SELETOR DE PERÍODO / COMPETÊNCIA FINANCEIRA */}
          <div
            style={{
              background: 'var(--color-dark-850)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-emerald)',
                  }}
                >
                  📅 Período de Entrada / Competência Financeira
                </span>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Defina em qual período financeiro este valor deve entrar no Fluxo de Caixa:
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {item.data && (
                  <button
                    type="button"
                    className="split-quick-btn"
                    title="Definir para o período em que o exame foi realizado meses atrás"
                    onClick={() => {
                      try {
                        const p = getAcquisitionPeriod(new Date(item.data.replace(/-/g, '/')));
                        setFluxoPeriod(p);
                        setFluxoForm((prev) => ({ ...prev, data: item.data }));
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Mês do Exame ({formatDate(item.data)})
                  </button>
                )}
                <button
                  type="button"
                  className="split-quick-btn highlight"
                  title="Definir para o período financeiro atual"
                  onClick={() => {
                    const p = getAcquisitionPeriod();
                    setFluxoPeriod(p);
                    setFluxoForm((prev) => ({ ...prev, data: getTodayISO() }));
                  }}
                >
                  ⚡ Período Atual
                </button>
              </div>
            </div>

            {/* Botões de navegação de período ◀ [Label] ▶ */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0.2rem' }}>
              <div
                className="period-selector"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-strong)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <button
                  type="button"
                  className="period-btn"
                  onClick={() => handleNavigateFluxoPeriod(-1)}
                  title="Período anterior"
                  style={{ fontSize: '1rem', padding: '0.2rem 0.5rem' }}
                >
                  ◀
                </button>
                <span
                  className="period-label"
                  style={{
                    fontWeight: 700,
                    color: 'var(--color-emerald)',
                    fontSize: 'var(--text-sm)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {fluxoPeriod.label}
                </span>
                <button
                  type="button"
                  className="period-btn"
                  onClick={() => handleNavigateFluxoPeriod(1)}
                  title="Próximo período"
                  style={{ fontSize: '1rem', padding: '0.2rem 0.5rem' }}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">
                Data Específica do Recebimento <span className="required">*</span>
              </label>
              <input
                type="date"
                className={`input-field ${hasError('data') ? 'is-invalid' : ''}`}
                required
                value={fluxoForm.data}
                onChange={(e) => handleFluxoDateChange(e.target.value)}
                onBlur={() => markTouched('data')}
              />
              {hasError('data') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.data}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">
                Valor a Lançar (R$) <span className="required">*</span>{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  (Edição manual livre)
                </span>
              </label>
              <input
                type="number"
                className={`input-field ${hasError('valor') ? 'is-invalid' : ''}`}
                required
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={fluxoForm.valor}
                onChange={(e) => setFluxoForm({ ...fluxoForm, valor: e.target.value })}
                onBlur={() => markTouched('valor')}
              />
              {hasError('valor') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.valor}
                </div>
              )}
              {splitCalculations.total > 0 && (
                <div className="split-quick-fills">
                  <button
                    type="button"
                    className="split-quick-btn highlight"
                    title="Preenche com o valor líquido que fica com a clínica após descontar o repasse do médico"
                    onClick={() =>
                      setFluxoForm({
                        ...fluxoForm,
                        valor:
                          splitCalculations.direitoClinica > 0
                            ? splitCalculations.direitoClinica.toFixed(2)
                            : '0.00',
                      })
                    }
                  >
                    ⚡ Usar Líquido ({formatCurrency(splitCalculations.direitoClinica)})
                  </button>
                  <button
                    type="button"
                    className="split-quick-btn"
                    title="Preenche com o valor bruto total recebido pela clínica"
                    onClick={() =>
                      setFluxoForm({
                        ...fluxoForm,
                        valor:
                          splitCalculations.valClinicaNum > 0
                            ? splitCalculations.valClinicaNum.toFixed(2)
                            : '0.00',
                      })
                    }
                  >
                    ⚡ Usar Bruto Clínica ({formatCurrency(splitCalculations.valClinicaNum)})
                  </button>
                </div>
              )}
            </div>

            <div className="input-group full-width">
              <label className="input-label">
                Descrição no Fluxo de Caixa <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`input-field ${hasError('nome') ? 'is-invalid' : ''}`}
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={fluxoForm.nome}
                onChange={(e) => setFluxoForm({ ...fluxoForm, nome: e.target.value.toUpperCase() })}
                onBlur={() => markTouched('nome')}
              />
              {hasError('nome') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.nome}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Categoria</label>
              <input type="text" className="input-field" readOnly value={fluxoForm.categoria} />
            </div>

            <div className="input-group">
              <label className="input-label">Tipo</label>
              <input type="text" className="input-field" readOnly value="Entrada" />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
