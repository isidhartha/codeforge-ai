export interface CodeForgeOptions { host?: string; timeout?: number; }
export declare class CodeForgeClient {
  constructor(options?: CodeForgeOptions);
  generate(spec: string, language?: string): Promise<{ code: string }>;
  explain(code: string, context?: string): Promise<{ explanation: string }>;
  debug(code: string, error: string): Promise<{ explanation: string; fix: string }>;
  chat(message: string, history?: object[]): Promise<{ response: string }>;
  runCommand(command: string): Promise<{ output: string; exit_code: number }>;
  nlToCommand(description: string): Promise<{ command: string; explanation: string }>;
  indexProject(path: string): Promise<{ files_indexed: number }>;
  search(query: string, topK?: number): Promise<Array<{ file: string; excerpt: string; score: number }>>;
  health(): Promise<{ status: string }>;
}
export default CodeForgeClient;
