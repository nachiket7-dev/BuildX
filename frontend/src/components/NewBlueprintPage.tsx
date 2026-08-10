import React from 'react';
import { BlueprintPromptStudio } from './BlueprintPromptStudio';
import { PageHead } from './PageHead';

export function NewBlueprintPage() {
  return (
    <div className="min-h-screen bg-[#08080c] text-white relative overflow-x-hidden">
      <PageHead
        title="Create Blueprint — BuildX"
        description="Generate full-stack system architectures, database schemas, and API specifications with Multi-Model AI."
      />

      {/* Ambient Mesh Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-600/15 blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute top-40 left-10 w-[450px] h-[250px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 relative z-10">
        <BlueprintPromptStudio />
      </main>
    </div>
  );
}

export default NewBlueprintPage;
