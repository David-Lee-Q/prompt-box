interface QualityAnalysisBadgeProps {
  score?: number;
}

export default function QualityAnalysisBadge({ score }: QualityAnalysisBadgeProps) {
  if (score == null) return null;

  const color =
    score >= 75 ? 'text-green-600 dark:text-green-400 bg-green-500/10' :
    score >= 50 ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10' :
    'text-red-600 dark:text-red-400 bg-red-500/10';

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {score}分
    </span>
  );
}
