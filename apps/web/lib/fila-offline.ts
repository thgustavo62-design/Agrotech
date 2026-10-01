/**
 * Fila de escrita offline (Fase 5). Guarda no IndexedDB do aparelho um formulário
 * que não pôde ser enviado por falta de sinal — campos e fotos — e reenvia quando
 * a conexão volta. Sem Background Sync (o Safari não tem): quem chama
 * `sincronizar` é o app aberto, no evento `online` e ao carregar.
 *
 * Idempotência: cada item carrega `chave_cliente` (uuid gerado ao enfileirar,
 * também enviado no form). Se a resposta se perder depois do servidor gravar, o
 * reenvio bate na chave única e vira no-op em vez de duplicar a visita.
 */

const BANCO = 'agrotech-fila';
const LOJA = 'pendentes';
export const EVENTO_FILA = 'agrotech:fila-mudou';

export interface ItemFila {
  id: string;
  /** ms desde a época, com fração (ordena a fila) */
  criadoEm: number;
  /** valores do FormData; arquivos ficam como File/Blob (IndexedDB clona) */
  campos: Array<[string, string | File]>;
  tentativas: number;
  erro?: string;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'id' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => falha(req.error);
  });
}

async function transacao<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, falha) => {
      const req = fn(db.transaction(LOJA, modo).objectStore(LOJA));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => falha(req.error);
    });
  } finally {
    db.close();
  }
}

function avisar() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_FILA));
}

/** Erro de conexão (fetch falhou), não resposta do servidor. */
export function ehErroDeRede(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return e instanceof TypeError;
}

export function paraFormData(item: ItemFila): FormData {
  const fd = new FormData();
  for (const [nome, valor] of item.campos) fd.append(nome, valor);
  return fd;
}

/** Copia o form para a fila e devolve o item. Gera `chave_cliente` se o form não trouxe. */
export async function enfileirar(fd: FormData): Promise<ItemFila> {
  const campos: ItemFila['campos'] = [];
  for (const [nome, valor] of fd.entries()) {
    if (typeof valor !== 'string' && valor.size === 0) continue; // input de arquivo vazio
    campos.push([nome, valor]);
  }
  if (!campos.some(([n]) => n === 'chave_cliente')) campos.push(['chave_cliente', crypto.randomUUID()]);

  // alta resolução: dois envios no mesmo milissegundo precisam manter a ordem
  const criadoEm = performance.timeOrigin + performance.now();
  const item: ItemFila = { id: crypto.randomUUID(), criadoEm, campos, tentativas: 0 };
  await transacao('readwrite', (l) => l.add(item));
  avisar();
  return item;
}

export async function listar(): Promise<ItemFila[]> {
  const todos = await transacao('readonly', (l) => l.getAll() as IDBRequest<ItemFila[]>);
  return todos.sort((a, b) => a.criadoEm - b.criadoEm);
}

export async function remover(id: string): Promise<void> {
  await transacao('readwrite', (l) => l.delete(id));
  avisar();
}

async function marcarFalha(item: ItemFila, mensagem: string): Promise<void> {
  await transacao('readwrite', (l) => l.put({ ...item, tentativas: item.tentativas + 1, erro: mensagem }));
  avisar();
}

export interface ResultadoSync {
  enviadas: number;
  /** itens que o servidor recusou (ficam na fila com a mensagem) */
  recusadas: number;
  /** parou por falta de sinal; o restante segue na fila */
  semRede: boolean;
}

/**
 * Reenvia a fila em ordem. `enviar` é a server action. Falta de rede interrompe
 * (o resto espera); erro do servidor marca o item e segue para o próximo.
 */
export async function sincronizar(enviar: (fd: FormData) => Promise<unknown>): Promise<ResultadoSync> {
  const r: ResultadoSync = { enviadas: 0, recusadas: 0, semRede: false };
  for (const item of await listar()) {
    try {
      await enviar(paraFormData(item));
      await remover(item.id);
      r.enviadas++;
    } catch (e) {
      if (ehErroDeRede(e)) {
        r.semRede = true;
        break;
      }
      await marcarFalha(item, e instanceof Error ? e.message : String(e));
      r.recusadas++;
    }
  }
  return r;
}
