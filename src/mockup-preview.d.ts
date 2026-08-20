// Fallback for the gitignored plugin-generated module so fresh checkouts
// typecheck; the real file wins resolution. Shape: generateSource().
declare module "@/.generated/mockup-components" {
  export type PreviewLoader = () => Promise<Record<string, unknown>>;
  export interface ComponentPreview {
    load?: PreviewLoader;
    name: string;
    isDefault: boolean;
    file?: string;
    props: Record<string, string | number | boolean>;
    variants?: Record<string, string[]>;
  }
  export const mockups: Record<string, PreviewLoader>;
  export const components: Record<string, ComponentPreview>;
}
