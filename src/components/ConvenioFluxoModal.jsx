import Modal from './Modal';
import { useConvenioFluxoForm } from './convenioModal/useConvenioFluxoForm';
import PartilhaInputsSection from './convenioModal/PartilhaInputsSection';
import DivisaoMedico2Section from './convenioModal/DivisaoMedico2Section';
import PartilhaCardsAndAlerts from './convenioModal/PartilhaCardsAndAlerts';
import FluxoCaixaLancamentoSection from './convenioModal/FluxoCaixaLancamentoSection';

export default function ConvenioFluxoModal({ isOpen, item, onClose, onSuccess }) {
  const {
    fluxoPeriod,
    setFluxoPeriod,
    handleNavigateFluxoPeriod,
    handleFluxoDateChange,
    fluxoForm,
    setFluxoForm,
    markTouched,
    validationErrors,
    hasError,
    medicosOptions,
    destinoFluxo,
    currentConsolidatedValor,
    splitCalculations,
    handleSave,
    handleDesvincularFluxo,
  } = useConvenioFluxoForm({ isOpen, item, onClose, onSuccess });

  if (!isOpen || !item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Partilha & Lançamento no Fluxo de Caixa"
      maxWidth="720px"
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            alignItems: 'center',
          }}
        >
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

          <PartilhaInputsSection
            fluxoForm={fluxoForm}
            setFluxoForm={setFluxoForm}
            splitCalculations={splitCalculations}
            item={item}
          />

          <DivisaoMedico2Section
            fluxoForm={fluxoForm}
            setFluxoForm={setFluxoForm}
            item={item}
            medicosOptions={medicosOptions}
            hasError={hasError}
            markTouched={markTouched}
            validationErrors={validationErrors}
            splitCalculations={splitCalculations}
          />

          <PartilhaCardsAndAlerts
            splitCalculations={splitCalculations}
            item={item}
            fluxoForm={fluxoForm}
          />
        </div>

        {/* DADOS PARA LANÇAMENTO NO FLUXO DE CAIXA */}
        <FluxoCaixaLancamentoSection
          fluxoPeriod={fluxoPeriod}
          setFluxoPeriod={setFluxoPeriod}
          handleNavigateFluxoPeriod={handleNavigateFluxoPeriod}
          handleFluxoDateChange={handleFluxoDateChange}
          fluxoForm={fluxoForm}
          setFluxoForm={setFluxoForm}
          hasError={hasError}
          markTouched={markTouched}
          validationErrors={validationErrors}
          splitCalculations={splitCalculations}
          item={item}
          destinoFluxo={destinoFluxo}
          currentConsolidatedValor={currentConsolidatedValor}
        />
      </form>
    </Modal>
  );
}
