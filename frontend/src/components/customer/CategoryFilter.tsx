'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface CategoryFilterProps {
  categories: Category[];
  onFilterChange: (categoryId: string | null) => void;
}

export default function CategoryFilter({ categories, onFilterChange }: CategoryFilterProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Get categories by parent
  const getCategoriesByParent = (parentId: string | null) => {
    return categories.filter(c => c.parentId === parentId);
  };

  const hasChildren = (categoryId: string) => {
    return categories.some(c => c.parentId === categoryId);
  };

  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCategoryClick = (category: Category) => {
    // Select this category for filtering
    setSelectedCategoryId(category.id);
    onFilterChange(category.id);

    // If has children, also toggle expand
    if (hasChildren(category.id)) {
      toggleExpand(category.id);
    }
  };

  const handleReset = () => {
    setSelectedCategoryId(null);
    onFilterChange(null);
  };

  // Recursive render for nested categories
  const renderCategory = (category: Category, level: number = 0) => {
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategoryId === category.id;
    const children = getCategoriesByParent(category.id);
    const hasChild = children.length > 0;

    return (
      <div key={category.id}>
        <button
          onClick={() => handleCategoryClick(category)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <span>{category.name}</span>
          {hasChild && (
            <span onClick={(e) => {
              e.stopPropagation();
              toggleExpand(category.id);
            }}>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          )}
        </button>

        {/* Render children if expanded */}
        {isExpanded && hasChild && (
          <div className="mt-1">
            {children.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const level1Categories = getCategoriesByParent(null);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sticky top-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Danh mục</h3>
      <div className="space-y-1">
        <button
          onClick={handleReset}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            !selectedCategoryId
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Tất cả sản phẩm
        </button>
        
        {level1Categories.map(cat => renderCategory(cat, 0))}
      </div>
    </div>
  );
}
