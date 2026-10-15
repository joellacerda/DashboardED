import { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import {
  formatDate,
  getTodayISO,
  formatCurrency,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
} from '../utils/helpers';
import Modal from './Modal';
import AutoCompleteInput from './AutoCompleteInput';
import { useToast } from '../contexts/ToastContext';
import { validateDate, validateRequired, validatePositiveNumber } from '../utils/validation';
import { MODULES, getConvenioFluxoDestino } from '../utils/storage';

export default function ConvenioFluxoModal({ isOpen, item, onClose, onSuccess }) {
  const toast = useToast();
  const {
    fluxoCaixa: fluxoList = [],
    updateItem,
    syncConvenioToDetalhes,
    syncConveniosFluxoConsolidado,
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
    modoPartilha: 'simples',
    valorTaxaSala: '',
    valorHonorariosBase: '',
    valorPolipectomia: '',
    valorAcessorio: '',
    pctPolipectomiaClinica: 50,
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
  const destinoFluxo = useMemo(() => getConvenioFluxoDestino(item?.convenio), [item?.convenio]);

  const currentConsolidatedEntry = useMemo(() => {
    if (!destinoFluxo.key || !fluxoPeriod.start) return null;
    return fluxoList.find(
      (f) =>
        (f.isConvenioConsolidado || (f.nome && f.nome.toUpperCase() === destinoFluxo.key)) &&
        (f.periodoStart === fluxoPeriod.start || isDateInPeriod(f.data, fluxoPeriod))
    );
  }, [destinoFluxo.key, fluxoPeriod, fluxoList]);

  const currentConsolidatedValor = currentConsolidatedEntry ? Number(currentConsolidatedEntry.valor || 0) : 0;

  useEffect(() => {
    if (!isOpen || !item) {
      setTouched({});
      setSubmitted(false);
      return;
    }

    setTouched({});
    setSubmitted(false);

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
        : initialValorClinica;
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

    const hasPolipectomiaOrCompl = Boolean(
      item.modoPartilha === 'polipectomia' ||
      item.valorPolipectomia ||
      item.valorAcessorio ||
      item.valorTaxaSala ||
      item.valorHonorariosBase ||
      (item.procedimentoComplementar && /polipectomia|mucosectomia/i.test(item.procedimentoComplementar))
    );

    const initialModo = item.modoPartilha || (hasPolipectomiaOrCompl ? 'polipectomia' : 'simples');
    const initialTaxaSala = item.valorTaxaSala !== undefined && item.valorTaxaSala !== null
      ? String(item.valorTaxaSala)
      : (initialModo === 'polipectomia' ? initialValorClinica : '');
    const initialHonorariosBase = item.valorHonorariosBase !== undefined && item.valorHonorariosBase !== null
      ? String(item.valorHonorariosBase)
      : '';
    const initialValorPolipectomia = item.valorPolipectomia !== undefined && item.valorPolipectomia !== null
      ? String(item.valorPolipectomia)
      : '';
    const initialValorAcessorio = item.valorAcessorio !== undefined && item.valorAcessorio !== null
      ? String(item.valorAcessorio)
      : '';
    const initialPctPolip = item.pctPolipectomiaClinica !== undefined && item.pctPolipectomiaClinica !== null
      ? Number(item.pctPolipectomiaClinica)
      : 50;

    setFluxoForm({
      data: initialData,
      nome: destinoFluxo.display || 'Coopend',
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
      modoPartilha: initialModo,
      valorTaxaSala: initialTaxaSala,
      valorHonorariosBase: initialHonorariosBase,
      valorPolipectomia: initialValorPolipectomia,
      valorAcessorio: initialValorAcessorio,
      pctPolipectomiaClinica: initialPctPolip,
    });
  }, [isOpen, item, destinoFluxo.display]);

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
    const isPolipectomiaMode = fluxoForm.modoPartilha === 'polipectomia';

    let valClinicaNum = 0;
    let valMedicoNum = 0;
    let total = 0;
    let direitoClinica = 0;
    let totalHonorariosMedicos = 0;
    let pctMedicoTotal = 0;
    let pctClinica = 0;

    // Valores específicos do modo Polipectomia & Acessório
    const taxaSalaNum = parseFloat(fluxoForm.valorTaxaSala) || 0;
    const honorariosBaseNum = parseFloat(fluxoForm.valorHonorariosBase) || 0;
    const polipectomiaNum = parseFloat(fluxoForm.valorPolipectomia) || 0;
    const acessorioNum = parseFloat(fluxoForm.valorAcessorio) || 0;
    const pctPolipClinica = Number(fluxoForm.pctPolipectomiaClinica ?? 50);
    const pctPolipMedico = Math.max(0, 100 - pctPolipClinica);

    const partePolipClinica = (polipectomiaNum * pctPolipClinica) / 100;
    const partePolipMedico = (polipectomiaNum * pctPolipMedico) / 100;
    const parteAcessorioClinica = acessorioNum; // 100% da clínica (ela compra o material)

    if (isPolipectomiaMode) {
      total = taxaSalaNum + honorariosBaseNum + polipectomiaNum + acessorioNum;
      // Conforme o convênio repassa:
      // Clínica recebe apenas a taxa de sala
      valClinicaNum = taxaSalaNum;
      // Médico recebe honorários + polipectomia + acessório
      valMedicoNum = honorariosBaseNum + polipectomiaNum + acessorioNum;

      // Direitos Reais:
      // Clínica: Taxa de sala (100%) + metade da polipectomia (50%) + acessório integral (100%)
      direitoClinica = taxaSalaNum + partePolipClinica + parteAcessorioClinica;
      // Médico: Honorários (100%) + metade da polipectomia (50%)
      totalHonorariosMedicos = honorariosBaseNum + partePolipMedico;

      pctMedicoTotal = total > 0 ? Math.round((totalHonorariosMedicos / total) * 100) : 0;
      pctClinica = total > 0 ? 100 - pctMedicoTotal : 0;
    } else {
      valClinicaNum = parseFloat(fluxoForm.valorClinica) || 0;
      valMedicoNum = parseFloat(fluxoForm.valorMedico) || 0;
      total = valClinicaNum + valMedicoNum;
      pctMedicoTotal = Number(fluxoForm.percentualMedico) || 0;
      pctClinica = Math.max(0, 100 - pctMedicoTotal);
      totalHonorariosMedicos = (total * pctMedicoTotal) / 100;
      direitoClinica = (total * pctClinica) / 100;
    }

    const temDivisao2 = Boolean(fluxoForm.temDivisaoMedico2);
    const pctMed1 = temDivisao2 ? Number(fluxoForm.porcentagemMedico1) || 0 : 100;
    const pctMed2 = temDivisao2 ? Number(fluxoForm.porcentagemMedico2) || 0 : 0;

    const direitoMedico1 = (totalHonorariosMedicos * pctMed1) / 100;
    const direitoMedico2 = temDivisao2 ? (totalHonorariosMedicos * pctMed2) / 100 : 0;

    // Diferença em relação ao que o médico realizante recebeu via convênio:
    // Se o médico recebeu valMedicoNum e tem direito a direitoMedico1:
    // diferencaMedico1 > 0 => clínica deve repassar a ele
    // diferencaMedico1 < 0 => médico recebeu a mais e deve devolver/compensar à clínica
    const diferencaMedico1 = direitoMedico1 - valMedicoNum;
    const valorDevolverClinica = diferencaMedico1 < 0 ? Math.abs(diferencaMedico1) : 0;

    // Repasse da clínica para os médicos (apenas se a clínica dever algo):
    const repasseTotalMedicos = Math.max(0, diferencaMedico1) + direitoMedico2;

    return {
      isPolipectomiaMode,
      taxaSalaNum,
      honorariosBaseNum,
      polipectomiaNum,
      acessorioNum,
      pctPolipClinica,
      pctPolipMedico,
      partePolipClinica,
      partePolipMedico,
      parteAcessorioClinica,
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
      valorDevolverClinica,
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
    const displayNome = destinoFluxo.display || 'Coopend';

    const updatedItem = {
      ...item,
      valorClinica: splitCalculations.valClinicaNum,
      valorMedico: splitCalculations.valMedicoNum,
      percentualMedico: splitCalculations.pctMedicoTotal,
      modoPartilha: fluxoForm.modoPartilha,
      valorTaxaSala: fluxoForm.valorTaxaSala,
      valorHonorariosBase: fluxoForm.valorHonorariosBase,
      valorPolipectomia: fluxoForm.valorPolipectomia,
      valorAcessorio: fluxoForm.valorAcessorio,
      pctPolipectomiaClinica: fluxoForm.pctPolipectomiaClinica,
      valorCompensacaoClinica: splitCalculations.valorDevolverClinica,
      direitoClinica: splitCalculations.direitoClinica,
      direitoMedico: splitCalculations.totalHonorariosMedicos,
      temDivisaoMedico2: fluxoForm.temDivisaoMedico2,
      medico2: fluxoForm.temDivisaoMedico2 ? (fluxoForm.medico2 || '').trim().toUpperCase() : '',
      porcentagemMedico1: fluxoForm.temDivisaoMedico2 ? fluxoForm.porcentagemMedico1 : 100,
      porcentagemMedico2: fluxoForm.temDivisaoMedico2 ? fluxoForm.porcentagemMedico2 : 0,
      valorRepasseMedico1: splitCalculations.diferencaMedico1 > 0 ? splitCalculations.diferencaMedico1 : 0,
      valorRepasseMedico2: splitCalculations.direitoMedico2 > 0 ? splitCalculations.direitoMedico2 : 0,
      valorRepasse: splitCalculations.repasseTotalMedicos > 0 ? splitCalculations.repasseTotalMedicos : 0,
      fluxoLancado: true,
      fluxoValorLancado: valorLancado,
      fluxoData: fluxoForm.data,
      fluxoPeriodoLabel: fluxoPeriod.label,
      fluxoPeriodoStart: fluxoPeriod.start,
      fluxoPeriodoEnd: fluxoPeriod.end,
      fluxoNome: displayNome,
    };
    updateItem(MODULES.examesConvenio, item.id, updatedItem);
    syncConvenioToDetalhes(updatedItem);
    syncConveniosFluxoConsolidado();

    toast.success(`Partilha salva! Valor consolidado em "${displayNome}" no Fluxo de Caixa.`);
    if (onSuccess) onSuccess();
    onClose();
  };

  const handleDesvincularFluxo = () => {
    const updatedItem = {
      ...item,
      fluxoLancado: false,
      fluxoValorLancado: 0,
    };
    updateItem(MODULES.examesConvenio, item.id, updatedItem);
    syncConvenioToDetalhes(updatedItem);
    syncConveniosFluxoConsolidado();
    toast.success('Lançamento desvinculado do Fluxo de Caixa.');
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
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div>
            {item.fluxoLancado && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--color-rose)' }}
                onClick={handleDesvincularFluxo}
                title="Desvincular este exame do fluxo de caixa consolidado"
              >
                Desvincular do Caixa
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Salvar Partilha & Consolidar no Fluxo
            </button>
          </div>
        </div>
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

          {/* Alternador de Modo de Partilha */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-dark-850)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', marginBottom: '0.25rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${fluxoForm.modoPartilha !== 'polipectomia' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: 'var(--text-xs)', fontWeight: 600 }}
              onClick={() => setFluxoForm((prev) => ({ ...prev, modoPartilha: 'simples' }))}
            >
              📊 Partilha Geral (por %)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${fluxoForm.modoPartilha === 'polipectomia' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: 'var(--text-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              onClick={() => setFluxoForm((prev) => ({ ...prev, modoPartilha: 'polipectomia' }))}
            >
              <span>✂️ Polipectomia & Acessório (Alça)</span>
              {item.procedimentoComplementar && /polipectomia|mucosectomia/i.test(item.procedimentoComplementar) && (
                <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 6px' }}>Detectado</span>
              )}
            </button>
          </div>

          {fluxoForm.modoPartilha === 'polipectomia' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', lineHeight: '1.4' }}>
                💡 <strong>Regra de Partilha:</strong> O convênio paga a taxa de sala para a clínica e repassa honorários + polipectomia + acessório ao médico. O sistema divide a polipectomia em <strong>50% / 50%</strong> e destina <strong>100% do acessório (alça)</strong> à clínica pela compra do material.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="split-input-box">
                  <label className="split-input-label">🏢 TAXA DE SALA (CLÍNICA)</label>
                  <input
                    type="number"
                    className="split-input-field"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={fluxoForm.valorTaxaSala}
                    onChange={(e) => setFluxoForm({ ...fluxoForm, valorTaxaSala: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>100% Clínica (pago pelo convênio à clínica)</span>
                </div>

                <div className="split-input-box">
                  <label className="split-input-label">👨‍⚕️ HONORÁRIOS EXAME BASE</label>
                  <input
                    type="number"
                    className="split-input-field"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={fluxoForm.valorHonorariosBase}
                    onChange={(e) => setFluxoForm({ ...fluxoForm, valorHonorariosBase: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>100% Médico (pago pelo convênio ao médico)</span>
                </div>

                <div className="split-input-box" style={{ borderColor: 'rgba(59, 130, 246, 0.45)' }}>
                  <label className="split-input-label" style={{ color: 'var(--color-blue)' }}>✂️ VALOR DA POLIPECTOMIA</label>
                  <input
                    type="number"
                    className="split-input-field"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={fluxoForm.valorPolipectomia}
                    onChange={(e) => setFluxoForm({ ...fluxoForm, valorPolipectomia: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-blue)' }}>Dividido 50% Clínica / 50% Médico</span>
                </div>

                <div className="split-input-box" style={{ borderColor: 'rgba(16, 185, 129, 0.45)' }}>
                  <label className="split-input-label" style={{ color: 'var(--color-emerald)' }}>🩹 ACESSÓRIO / ALÇA</label>
                  <input
                    type="number"
                    className="split-input-field"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={fluxoForm.valorAcessorio}
                    onChange={(e) => setFluxoForm({ ...fluxoForm, valorAcessorio: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-emerald)' }}>100% Clínica (compra de material)</span>
                </div>
              </div>

              {/* TOTAL centralizado */}
              <div className="split-total-banner">
                <span className="split-total-label">TOTAL DO EXAME (CLÍNICA + MÉDICO)</span>
                <span className="split-total-val">{formatCurrency(splitCalculations.total)}</span>
              </div>
            </div>
          ) : (
            <>
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
                      setFluxoForm((prev) => ({
                        ...prev,
                        valorClinica: newClin,
                        valor: (!prev.valor || prev.valor === prev.valorClinica) ? newClin : prev.valor,
                      }));
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
            </>
          )}

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
                      const p2 = Math.round((100 - p1) * 100) / 100;
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
                  {splitCalculations.isPolipectomiaMode
                    ? `Honorários: ${formatCurrency(splitCalculations.honorariosBaseNum)} + 50% Polip: ${formatCurrency(splitCalculations.partePolipMedico)}`
                    : `Recebido direto: ${formatCurrency(splitCalculations.valMedicoNum)}`}
                </div>
                {splitCalculations.isPolipectomiaMode && splitCalculations.valorDevolverClinica > 0 && (
                  <div style={{ fontSize: 'var(--text-xs)', marginTop: '0.2rem', color: 'var(--color-amber)' }}>
                    Recebeu do convênio: {formatCurrency(splitCalculations.valMedicoNum)} ({formatCurrency(splitCalculations.valorDevolverClinica)} a compensar)
                  </div>
                )}
              </div>

              <div className="split-card-item split-card-clinica">
                <div className="split-card-title">
                  <span>🏢 Parte da Clínica ({splitCalculations.pctClinica}%)</span>
                </div>
                <div className="split-card-value">{formatCurrency(splitCalculations.direitoClinica)}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {splitCalculations.isPolipectomiaMode
                    ? `Taxa: ${formatCurrency(splitCalculations.taxaSalaNum)} + 50% Polip: ${formatCurrency(splitCalculations.partePolipClinica)} + Alça: ${formatCurrency(splitCalculations.parteAcessorioClinica)}`
                    : `Recebido direto: ${formatCurrency(splitCalculations.valClinicaNum)}`}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', marginTop: '0.2rem', color: 'var(--color-emerald)' }}>
                  Líquido retido: {formatCurrency(splitCalculations.direitoClinica)}
                </div>
              </div>
            </div>
          )}

          {/* Alerta / Diagnóstico de Integralização */}
          {splitCalculations.total > 0 && (
            <>
              {splitCalculations.isPolipectomiaMode ? (
                <div className="split-alert split-alert-warn" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <span style={{ fontSize: '1.25rem' }}>✂️</span>
                  <div>
                    <strong>Partilha de Procedimento & Material (Polipectomia / Alça):</strong>
                    <div style={{ marginTop: '0.25rem', fontSize: 'var(--text-xs)', lineHeight: '1.5' }}>
                      O convênio pagou ao médico: Honorários ({formatCurrency(splitCalculations.honorariosBaseNum)}) + Polipectomia ({formatCurrency(splitCalculations.polipectomiaNum)}) + Acessório ({formatCurrency(splitCalculations.acessorioNum)}) = <strong>{formatCurrency(splitCalculations.valMedicoNum)}</strong>.
                    </div>
                    <div style={{ marginTop: '0.25rem', fontSize: 'var(--text-xs)', lineHeight: '1.5' }}>
                      À clínica pagou a Taxa de Sala: <strong>{formatCurrency(splitCalculations.taxaSalaNum)}</strong>.
                    </div>
                    {splitCalculations.valorDevolverClinica > 0.009 ? (
                      <div style={{ marginTop: '0.4rem', padding: '0.45rem 0.65rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', fontSize: 'var(--text-xs)' }}>
                        👉 <strong>Compensação Devida pelo Médico à Clínica:</strong> Como a clínica tem direito a <strong>50% da polipectomia ({formatCurrency(splitCalculations.partePolipClinica)})</strong> e <strong>100% do acessório ({formatCurrency(splitCalculations.parteAcessorioClinica)})</strong> pela compra do material descartável, o médico deve transferir <strong style={{ color: 'var(--color-emerald)', fontSize: 'var(--text-sm)' }}>{formatCurrency(splitCalculations.valorDevolverClinica)}</strong> à clínica (ou abater de repasses a pagar a ele).
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.3rem', fontSize: 'var(--text-xs)', color: 'var(--color-emerald)' }}>
                        ✅ Partilha alinhada com as retenções de material e procedimento.
                      </div>
                    )}
                    <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                      🏢 <strong>Direito Final da Clínica:</strong> {formatCurrency(splitCalculations.direitoClinica)} | 👨‍⚕️ <strong>Direito Final do Médico:</strong> {formatCurrency(splitCalculations.totalHonorariosMedicos)}
                    </div>
                  </div>
                </div>
              ) : splitCalculations.temDivisao2 ? (
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
                    title={
                      splitCalculations.isPolipectomiaMode
                        ? 'Preenche com o Direito da Clínica (Taxa de sala + 50% polipectomia + 100% alça)'
                        : 'Preenche com o valor líquido que fica com a clínica após descontar o repasse do médico'
                    }
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
                    {splitCalculations.isPolipectomiaMode
                      ? `⚡ Usar Direito da Clínica (${formatCurrency(splitCalculations.direitoClinica)})`
                      : `⚡ Usar Líquido (${formatCurrency(splitCalculations.direitoClinica)})`}
                  </button>
                  <button
                    type="button"
                    className="split-quick-btn"
                    title={
                      splitCalculations.isPolipectomiaMode
                        ? 'Preenche com o que o convênio pagou diretamente à clínica (Taxa de sala)'
                        : 'Preenche com o valor bruto total recebido pela clínica'
                    }
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
                    {splitCalculations.isPolipectomiaMode
                      ? `⚡ Usar Recebido do Convênio (${formatCurrency(splitCalculations.valClinicaNum)})`
                      : `⚡ Usar Bruto Clínica (${formatCurrency(splitCalculations.valClinicaNum)})`}
                  </button>
                </div>
              )}
            </div>

            <div className="input-group full-width">
              <label className="input-label">Entrada no Fluxo de Caixa (Consolidada)</label>
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🏢</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                      Consolidação no Fluxo:{' '}
                      <strong style={{ color: 'var(--color-emerald)', fontSize: 'var(--text-base)' }}>
                        {destinoFluxo.display}
                      </strong>
                    </span>
                  </div>
                  <span className="badge badge-success" style={{ textTransform: 'none' }}>
                    Entrada Única
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {!destinoFluxo.isUnimed && item?.convenio && item.convenio.trim().toUpperCase() !== 'COOPEND' ? (
                    <>
                      Este exame do convênio <strong>{item.convenio}</strong> entra no repasse consolidado da{' '}
                      <strong>"Coopend"</strong> (cooperativa que repassa todos os convênios exceto Unimed) no período{' '}
                      <strong>{fluxoPeriod.label}</strong>.
                    </>
                  ) : (
                    <>
                      No Fluxo de Caixa, este valor é somado à entrada única de{' '}
                      <strong>"{destinoFluxo.display}"</strong> do período <strong>{fluxoPeriod.label}</strong>. Não serão criadas entradas duplicadas.
                    </>
                  )}
                </div>
                {currentConsolidatedValor > 0 && (
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      borderTop: '1px dashed var(--border-subtle)',
                      paddingTop: '0.4rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      Total já acumulado de {destinoFluxo.display}: <strong>{formatCurrency(currentConsolidatedValor)}</strong>
                    </span>
                    {Number(fluxoForm.valor) > 0 && (
                      <span>
                        ➔ Novo total consolidado:{' '}
                        <strong style={{ color: 'var(--color-emerald)' }}>
                          {formatCurrency(
                            currentConsolidatedValor - (Number(item?.fluxoValorLancado) || 0) + Number(fluxoForm.valor)
                          )}
                        </strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
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
