/**
 * FEAT-20260925-718 L2 — a component imports its own stylesheet
 * (`import './player-motion.css'`) and the consumer's bundler takes it from
 * there; `scripts/build.ts` copies the file beside the built module. This
 * tells the typecheck such an import is a module, as TypeScript 6 checks
 * side-effect imports too.
 */
declare module '*.css';
