import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const buildxEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#13141F',
      color: '#E2E8F0',
      fontSize: '13px',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Geist Mono', monospace",
      height: '100%',
    },
    '.cm-content': {
      padding: '12px 0',
      caretColor: '#A855F7',
    },
    '.cm-cursor': {
      borderLeftColor: '#A855F7',
      borderLeftWidth: '2px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#C084FC',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(139, 92, 246, 0.25) !important',
    },
    '.cm-gutters': {
      backgroundColor: '#13141F',
      color: '#475569',
      borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      paddingRight: '4px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 12px',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },

    // ─── CodeMirror 6 Merge Visual Styles (Cursor-Style Inline Diff) ───────
    '&.cm-editor .cm-merge-inserted, &.cm-editor .cm-insertedLine, .cm-insertedLine, .cm-merge-b .cm-insertedLine': {
      backgroundColor: 'rgba(16, 185, 129, 0.15) !important',
      color: '#34D399 !important',
    },
    '&.cm-editor .cm-insertedText, .cm-insertedText': {
      backgroundColor: 'rgba(16, 185, 129, 0.28) !important',
      color: '#34D399 !important',
    },
    '&.cm-editor .cm-merge-deleted, &.cm-editor .cm-deletedLine, .cm-deletedLine, .cm-deletedChunk, .cm-merge-b .cm-deletedLine': {
      backgroundColor: 'rgba(239, 68, 68, 0.15) !important',
      color: '#F87171 !important',
      textDecoration: 'line-through !important',
    },
    '&.cm-editor .cm-deletedText, .cm-deletedText': {
      backgroundColor: 'rgba(239, 68, 68, 0.28) !important',
      color: '#F87171 !important',
      textDecoration: 'line-through !important',
    },
    '&.cm-editor .cm-changedLine, .cm-changedLine': {
      backgroundColor: 'rgba(16, 185, 129, 0.12) !important',
    },
    '&.cm-editor .cm-changedText, .cm-changedText': {
      backgroundColor: 'rgba(16, 185, 129, 0.25) !important',
    },
    '.cm-deletedChunk': {
      borderLeft: '3px solid #ef4444 !important',
      backgroundColor: 'rgba(239, 68, 68, 0.08) !important',
    },
    '.cm-insertedChunk': {
      borderLeft: '3px solid #10b981 !important',
      backgroundColor: 'rgba(16, 185, 129, 0.08) !important',
    },
    '.cm-changeGutter, .cm-changedLineGutter': {
      width: '4px',
    },
    '.cm-insertedLineGutter': {
      backgroundColor: 'rgba(16, 185, 129, 0.4) !important',
    },
    '.cm-deletedLineGutter': {
      backgroundColor: 'rgba(239, 68, 68, 0.4) !important',
    },
  },
  { dark: true }
);

export const buildxHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#EC4899', fontWeight: 'bold' },
  { tag: [tags.typeName, tags.className], color: '#38BDF8' },
  { tag: [tags.string, tags.special(tags.string)], color: '#34D399' },
  {
    tag: [tags.function(tags.propertyName), tags.function(tags.variableName)],
    color: '#A78BFA',
  },
  { tag: [tags.propertyName, tags.variableName], color: '#E2E8F0' },
  { tag: tags.number, color: '#F59E0B' },
  { tag: tags.operator, color: '#F472B6' },
  { tag: tags.comment, color: '#64748B', fontStyle: 'italic' },
  { tag: tags.punctuation, color: '#94A3B8' },
]);

export const buildxSyntaxHighlighting = syntaxHighlighting(buildxHighlightStyle);
export const buildxExtensions = [buildxEditorTheme, buildxSyntaxHighlighting];
