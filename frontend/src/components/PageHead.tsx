import { useEffect } from 'react';

interface PageHeadProps {
  title?: string;
  description?: string;
}

const DEFAULT_TITLE = 'BuildX — AI App Architect';
const DEFAULT_DESCRIPTION =
  'Turn any app idea into a complete full-stack blueprint instantly with AI';

export function PageHead({ title, description }: PageHeadProps) {
  useEffect(() => {
    document.title = title ? `${title} · BuildX` : DEFAULT_TITLE;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description ?? DEFAULT_DESCRIPTION);

    return () => {
      document.title = DEFAULT_TITLE;
      meta?.setAttribute('content', DEFAULT_DESCRIPTION);
    };
  }, [title, description]);

  return null;
}
