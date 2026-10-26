import { formatCurrency } from '../../utils/helpers';

export default function PartilhaInputsSection({
  fluxoForm,
  setFluxoForm,
  splitCalculations,
  item,
}) {
  return (
    <>
      {/* Alternador de Modo de Partilha */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          background: 'var(--color-dark-850)',
          padding: '0.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-medium)',
          marginBottom: '0.25rem',
        }}
      >
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
          style={{
            flex: 1,
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
          onClick={() => setFluxoForm((prev) => ({ ...prev, modoPartilha: 'polipectomia' }))}
        >
          <span>✂️ Polipectomia & Acessório (Alça)</span>
          {item.procedimentoComplementar &&
            /polipectomia|mucosectomia/i.test(item.procedimentoComplementar) && (
              <span
                className="badge badge-success"
                style={{ fontSize: '10px', padding: '1px 6px' }}
              >
                Detectado
              </span>
            )}
        </button>
      </div>

      {fluxoForm.modoPartilha === 'polipectomia' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              background: 'var(--bg-surface)',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              lineHeight: '1.4',
            }}
          >
            💡 <strong>Regra de Partilha:</strong> O convênio paga a taxa de sala para a clínica e
            repassa honorários + polipectomia + acessório ao médico. O sistema divide a polipectomia em{' '}
            <strong>50% / 50%</strong> e destina <strong>100% do acessório (alça)</strong> à clínica
            pela compra do material.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
            }}
          >
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
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                100% Clínica (pago pelo convênio à clínica)
              </span>
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
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                100% Médico (pago pelo convênio ao médico)
              </span>
            </div>

            <div className="split-input-box" style={{ borderColor: 'rgba(59, 130, 246, 0.45)' }}>
              <label className="split-input-label" style={{ color: 'var(--color-blue)' }}>
                ✂️ VALOR DA POLIPECTOMIA
              </label>
              <input
                type="number"
                className="split-input-field"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={fluxoForm.valorPolipectomia}
                onChange={(e) => setFluxoForm({ ...fluxoForm, valorPolipectomia: e.target.value })}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-blue)' }}>
                Dividido 50% Clínica / 50% Médico
              </span>
            </div>

            <div className="split-input-box" style={{ borderColor: 'rgba(16, 185, 129, 0.45)' }}>
              <label className="split-input-label" style={{ color: 'var(--color-emerald)' }}>
                🩹 ACESSÓRIO / ALÇA
              </label>
              <input
                type="number"
                className="split-input-field"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={fluxoForm.valorAcessorio}
                onChange={(e) => setFluxoForm({ ...fluxoForm, valorAcessorio: e.target.value })}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-emerald)' }}>
                100% Clínica (compra de material)
              </span>
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
                    valor: !prev.valor || prev.valor === prev.valorClinica ? newClin : prev.valor,
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
              onChange={(e) =>
                setFluxoForm({ ...fluxoForm, percentualMedico: Number(e.target.value) })
              }
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
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Proporção rápida:
              </span>
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
    </>
  );
}
