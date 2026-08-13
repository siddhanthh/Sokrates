"use client";

import React from "react";

export interface InterestCategory {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
}

export interface InterestPickerProps {
  categories?: InterestCategory[];
  selectedCategoryIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

const DEFAULT_CATEGORIES: InterestCategory[] = [
  { id: "cat-1", name: "Philosophy", slug: "philosophy", icon: "🧠" },
  { id: "cat-2", name: "Ethics", slug: "ethics", icon: "⚖️" },
  { id: "cat-3", name: "Metaphysics", slug: "metaphysics", icon: "🌌" },
  { id: "cat-4", name: "Epistemology", slug: "epistemology", icon: "📖" },
  { id: "cat-5", name: "Political Philosophy", slug: "politics", icon: "🏛️" },
  { id: "cat-6", name: "Logic", slug: "logic", icon: "🧩" },
];

export const InterestPicker: React.FC<InterestPickerProps> = ({
  categories = DEFAULT_CATEGORIES,
  selectedCategoryIds,
  onChange,
  disabled = false,
}) => {
  const displayCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const toggleCategory = (id: string) => {
    if (disabled) return;
    if (selectedCategoryIds.includes(id)) {
      onChange(selectedCategoryIds.filter((item) => item !== id));
    } else {
      onChange([...selectedCategoryIds, id]);
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-center text-sm font-medium text-gray-300">
        <span>Select Philosophical Interests</span>
        <span className="text-xs text-indigo-400 font-semibold">
          {selectedCategoryIds.length} Selected
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {displayCategories.map((cat) => {
          const isSelected = selectedCategoryIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              disabled={disabled}
              onClick={() => toggleCategory(cat.id)}
              className={`flex items-center space-x-2.5 p-3 rounded-xl border text-left transition-all duration-200 focus:outline-none ${
                isSelected
                  ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/50"
                  : "bg-gray-800/60 border-gray-700/80 text-gray-300 hover:bg-gray-800 hover:border-gray-600"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className="text-xl select-none">{cat.icon || "💡"}</span>
              <span className="text-sm font-medium truncate leading-snug">
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default InterestPicker;
