'use client';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export default function Loader({ size = 'md', message }: LoaderProps) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-3',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`loader ${sizes[size]}`} />
      {message && (
        <p className="font-pixel text-arcade-green text-xs animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}

// Full screen loader
export function FullScreenLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-arcade-black">
      <Loader size="lg" message={message} />
    </div>
  );
}
