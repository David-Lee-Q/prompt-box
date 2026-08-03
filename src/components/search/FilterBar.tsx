import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { getAllTags } from '@/services/promptService';
import useAppStore from '@/store/useAppStore';
import useAuthStore from '@/store/authStore';

export default function FilterBar() {
  const { filterTag, setFilterTag, dateRange, setDateRange, loadPrompts } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (currentUser) {
      getAllTags(currentUser.id).then(setAllTags);
    }
  }, [currentUser]);

  const hasActiveFilters = filterTag !== null || dateRange.from !== null || dateRange.to !== null;

  const clearFilters = () => {
    setFilterTag(null);
    setDateRange({ from: null, to: null });
    setTimeout(() => loadPrompts(), 0);
  };

  const handleTagClick = (tag: string) => {
    setFilterTag(filterTag === tag ? null : tag);
    setTimeout(() => loadPrompts(), 0);
  };

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const timestamp = value ? new Date(value).getTime() : null;
    setDateRange({ ...dateRange, [field]: timestamp });
  };

  const applyDateFilter = () => {
    loadPrompts();
    setShowDatePicker(false);
  };

  return (
    <div className="mb-3 space-y-2">
      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">筛选：</span>
          {filterTag && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {filterTag}
              <button onClick={() => { setFilterTag(null); setTimeout(() => loadPrompts(), 0); }}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {(dateRange.from || dateRange.to) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-xs">
              <Calendar className="h-3 w-3" />
              {dateRange.from ? new Date(dateRange.from).toLocaleDateString() : '不限'} ~ {dateRange.to ? new Date(dateRange.to).toLocaleDateString() : '不限'}
              <button onClick={() => { setDateRange({ from: null, to: null }); setTimeout(() => loadPrompts(), 0); }}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <button onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
            清除
          </button>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagClick(tag)}
            className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
              filterTag === tag
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {tag}
          </button>
        ))}
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={`px-2 py-0.5 rounded-full text-xs transition-colors flex items-center gap-1 ${
            showDatePicker || dateRange.from || dateRange.to
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          <Calendar className="h-3 w-3" />
          时间
        </button>
      </div>

      {/* Date picker */}
      {showDatePicker && (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30 text-xs">
          <span className="text-muted-foreground">从</span>
          <input
            type="date"
            onChange={(e) => handleDateChange('from', e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <span className="text-muted-foreground">到</span>
          <input
            type="date"
            onChange={(e) => handleDateChange('to', e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button onClick={applyDateFilter} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 transition-colors active:scale-[0.95]">
            确定
          </button>
        </div>
      )}
    </div>
  );
}
