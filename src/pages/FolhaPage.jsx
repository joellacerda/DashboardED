import { useState, useMemo } from 'react';
import { getData, addItem, updateItem, deleteItem } from '../utils/storage';
import { formatCurrency, exportCSV, exportPDF } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';

const emptyForm = {
  nome: '',
  salarioBase: '',
  valeAlimentacao: '',
  valeTransporte: '',
  extras: '',
  descontos: '',
  produtividade: '',
};

function calcLiquido(f) {
  return (
    Number(f.salarioBase || 0) +
    Number(f.valeAlimentacao || 0) +
    Number(f.valeTransporte || 0) +
    Number(f.extras || 0) +
    Number(f.produtividade || 0) -
    Number(f.descontos || 0)
  );
}

const columns = [
  { key: 'nome', label: 'Nome' },
  { key: 'salarioBase', label: 'Salário Base', accessor: (item) => formatCurrency(item.salarioBase) },
  { key: 'valeAlimentacao', label: 'V. Alimentação', accessor: (item) => formatCurrency(item.valeAlimentacao) },
  { key: 'valeTransporte', label: 'V. Transporte', accessor: (item) => formatCurrency(item.valeTransporte) },
  { key: 'extras', label: 'Extras', accessor: (item) => formatCurrency(item.extras) },
  { key: 'descontos', label: 'Descontos', accessor: (item) => formatCurrency(item.descontos) },
  { key: 'produtividade', label: 'Produtividade', accessor: (item) => formatCurrency(item.produtividade) },
  { key: 'liquido', label: 'Líquido', accessor: (item) => formatCurrency(calcLiquido(item)) },
];

export default function FolhaPage() {
  const [data, setData] = useState(() => getData('folhaPagamento'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const refresh = () => setData(getData('folhaPagamento'));

  const filtered = useMemo(() => {
    let items = [...data];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((e) => e.nome.toLowerCase().includes(q));
    }
    return items.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [data, search]);

  const totalFolha = filtered.reduce((s, f) => s + calcLiquido(f), 0);
  const totalBase = filtered.reduce((s, f) => s + Number(f.salarioBase || 0), 0);
  const mediaSalarial = filtered.length > 0 ? totalFolha / filtered.length : 0;

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      nome: item.nome,
      salarioBase: item.salarioBase,
      valeAlimentacao: item.valeAlimentacao,
      valeTransporte: item.valeTransporte,
      extras: item.extras,
      descontos: item.descontos,
      produtividade: item.produtividade,
    });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.nome || !form.salarioBase) return;
    if (editId) {
      updateItem('folhaPagamento', editId, form);
    } else {
      addItem('folhaPagamento', form);
    }
    refresh();
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteItem('folhaPagamento', deleteId);
      refresh();
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Folha de Pagamento</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>
            + Novo Funcionário
          </button>
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Total da Folha</span>
              <div className="summary-card-icon">💰</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalFolha)}</div>
          </div>
          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Base</span>
              <div className="summary-card-icon blue">📊</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalBase)}</div>
          </div>
          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Funcionários</span>
              <div className="summary-card-icon amber">👥</div>
            </div>
            <div className="summary-card-value">{filtered.length}</div>
          </div>
          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Média Salarial</span>
              <div className="summary-card-icon purple">📈</div>
            </div>
            <div className="summary-card-value">{formatCurrency(mediaSalarial)}</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Funcionários</h3>
            <div className="table-actions">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar funcionário..."
                  value={search}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ExportMenu
                onExportCSV={() => exportCSV(filtered, columns, 'folha_pagamento')}
                onExportPDF={() => exportPDF(filtered, columns, 'Folha de Pagamento')}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Salário Base</th>
                  <th>V. Alimentação</th>
                  <th>V. Transporte</th>
                  <th>Extras</th>
                  <th>Descontos</th>
                  <th>Produtividade</th>
                  <th>Líquido</th>
                  <th style={{ width: '90px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className="table-empty">
                        <div className="table-empty-icon">👥</div>
                        <p>Nenhum funcionário registrado{search ? ' para esta busca' : ''}.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 500 }}>{item.nome}</td>
                        <td className="value-currency">{formatCurrency(item.salarioBase)}</td>
                        <td className="value-currency">{formatCurrency(item.valeAlimentacao)}</td>
                        <td className="value-currency">{formatCurrency(item.valeTransporte)}</td>
                        <td className="value-positive">{formatCurrency(item.extras)}</td>
                        <td className="value-negative">{formatCurrency(item.descontos)}</td>
                        <td className="value-positive">{formatCurrency(item.produtividade)}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(calcLiquido(item))}</td>
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
                    ))}
                    <tr className="totals-row">
                      <td style={{ textAlign: 'end', fontWeight: 700 }}>Totais:</td>
                      <td className="value-currency">{formatCurrency(totalBase)}</td>
                      <td className="value-currency">{formatCurrency(filtered.reduce((s, f) => s + Number(f.valeAlimentacao || 0), 0))}</td>
                      <td className="value-currency">{formatCurrency(filtered.reduce((s, f) => s + Number(f.valeTransporte || 0), 0))}</td>
                      <td className="value-positive">{formatCurrency(filtered.reduce((s, f) => s + Number(f.extras || 0), 0))}</td>
                      <td className="value-negative">{formatCurrency(filtered.reduce((s, f) => s + Number(f.descontos || 0), 0))}</td>
                      <td className="value-positive">{formatCurrency(filtered.reduce((s, f) => s + Number(f.produtividade || 0), 0))}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(totalFolha)}</td>
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="table-footer">
              <span>{filtered.length} funcionário(s)</span>
              <span>Total líquido: {formatCurrency(totalFolha)}</span>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Funcionário' : 'Novo Funcionário'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>{editId ? 'Salvar' : 'Cadastrar'}</button>
          </>
        }
      >
        <form onSubmit={handleSave} autoComplete="off">
          <div className="modal-form-grid">
            <div className="input-group full-width">
              <label className="input-label">Nome <span className="required">*</span></label>
              <input
                type="text"
                className="input-field"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Nome do funcionário"
                value={form.nome}
                onChange={(e) => updateField('nome', e.target.value.toUpperCase())}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Salário Base (R$) <span className="required">*</span></label>
              <input type="number" className="input-field" required min="0" step="0.01" placeholder="0,00" value={form.salarioBase} onChange={(e) => updateField('salarioBase', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Vale Alimentação (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valeAlimentacao} onChange={(e) => updateField('valeAlimentacao', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Vale Transporte (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valeTransporte} onChange={(e) => updateField('valeTransporte', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Extras (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.extras} onChange={(e) => updateField('extras', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Descontos (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.descontos} onChange={(e) => updateField('descontos', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Produtividade (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.produtividade} onChange={(e) => updateField('produtividade', e.target.value)} />
            </div>
          </div>
          {(form.salarioBase || form.extras || form.descontos || form.produtividade) && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: 'oklch(72% 0.19 160 / 0.08)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--text-sm)',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Salário Líquido Estimado:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-lg)' }}>
                {formatCurrency(calcLiquido(form))}
              </span>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir este funcionário?"
      />
    </>
  );
}
