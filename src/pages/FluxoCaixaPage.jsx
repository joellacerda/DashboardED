import { useState, useMemo } from 'react';
import { getData, addItem, updateItem, deleteItem } from '../utils/storage';
import {
  formatCurrency,
  formatDate,
  getTodayISO,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  exportCSV,
  exportPDF,
} from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';

const CATEGORIAS_ENTRADA = [
  'Exames / Procedimentos',
  'Consultas',
  'Convênios / Repasses',
  'Venda de Materiais',
  'Outras Entradas',
];

const CATEGORIAS_SAIDA = [
  'Material Médico / Insumos',
  'Equipamentos / Manutenção',
  'Aluguel / Condomínio',
  'Contas (Água, Luz, Internet)',
  'Impostos / Taxas',
  'Folha de Pagamento / Pessoal',
  'Serviços Terceirizados',
  'Marketing / Administrativo',
  'Outras Saídas',
];

const emptyForm = { data: '', nome: '', tipo: 'entrada', categoria: 'Exames / Procedimentos', valor: '' };

const columns = [
  { key: 'data', label: 'Data', accessor: (item) => formatDate(item.data) },
  { key: 'nome', label: 'Descrição' },
  { key: 'categoria', label: 'Categoria', accessor: (item) => item.categoria || 'Geral' },
  { key: 'tipo', label: 'Tipo', accessor: (item) => (item.tipo === 'entrada' ? 'Entrada' : 'Saída') },
  { key: 'valor', label: 'Valor (R$)', accessor: (item) => formatCurrency(item.valor) },
];

