import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Play } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { extractVariables, renderTemplate } from '@/hooks/useVariables';
import VariablePreview from './VariablePreview';
import type { VariableInfo } from '@/hooks/useVariables';
import type { VariableDef } from '@/types';

interface VariableFormProps {
  template: string;
  onCopy: (rendered: string) => void;
  onTest?: (rendered: string) => void;
}

function varInfo(def: VariableDef, value: string): VariableInfo {
  return {
    name: def.name,
    value,
    type: def.type,
    options: def.options,
    min: def.min,
    max: def.max,
  };
}

export default function VariableForm({ template, onCopy, onTest }: VariableFormProps) {
  const [expanded, setExpanded] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});

  const defs = useMemo(() => extractVariables(template), [template]);

  const variables: VariableInfo[] = useMemo(
    () => defs.map((d) => varInfo(d, values[d.name] ?? '')),
    [defs, values]
  );

  const rendered = useMemo(() => renderTemplate(template, variables), [template, variables]);
  const filledCount = variables.filter((v) => v.value.trim()).length;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-sm font-medium w-full text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        变量填充
        <span className="text-xs text-muted-foreground font-normal">
          （{filledCount}/{variables.length}）
        </span>
      </button>

      {expanded && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {variables.map((v) => (
              <div key={v.name} className="space-y-1">
                <Label className="text-xs">
                  {v.name}
                  {v.type !== 'text' && (
                    <span className="ml-1 text-muted-foreground/60">({v.type})</span>
                  )}
                </Label>
                {v.type === 'boolean' ? (
                  <label className="flex items-center gap-2 h-8 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={v.value === 'true'}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [v.name]: e.target.checked ? 'true' : 'false' }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground">
                      {v.value === 'true' ? '是' : v.value === 'false' ? '否' : '未选择'}
                    </span>
                  </label>
                ) : v.type === 'select' && v.options ? (
                  <select
                    value={v.value}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                    }
                    className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">-- 选择 {v.name} --</option>
                    {v.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : v.type === 'number' ? (
                  <Input
                    type="number"
                    value={v.value}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                    }
                    min={v.min}
                    max={v.max}
                    placeholder={`输入 ${v.name}`}
                    className="h-8 text-sm"
                  />
                ) : v.type === 'textarea' ? (
                  <Textarea
                    value={v.value}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                    }
                    placeholder={`输入 ${v.name}`}
                    className="min-h-[60px] text-sm"
                    rows={3}
                  />
                ) : (
                  <Input
                    value={v.value}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                    }
                    placeholder={`输入 ${v.name}`}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <VariablePreview rendered={rendered} />

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCopy(rendered)}
              disabled={!rendered}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              复制完整内容
            </Button>
            {onTest && (
              <Button size="sm" onClick={() => onTest(rendered)}>
                <Play className="h-3.5 w-3.5 mr-1" />
                运行测试
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
