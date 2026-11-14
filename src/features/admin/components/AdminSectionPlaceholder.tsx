export interface AdminSectionPlaceholderProps {
  title: string;
  task: string;
  description: string;
}

/**
 * T3 builds the admin shell and its shared patterns, not T5–T9's real
 * Products/Photos/Pages/Layout/Enquiries CRUD (AGENTS.md rule 1: one
 * task at a time, don't build ahead) — each section route renders this
 * instead, naming the task that replaces it, so the shell's routing and
 * navigation are real and testable without guessing at a domain's data.
 */
export function AdminSectionPlaceholder({ title, task, description }: AdminSectionPlaceholderProps) {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-heading">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {description} Built in {task}.
      </p>
    </main>
  );
}
