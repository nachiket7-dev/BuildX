import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const buildxEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#13151A',
      color: '#F8FAFC',
      fontSize: '13px',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Geist Mono', monospace",
      height: '100%',
    },
    '.cm-content': {
      padding: '12px 0',
      caretColor: '#34D399',
    },
    '.cm-cursor': {
      borderLeftColor: '#34D399',
      borderLeftWidth: '2px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.025)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#34D399',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(16, 185, 129, 0.18) !important',
    },
    '.cm-gutters': {
      backgroundColor: '#13151A',
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
  },
  { dark: true }
);

export const buildxHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#CBD5E1', fontWeight: 'bold' },
  { tag: [tags.typeName, tags.className], color: '#38BDF8' },
  { tag: [tags.string, tags.special(tags.string)], color: '#34D399' },
  {
    tag: [tags.function(tags.propertyName), tags.function(tags.variableName)],
    color: '#F59E0B',
  },
  { tag: [tags.propertyName, tags.variableName], color: '#F8FAFC' },
  { tag: tags.number, color: '#F59E0B' },
  { tag: tags.operator, color: '#94A3B8' },
  { tag: tags.comment, color: '#52525B', fontStyle: 'italic' },
  { tag: tags.punctuation, color: '#94A3B8' },
]);

export const buildxSyntaxHighlighting = syntaxHighlighting(buildxHighlightStyle);
export const buildxExtensions = [buildxEditorTheme, buildxSyntaxHighlighting];

