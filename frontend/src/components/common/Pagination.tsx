import React from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, MoreHorizontal } from '../icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
  showFirstLast?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
  showFirstLast = true,
}) => {
  const range = (start: number, end: number) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, idx) => idx + start);
  };

  const paginationRange = (): (number | string)[] => {
    const totalPageNumbers = siblingCount * 2 + 5;

    if (totalPageNumbers >= totalPages) {
      return range(1, totalPages);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = range(1, leftItemCount);
      return [...leftRange, 'dots', totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = range(totalPages - rightItemCount + 1, totalPages);
      return [firstPageIndex, 'dots', ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [firstPageIndex, 'dots', ...middleRange, 'dots', lastPageIndex];
    }

    return [];
  };

  const pages = paginationRange();

  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const baseButtonClass = 
    'relative inline-flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500';
  
  const pageButtonClass = (isActive: boolean) =>
    clsx(
      baseButtonClass,
      isActive
        ? 'bg-primary-600 text-white hover:bg-primary-700'
        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
    );

  const navigationButtonClass = (isDisabled: boolean) =>
    clsx(
      baseButtonClass,
      'px-2',
      isDisabled
        ? 'text-gray-300 cursor-not-allowed bg-gray-50 border border-gray-200'
        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
    );

  return (
    <nav
      className={clsx('flex items-center justify-center space-x-1', className)}
      aria-label="Pagination"
    >
      {showFirstLast && currentPage > 1 && (
        <button
          onClick={() => onPageChange(1)}
          className={navigationButtonClass(false)}
          aria-label="Go to first page"
        >
          First
        </button>
      )}

      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className={navigationButtonClass(currentPage === 1)}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((page, index) => {
        if (page === 'dots') {
          return (
            <span
              key={`dots-${index}`}
              className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-700"
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          );
        }

        return (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={pageButtonClass(currentPage === page)}
            aria-label={`Go to page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        );
      })}

      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className={navigationButtonClass(currentPage === totalPages)}
        aria-label="Go to next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {showFirstLast && currentPage < totalPages && (
        <button
          onClick={() => onPageChange(totalPages)}
          className={navigationButtonClass(false)}
          aria-label="Go to last page"
        >
          Last
        </button>
      )}
    </nav>
  );
};

export default Pagination;