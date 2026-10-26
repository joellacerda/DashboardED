import {
  formatCurrency,
  getHonorarioMedicoInPeriod,
  getInstallmentLabel,
} from '../../utils/helpers';

export default function HonorariosPreviewSection({
  form,
  totalParcelasForm,
  honorarioSchedule,
  honDoc1Total,
  honDoc2Total,
}) {
  if (totalParcelasForm < 1 || Number(form.honorariosMedicos) <= 0) {
    return null;
  }

  return (
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
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
        O que entra à vista (Pix, débito, espécie) absorve primeiro as deduções; a taxa de cartão recai só sobre o valor pago no cartão e o que faltar é dividido entre as parcelas do crédito.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {honorarioSchedule.map((row) => {
          const doc1 = form.temDivisao && form.medico2 ? getHonorarioMedicoInPeriod(form, form.medico, row) : null;
          const doc2 = form.temDivisao && form.medico2 ? getHonorarioMedicoInPeriod(form, form.medico2, row) : null;
          return (
            <div
              key={row.start}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}
            >
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                {doc1 !== null && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {form.medico || 'Médico 1'}: {formatCurrency(doc1)} · {form.medico2 || 'Médico 2'}: {formatCurrency(doc2)}
                  </span>
                )}
                <span style={{ fontWeight: 700, color: 'var(--color-blue)', fontSize: 'var(--text-base)' }}>
                  {formatCurrency(row.honorario)}
                </span>
              </span>
            </div>
          );
        })}
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
            👥 Divisão entre Médicos (total):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
            <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {form.medico || 'Médico 1'} ({form.divisaoTipo === 'porcentagem' ? `${form.porcentagemMedico1 ?? 50}%` : 'Fixo'}):
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-sm)', marginTop: '0.15rem' }}>
                {formatCurrency(honDoc1Total)} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal', color: 'var(--text-muted)' }}>total</span>
              </div>
            </div>
            <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {form.medico2 || 'Médico 2'} ({form.divisaoTipo === 'porcentagem' ? `${form.porcentagemMedico2 ?? 50}%` : 'Fixo'}):
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-sm)', marginTop: '0.15rem' }}>
                {formatCurrency(honDoc2Total)} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal', color: 'var(--text-muted)' }}>total</span>
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
        💡 A taxa de clínica ({formatCurrency(form.taxaClinica)}) entra integralmente no fluxo de caixa do período em que o exame foi realizado; no cálculo dos honorários ela é diluída nas parcelas.
      </div>
    </div>
  );
}
