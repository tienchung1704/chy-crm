'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategoryIds: string[];
  onFilterChange: (categoryIds: string[]) => void;
}

export default function CategoryFilter({
  categories,
  selectedCategoryIds,
  onFilterChange,
}: CategoryFilterProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  const getCategoriesByParent = (parentId: string | null) => {
    return categories.filter((category) => category.parentId === parentId);
  };

  const hasChildren = (categoryId: string) => {
    return categories.some((category) => category.parentId === categoryId);
  };

  const toggleExpand = (categoryId: string) => {
    const next = new Set(expandedCategories);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    setExpandedCategories(next);
  };

  const handleCategoryClick = (category: Category) => {
    if (selectedCategoryIds.includes(category.id)) {
      onFilterChange(selectedCategoryIds.filter(id => id !== category.id));
    } else {
      onFilterChange([...selectedCategoryIds, category.id]);
    }
    if (hasChildren(category.id)) {
      toggleExpand(category.id);
    }
  };

  const renderCategory = (category: Category, level = 0) => {
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategoryIds.includes(category.id);
    const children = getCategoriesByParent(category.id);
    const hasChild = children.length > 0;

    return (
      <div key={category.id}>
        <button
          type="button"
          onClick={() => handleCategoryClick(category)}
          className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
            isSelected
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${12 + level * 14}px` }}
        >
          <div className="flex items-center gap-2 truncate">
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="truncate">{category.name}</span>
          </div>
          {hasChild && (
            <span
              className="ml-2 shrink-0 p-1 rounded-full hover:bg-gray-200"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpand(category.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          )}
        </button>

        {isExpanded && hasChild && (
          <div className="mt-1 space-y-1">
            {children.map((child) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootCategories = getCategoriesByParent(null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">Danh mục</h3>
        <p className="mt-1 text-sm text-gray-500">
          Chọn nhóm sản phẩm bạn muốn xem.
        </p>
      </div>

      <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => onFilterChange([])}
          className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
            selectedCategoryIds.length === 0
              ? 'bg-gray-900 text-white font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Tất cả sản phẩm
        </button>

        {rootCategories.map((category) => renderCategory(category))}
      </div>
    </div>
  );
}
