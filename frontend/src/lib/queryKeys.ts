export const queryKeys = {
  blueprints: {
    all: ['blueprints'] as const,
    list: (scope: 'public' | 'mine') => ['blueprints', 'list', scope] as const,
    detail: (id: string) => ['blueprints', 'detail', id] as const,
  },
};