export default function FluxoCaixaPage() {
  const [data, setData] = useState(() => getData('fluxoCaixa'));
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const refresh = () => setData(getData('fluxoCaixa'));

  const filtered = useMemo(() => {
    let items = data.filter((f) => isDateInPeriod(f.data, period));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          e.nome.toLowerCase().includes(q) ||
          (e.categoria || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      items = items.filter((e) => e.tipo === typeFilter);
    }
    if (categoryFilter) {
      items = items.filter((e) => e.categoria === categoryFilter);
    }
    // Ordenar por data decrescente (e desempate por criação mais recente)
    return items.sort((a, b) => {
      const dateComparison = (b.data || '').localeCompare(a.data || '');
      if (dateComparison !== 0) return dateComparison;
      if (a.createdAt && b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (a.createdAt) return -1;
      if (b.createdAt) return 1;
      const indexA = data.indexOf(a);
      const indexB = data.indexOf(b);
      return indexB - indexA;
    });
  }, [data, period, search, typeFilter, categoryFilter]);

  // List of unique categories according to the selected typeFilter for filtering
  const availableCategories = useMemo(() => {
    let base = [];
    if (typeFilter === 'entrada') {
      base = [...CATEGORIAS_ENTRADA];
    } else if (typeFilter === 'saida') {
      base = [...CATEGORIAS_SAIDA];
    } else {
      base = [...CATEGORIAS_ENTRADA, ...CATEGORIAS_SAIDA];
    }
    const set = new Set(base);
    data.forEach((d) => {
      if (d.categoria && (!typeFilter || d.tipo === typeFilter)) {
        set.add(d.categoria);
      }
    });
    return Array.from(set).sort();
  }, [data, typeFilter]);

  const totalEntradas = filtered
    .filter((f) => f.tipo === 'entrada')
    .reduce((s, f) => s + Number(f.valor), 0);
  const totalSaidas = filtered
    .filter((f) => f.tipo === 'saida')
    .reduce((s, f) => s + Number(f.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, data: getTodayISO(), categoria: 'Exames / Procedimentos' });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      data: item.data,
      nome: item.nome,
      tipo: item.tipo,
      categoria: item.categoria || (item.tipo === 'entrada' ? 'Exames / Procedimentos' : 'Material Médico / Insumos'),
      valor: item.valor,
    });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.data || !form.nome || !form.valor) return;
    if (editId) {
      updateItem('fluxoCaixa', editId, form);
    } else {
      addItem('fluxoCaixa', form);
    }
    refresh();
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteItem('fluxoCaixa', deleteId);
      refresh();
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Fluxo de Caixa</h1>
        <div className="header-actions">
          <div className="period-selector">
            <button
              className="period-btn"
              onClick={() => setPeriod(navigateAcquisitionPeriod(period, -1))}
              title="Período anterior"
            >
              ◀
            </button>
            <span className="period-label">{period.label}</span>
            <button
              className="period-btn"
              onClick={() => setPeriod(navigateAcquisitionPeriod(period, 1))}
              title="Próximo período"
            >
              ▶
            </button>
          </div>
          <button className="btn btn-primary" onClick={openNew}>
            + Nova Movimentação
          </button>
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Entradas</span>
              <div className="summary-card-icon">📈</div>
            </div>
            <div className="summary-card-value value-positive">{formatCurrency(totalEntradas)}</div>
          </div>

          <div className="summary-card card-accent-red">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Saídas</span>
              <div className="summary-card-icon red">📉</div>
            </div>
            <div className="summary-card-value value-negative">{formatCurrency(totalSaidas)}</div>
          </div>

          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Saldo</span>
              <div className="summary-card-icon blue">💰</div>
            </div>
            <div className={`summary-card-value ${saldo >= 0 ? 'value-positive' : 'value-negative'}`}>
              {formatCurrency(saldo)}
            </div>
          </div>

          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Movimentações</span>
              <div className="summary-card-icon amber">📋</div>
            </div>
            <div className="summary-card-value">{filtered.length}</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Movimentações</h3>
            <div className="table-actions">
              <select
                className="input-field"
                value={typeFilter}
                onChange={(e) => {
                  const newType = e.target.value;
                  setTypeFilter(newType);
                  if (categoryFilter) {
                    let base = [];
                    if (newType === 'entrada') base = [...CATEGORIAS_ENTRADA];
                    else if (newType === 'saida') base = [...CATEGORIAS_SAIDA];
                    else base = [...CATEGORIAS_ENTRADA, ...CATEGORIAS_SAIDA];
                    const validSet = new Set(base);
                    data.forEach((d) => {
                      if (d.categoria && (!newType || d.tipo === newType)) {
                        validSet.add(d.categoria);
                      }
                    });
                    if (!validSet.has(categoryFilter)) {
                      setCategoryFilter('');
                    }
                  }
                }}
                style={{ width: '130px', fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
              >
                <option value="">Todos Tipos</option>
                <option value="entrada">Entradas</option>
                <option value="saida">Saídas</option>
              </select>

              <select
                className="input-field"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: '170px', fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
              >
                <option value="">Todas Categorias</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar descrição ou categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ExportMenu
                onExportCSV={() => exportCSV(filtered, columns, 'fluxo_caixa')}
                onExportPDF={() => exportPDF(filtered, columns, 'Fluxo de Caixa')}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th style={{ width: '90px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="table-empty">
                        <div className="table-empty-icon">💰</div>
                        <p>Nenhuma movimentação neste período com os filtros aplicados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.data)}</td>
                      <td style={{ fontWeight: 500 }}>{item.nome}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: 'var(--bg-surface-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {item.categoria || 'Geral'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${item.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                          {item.tipo === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                        </span>
                      </td>
                      <td className={item.tipo === 'entrada' ? 'value-positive' : 'value-negative'}>
                        {formatCurrency(item.valor)}
                      </td>
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
                  ))
                )}
                {filtered.length > 0 && (
                  <tr className="totals-row">
                    <td colSpan="4" style={{ textAlign: 'end', fontWeight: 700 }}>Totais no período:</td>
                    <td>
                      <span className={saldo >= 0 ? 'value-positive' : 'value-negative'} style={{ fontWeight: 700 }}>
                        {formatCurrency(saldo)}
                      </span>
                    </td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="table-footer">
              <span>{filtered.length} movimentação(ões)</span>
              <span>
                Entradas: {formatCurrency(totalEntradas)} | Saídas: {formatCurrency(totalSaidas)}
              </span>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Movimentação' : 'Nova Movimentação'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>{editId ? 'Salvar' : 'Cadastrar'}</button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">Data <span className="required">*</span></label>
              <input
                type="date"
                className="input-field"
                required
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Tipo <span className="required">*</span></label>
              <select
                className="input-field"
                value={form.tipo}
                onChange={(e) => {
                  const newTipo = e.target.value;
                  const defaultCat = newTipo === 'entrada' ? CATEGORIAS_ENTRADA[0] : CATEGORIAS_SAIDA[0];
                  setForm({ ...form, tipo: newTipo, categoria: defaultCat });
                }}
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>

            <div className="input-group full-width">
              <label className="input-label">Categoria <span className="required">*</span></label>
              <select
                className="input-field"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                {(form.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group full-width">
              <label className="input-label">Descrição <span className="required">*</span></label>
              <input
                type="text"
                className="input-field"
                required
                placeholder="Nome ou descrição da movimentação"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="input-group full-width">
              <label className="input-label">Valor (R$) <span className="required">*</span></label>
              <input
                type="number"
                className="input-field"
                required
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir esta movimentação?"
      />
    </>
  );
}
