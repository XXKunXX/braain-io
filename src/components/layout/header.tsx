"use client";

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 py-3">
      <h2 className="text-sm font-semibold text-gray-800 truncate">{title}</h2>
      {children && (
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 ml-3">
          {children}
        </div>
      )}
    </header>
  );
}
