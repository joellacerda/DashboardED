import { formatCurrency } from '../../utils/helpers';

export default function PartilhaCardsAndAlerts({
  splitCalculations,
  item,
  fluxoForm,
}) {
  return (
    <>
      {/* Cards de Partilha Calculada */}
      {splitCalculations.temDivisao2 ? (
        <div className="split-cards-row three-cols">
          <div className="split-card-item split-card-medico">
            <div className="split-card-title">
              <span>
                👨‍⚕️ {item.medico || 'Médico 1'} ({splitCalculations.pctMed1}%)
              </span>
            </div>
            <div className="split-card-value">
              {formatCurrency(splitCalculations.direitoMedico1)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Já recebeu direto: {formatCurrency(splitCalculations.valMedicoNum)}
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                marginTop: '0.2rem',
                color:
                  splitCalculations.diferencaMedico1 > 0
                    ? 'var(--color-amber)'
                    : 'var(--color-emerald)',
              }}
            >
              {splitCalculations.diferencaMedico1 > 0
                ? `A repassar: ${formatCurrency(splitCalculations.diferencaMedico1)}`
                : 'Integralizado'}
            </div>
          </div>

          <div className="split-card-item split-card-medico2">
            <div className="split-card-title">
              <span>
                👨‍⚕️ {fluxoForm.medico2 || '2º Médico'} ({splitCalculations.pctMed2}%)
              </span>
            </div>
            <div className="split-card-value">
              {formatCurrency(splitCalculations.direitoMedico2)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Via repasse da clínica
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                marginTop: '0.2rem',
                color: 'var(--color-purple)',
              }}
            >
              A repassar: {formatCurrency(splitCalculations.direitoMedico2)}
            </div>
          </div>

          <div className="split-card-item split-card-clinica">
            <div className="split-card-title">
              <span>🏢 Clínica ({splitCalculations.pctClinica}%)</span>
            </div>
            <div className="split-card-value">
              {formatCurrency(splitCalculations.direitoClinica)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Recebido: {formatCurrency(splitCalculations.valClinicaNum)}
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                marginTop: '0.2rem',
                color: 'var(--color-emerald)',
              }}
            >
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
            <div className="split-card-value">
              {formatCurrency(splitCalculations.direitoMedico1)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {splitCalculations.isPolipectomiaMode
                ? `Honorários: ${formatCurrency(splitCalculations.honorariosBaseNum)} + 50% Polip: ${formatCurrency(splitCalculations.partePolipMedico)}`
                : `Recebido direto: ${formatCurrency(splitCalculations.valMedicoNum)}`}
            </div>
            {splitCalculations.isPolipectomiaMode && splitCalculations.valorDevolverClinica > 0 && (
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  marginTop: '0.2rem',
                  color: 'var(--color-amber)',
                }}
              >
                Recebeu do convênio: {formatCurrency(splitCalculations.valMedicoNum)} (
                {formatCurrency(splitCalculations.valorDevolverClinica)} a compensar)
              </div>
            )}
          </div>

          <div className="split-card-item split-card-clinica">
            <div className="split-card-title">
              <span>🏢 Parte da Clínica ({splitCalculations.pctClinica}%)</span>
            </div>
            <div className="split-card-value">
              {formatCurrency(splitCalculations.direitoClinica)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {splitCalculations.isPolipectomiaMode
                ? `Taxa: ${formatCurrency(splitCalculations.taxaSalaNum)} + 50% Polip: ${formatCurrency(splitCalculations.partePolipClinica)} + Alça: ${formatCurrency(splitCalculations.parteAcessorioClinica)}`
                : `Recebido direto: ${formatCurrency(splitCalculations.valClinicaNum)}`}
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                marginTop: '0.2rem',
                color: 'var(--color-emerald)',
              }}
            >
              Líquido retido: {formatCurrency(splitCalculations.direitoClinica)}
            </div>
          </div>
        </div>
      )}

      {/* Alerta / Diagnóstico de Integralização */}
      {splitCalculations.total > 0 && (
        <>
          {splitCalculations.isPolipectomiaMode ? (
            <div
              className="split-alert split-alert-warn"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>✂️</span>
              <div>
                <strong>Partilha de Procedimento & Material (Polipectomia / Alça):</strong>
                <div style={{ marginTop: '0.25rem', fontSize: 'var(--text-xs)', lineHeight: '1.5' }}>
                  O convênio pagou ao médico: Honorários (
                  {formatCurrency(splitCalculations.honorariosBaseNum)}) + Polipectomia (
                  {formatCurrency(splitCalculations.polipectomiaNum)}) + Acessório (
                  {formatCurrency(splitCalculations.acessorioNum)}) ={' '}
                  <strong>{formatCurrency(splitCalculations.valMedicoNum)}</strong>.
                </div>
                <div style={{ marginTop: '0.25rem', fontSize: 'var(--text-xs)', lineHeight: '1.5' }}>
                  À clínica pagou a Taxa de Sala:{' '}
                  <strong>{formatCurrency(splitCalculations.taxaSalaNum)}</strong>.
                </div>
                {splitCalculations.valorDevolverClinica > 0.009 ? (
                  <div
                    style={{
                      marginTop: '0.4rem',
                      padding: '0.45rem 0.65rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-medium)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    👉 <strong>Compensação Devida pelo Médico à Clínica:</strong> Como a clínica tem
                    direito a{' '}
                    <strong>50% da polipectomia ({formatCurrency(splitCalculations.partePolipClinica)})</strong>{' '}
                    e{' '}
                    <strong>100% do acessório ({formatCurrency(splitCalculations.parteAcessorioClinica)})</strong>{' '}
                    pela compra do material descartável, o médico deve transferir{' '}
                    <strong style={{ color: 'var(--color-emerald)', fontSize: 'var(--text-sm)' }}>
                      {formatCurrency(splitCalculations.valorDevolverClinica)}
                    </strong>{' '}
                    à clínica (ou abater de repasses a pagar a ele).
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: '0.3rem',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-emerald)',
                    }}
                  >
                    ✅ Partilha alinhada com as retenções de material e procedimento.
                  </div>
                )}
                <div
                  style={{
                    marginTop: '0.35rem',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  🏢 <strong>Direito Final da Clínica:</strong>{' '}
                  {formatCurrency(splitCalculations.direitoClinica)} | 👨‍⚕️{' '}
                  <strong>Direito Final do Médico:</strong>{' '}
                  {formatCurrency(splitCalculations.totalHonorariosMedicos)}
                </div>
              </div>
            </div>
          ) : splitCalculations.temDivisao2 ? (
            <div className="split-alert split-alert-warn">
              <span style={{ fontSize: '1.2rem' }}>🤝</span>
              <div>
                <strong>Divisão com 2º Médico e Integralização:</strong>
                <div style={{ marginTop: '0.25rem' }}>
                  Total de honorários médicos:{' '}
                  <strong>{formatCurrency(splitCalculations.totalHonorariosMedicos)}</strong> (
                  {splitCalculations.pctMedicoTotal}% do exame de{' '}
                  {formatCurrency(splitCalculations.total)}).
                </div>
                <ul
                  style={{
                    margin: '0.35rem 0 0.35rem 1.25rem',
                    fontSize: 'var(--text-xs)',
                    lineHeight: '1.5',
                  }}
                >
                  <li>
                    <strong>
                      {item.medico || 'Médico Realizante'} ({splitCalculations.pctMed1}%):
                    </strong>{' '}
                    fatia de {formatCurrency(splitCalculations.direitoMedico1)}. Já recebeu{' '}
                    {formatCurrency(splitCalculations.valMedicoNum)} do convênio ➔{' '}
                    <strong style={{ color: 'var(--color-amber)' }}>
                      Clínica paga {formatCurrency(Math.max(0, splitCalculations.diferencaMedico1))}
                    </strong>
                    .
                  </li>
                  <li>
                    <strong>
                      {fluxoForm.medico2 || '2º Médico'} ({splitCalculations.pctMed2}%):
                    </strong>{' '}
                    fatia de {formatCurrency(splitCalculations.direitoMedico2)} ➔{' '}
                    <strong style={{ color: 'var(--color-purple)' }}>
                      Clínica paga {formatCurrency(splitCalculations.direitoMedico2)}
                    </strong>
                    .
                  </li>
                </ul>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                  👉 <strong>Total repassado aos médicos:</strong>{' '}
                  {formatCurrency(splitCalculations.repasseTotalMedicos)} |{' '}
                  <strong>Líquido que fica na clínica:</strong>{' '}
                  {formatCurrency(splitCalculations.direitoClinica)} ({splitCalculations.pctClinica}%).
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
                {formatCurrency(splitCalculations.direitoMedico1)} (
                {splitCalculations.pctMedicoTotal}%) de honorários devidos ao médico, a clínica
                deve pagar{' '}
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
                {formatCurrency(splitCalculations.direitoMedico1)} (
                {splitCalculations.pctMedicoTotal}%) devidos. A clínica tem direito à diferença de{' '}
                <strong style={{ color: 'var(--color-blue)' }}>
                  {formatCurrency(Math.abs(splitCalculations.diferencaMedico1))}
                </strong>
                .
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
                <strong>Partilha Equilibrada:</strong> Os valores recebidos coincidem exatamente com
                a divisão acordada ({splitCalculations.pctMedicoTotal}% Médico /{' '}
                {splitCalculations.pctClinica}% Clínica).
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
