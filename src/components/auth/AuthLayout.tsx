import type { ReactNode } from 'react';
import { Folder, Wand2, Cpu, History, Tags, Database } from 'lucide-react';

const FEATURES = [
  { icon: Folder, title: '场景化管理', desc: '按业务场景归类组织提示词，井井有条' },
  { icon: Wand2, title: 'AI 生成与优化', desc: '内置模型辅助编写、润色与重构提示词' },
  { icon: Cpu, title: '多模型对比', desc: '一次输入，多模型并行测试输出效果' },
  { icon: History, title: '版本历史', desc: '每次修改自动留痕，随时对比与回滚' },
  { icon: Tags, title: '标签与收藏', desc: '精细分类与收藏，快速找到常用提示词' },
  { icon: Database, title: '数据迁移', desc: '支持 JSON / Markdown 导入导出，随身携带' },
];

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden lg:flex flex-1 items-center justify-center px-10 xl:px-20 py-10 bg-gradient-to-br from-primary/10 via-background to-accent/40">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3">
            <img src="/AI.svg" alt="Prompt Manager" className="h-12 w-12 rounded-2xl shadow-lg shadow-primary/20" />
            <div>
              <h1 className="text-2xl font-bold leading-tight">Prompt Manager</h1>
              <p className="text-sm text-muted-foreground">AI 提示词管理助手</p>
            </div>
          </div>

          <h2 className="mt-10 text-3xl xl:text-4xl font-bold leading-tight">
            高效管理 AI 提示词，
            <br />
            让每一次创作<span className="text-primary">事半功倍</span>
          </h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            Prompt Manager 提供场景化整理、AI 生成优化、多模型对比与版本追踪的一站式能力，帮助你沉淀并复用每一个优质提示词。
          </p>

          <ul className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="lg:hidden mb-8 flex items-center gap-2.5">
          <img src="/AI.svg" alt="AI" className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-bold">Prompt Manager</span>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
