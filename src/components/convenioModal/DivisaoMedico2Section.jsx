import AutoCompleteInput from '../AutoCompleteInput';

export default function DivisaoMedico2Section({
  fluxoForm,
  setFluxoForm,
  item,
  medicosOptions,
  hasError,
  markTouched,
  validationErrors,
  splitCalculations,
}) {
  return (
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
  );
}
