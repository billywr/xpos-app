interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">{title}</h1>
      {description && <p className="mb-6 text-slate-600 dark:text-slate-400">{description}</p>}
      <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
        Coming soon
      </div>
    </div>
  );
}
