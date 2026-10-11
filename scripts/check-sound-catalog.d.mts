export declare function checkSoundCatalog(docsDir: string): Promise<{
  count: number;
  bytes: number;
  mebibytes: number;
  profiled: number;
  providers: Record<string, number>;
  types: Record<string, number>;
}>;
