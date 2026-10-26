import AutoCompleteInput from '../AutoCompleteInput';

export default function DivisaoMedicosSection({
  form,
  setForm,
  updateField,
  markTouched,
  hasError,
  validationErrors,
  medicosOptions,
}) {
  return (
    <>
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
                    step="0.01"
                    placeholder="50.00"
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
                      const other = Math.round((100 - clamped) * 100) / 100;
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
                    step="0.01"
                    placeholder="50.00"
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
                      const other = Math.round((100 - clamped) * 100) / 100;
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
    </>
  );
}
