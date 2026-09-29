import React from 'react';

/**
 * Reusable table pagination component with page numbers windowing,
 * items-per-page selector, and optional summary node.
 */
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      '...',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  label = 'registro(s)',
  summaryNode = null,
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  const handlePageClick = (page) => {
    if (page >= 1 && page <= totalPages && page !== safeCurrentPage) {
      if (onPageChange) onPageChange(page);
    }
  };

  return (
    <div className="table-pagination-container">
      {summaryNode && (
        <div className="table-pagination-summary">
          {summaryNode}
        </div>
      )}

      <div className="table-pagination-main">
        <div className="table-pagination-info">
          <span className="table-pagination-count">
            Exibindo <strong>{startItem}–{endItem}</strong> de <strong>{totalItems}</strong> {label}
          </span>

          {onPageSizeChange && totalItems > 10 && (
            <div className="table-pagination-size-wrap">
              <label htmlFor="pagination-page-size" className="table-pagination-size-label">
                Por pág.:
              </label>
              <select
                id="pagination-page-size"
                className="pagination-select"
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  if (onPageSizeChange) onPageSizeChange(newSize);
                  if (onPageChange) onPageChange(1);
                }}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <nav className="table-pagination-nav" aria-label="Navegação da tabela">
            <button
              type="button"
              className="pagination-btn pagination-nav-btn"
              onClick={() => handlePageClick(1)}
              disabled={safeCurrentPage === 1}
              title="Primeira página"
              aria-label="Primeira página"
            >
              ⇤
            </button>
            <button
              type="button"
              className="pagination-btn pagination-nav-btn"
              onClick={() => handlePageClick(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              title="Página anterior"
              aria-label="Página anterior"
            >
              ‹
            </button>

            <div className="pagination-pages">
              {pageNumbers.map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`pagination-btn pagination-page-btn ${safeCurrentPage === p ? 'active' : ''}`}
                    onClick={() => handlePageClick(p)}
                    aria-current={safeCurrentPage === p ? 'page' : undefined}
                    aria-label={`Página ${p}`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="pagination-btn pagination-nav-btn"
              onClick={() => handlePageClick(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              title="Próxima página"
              aria-label="Próxima página"
            >
              ›
            </button>
            <button
              type="button"
              className="pagination-btn pagination-nav-btn"
              onClick={() => handlePageClick(totalPages)}
              disabled={safeCurrentPage === totalPages}
              title="Última página"
              aria-label="Última página"
            >
              ⇥
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
