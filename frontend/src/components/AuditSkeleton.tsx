import React from 'react';

export const AuditSkeleton: React.FC = () => {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-white/5 p-4">
          <div className="mb-3 h-3 w-1/3 rounded bg-white/10" />
          <div className="h-3 w-2/3 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
};
